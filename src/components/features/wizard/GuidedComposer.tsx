/**
 * GuidedComposer — the low-effort path to a good resume.
 *
 * Replaces "write a paragraph about yourself" with a handful of small
 * questions, one per screen. The design follows directly from what the data
 * showed: users faced with a single large box either froze or submitted the
 * template we had put there, and the resulting resumes came back at
 * confidence 0.25 with no skills and no education.
 *
 * Three properties do the work:
 *
 *   - One question per screen. It is very hard to freeze on "what's your job
 *     title?" in a way that a blank essay box invites.
 *   - Tapping beats typing. Skills are chips drawn from the industry the user
 *     already chose during onboarding, so the highest-value section of the
 *     resume can be filled without the keyboard.
 *   - Nothing is prefilled that the user did not tell us. Name and job title
 *     come from their own onboarding answers; every other field starts empty.
 *     A scaffold the user has to delete is exactly the trap we just removed.
 *
 * The answers are assembled by composeNarrative() into the same narrative
 * string the free-text box produces, so the AI service, review screen and
 * apply pipeline are all untouched.
 */

import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Switch } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Plus, Sparkles, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import {
  composeNarrative,
  canCompose,
  missingForCompose,
  stepForRequirement,
  emptyAnswers,
  emptyRole,
  skillsKeyForIndustry,
  HIGHLIGHT_PROMPT_KEYS,
  type GuidedAnswers,
  type GuidedRole,
} from '@/services/ai/guidedNarrative';

const STEPS = ['you', 'work', 'highlights', 'skills', 'education'] as const;

const MAX_ROLES = 3;

/**
 * Defined at module scope on purpose. A component declared inside
 * GuidedComposer's body is a NEW component type on every render, so React
 * unmounts and remounts it — and the TextInput inside would lose focus after
 * every single keystroke, which makes the whole form unusable.
 */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numbers-and-punctuation';
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: colors.text,
            fontSize: 16,
          },
          multiline ? { minHeight: 130, lineHeight: 22 } : null,
        ]}
      />
    </View>
  );
}

interface Props {
  isLoading: boolean;
  onSubmit: (narrative: string) => void;
  onSwitchToFreeText: () => void;
}

export function GuidedComposer({ isLoading, onSubmit, onSwitchToFreeText }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { hapticEnabled, onboardingProfile } = useUIStore();

  // Seed ONLY from what the user themselves told onboarding. Everything else
  // starts empty — a field the user must clear is the trap we just fixed.
  const [answers, setAnswers] = useState<GuidedAnswers>(() => ({
    ...emptyAnswers(),
    fullName: onboardingProfile.firstName?.trim() ?? '',
    jobTitle: onboardingProfile.targetRole?.trim() ?? '',
  }));
  const [stepIndex, setStepIndex] = useState(0);
  const [customSkill, setCustomSkill] = useState('');

  const step = STEPS[stepIndex];
  // The chip lists live in the locale files: a skill chip is not chrome,
  // it goes verbatim into the finished resume.
  const suggestions = useMemo(() => {
    const list = t(skillsKeyForIndustry(onboardingProfile.industry), { returnObjects: true });
    return Array.isArray(list) ? (list as string[]) : [];
  }, [t, onboardingProfile.industry]);

  const patch = useCallback((p: Partial<GuidedAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...p }));
  }, []);

  const patchRole = useCallback((index: number, p: Partial<GuidedRole>) => {
    setAnswers((prev) => ({
      ...prev,
      roles: prev.roles.map((r, i) => (i === index ? { ...r, ...p } : r)),
    }));
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= STEPS.length) return;
      if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStepIndex(next);
      track(ANALYTICS_EVENTS.AI_WIZARD_GUIDED_STEP_VIEWED, { step: STEPS[next], index: next });
    },
    [hapticEnabled],
  );

  const toggleSkill = useCallback(
    (skill: string) => {
      if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setAnswers((prev) => ({
        ...prev,
        skills: prev.skills.includes(skill)
          ? prev.skills.filter((s) => s !== skill)
          : [...prev.skills, skill],
      }));
    },
    [hapticEnabled],
  );

  const addCustomSkill = useCallback(() => {
    const s = customSkill.trim();
    if (!s) return;
    setAnswers((prev) =>
      prev.skills.includes(s) ? prev : { ...prev, skills: [...prev.skills, s] },
    );
    setCustomSkill('');
  }, [customSkill]);

  const ready = canCompose(answers);
  const missing = missingForCompose(answers);

  /**
   * Tapping a blocked "Build my resume" tells the user what is missing and
   * takes them to the step that fixes it, rather than doing nothing. A silent
   * disabled button is why people were bouncing between steps.
   */
  const explainBlocked = () => {
    if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    track(ANALYTICS_EVENTS.AI_WIZARD_GUIDED_BLOCKED, { missing });
    const first = missing[0];
    if (first) go(stepForRequirement(first));
  };

  const handleSubmit = useCallback(() => {
    if (!ready || isLoading) return;
    const narrative = composeNarrative(answers, t);
    track(ANALYTICS_EVENTS.AI_WIZARD_GUIDED_COMPLETED, {
      word_count: narrative.split(/\s+/).filter(Boolean).length,
      roles_count: answers.roles.filter((r) => r.title || r.company).length,
      skills_count: answers.skills.length,
      has_education: Boolean(answers.education.trim()),
      no_experience_yet: answers.noExperienceYet,
    });
    onSubmit(narrative);
  }, [ready, isLoading, answers, onSubmit, t]);

  /* ---------------------------------------------------------------- fields */

  const fieldStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  } as const;

  /* ----------------------------------------------------------------- steps */

  const renderStep = () => {
    switch (step) {
      case 'you':
        return (
          <>
            <Field
              label={t('wizard.guided.nameLabel')}
              value={answers.fullName}
              onChangeText={(v) => patch({ fullName: v })}
              placeholder={t('wizard.guided.namePlaceholder')}
              colors={colors}
            />
            <Field
              label={t('wizard.guided.jobTitleLabel')}
              value={answers.jobTitle}
              onChangeText={(v) => patch({ jobTitle: v })}
              placeholder={t('wizard.guided.jobTitlePlaceholder')}
              colors={colors}
            />
            <Field
              label={t('wizard.guided.locationLabel')}
              value={answers.location}
              onChangeText={(v) => patch({ location: v })}
              placeholder={t('wizard.guided.locationPlaceholder')}
              colors={colors}
            />
          </>
        );

      case 'work':
        return (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 18,
              }}
            >
              <Text style={{ flex: 1, color: colors.text, fontSize: 14, paddingRight: 12 }}>
                {t('wizard.guided.noJobYet')}
              </Text>
              <Switch
                value={answers.noExperienceYet}
                onValueChange={(v) => patch({ noExperienceYet: v })}
                trackColor={{ true: colors.primary }}
              />
            </View>

            {!answers.noExperienceYet &&
              answers.roles.map((role, i) => (
                <View
                  key={i}
                  style={{
                    marginBottom: 18,
                    paddingTop: i > 0 ? 16 : 0,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                  }}
                >
                  {i > 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>
                        {t('wizard.guided.earlierJob')}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            roles: prev.roles.filter((_, j) => j !== i),
                          }))
                        }
                        hitSlop={8}
                      >
                        <X size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  )}
                  <Field
                    label={t('wizard.guided.roleTitleLabel')}
                    value={role.title}
                    onChangeText={(v) => patchRole(i, { title: v })}
                    placeholder={t('wizard.guided.roleTitlePlaceholder')}
                    colors={colors}
                  />
                  <Field
                    label={t('wizard.guided.companyLabel')}
                    value={role.company}
                    onChangeText={(v) => patchRole(i, { company: v })}
                    placeholder={t('wizard.guided.companyPlaceholder')}
                    colors={colors}
                  />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label={t('wizard.guided.fromLabel')}
                        value={role.startYear}
                        onChangeText={(v) => patchRole(i, { startYear: v })}
                        placeholder={t('wizard.guided.fromPlaceholder')}
                        keyboardType="numbers-and-punctuation"
                        colors={colors}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label={t('wizard.guided.toLabel')}
                        value={role.endYear}
                        onChangeText={(v) => patchRole(i, { endYear: v })}
                        placeholder={t('wizard.guided.toPlaceholder')}
                        keyboardType="numbers-and-punctuation"
                        colors={colors}
                      />
                    </View>
                  </View>
                </View>
              ))}

            {!answers.noExperienceYet && answers.roles.length < MAX_ROLES && (
              <Pressable
                onPress={() =>
                  setAnswers((prev) => ({ ...prev, roles: [...prev.roles, emptyRole()] }))
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.border,
                }}
              >
                <Plus size={16} color={colors.primary} />
                <Text style={{ marginLeft: 6, color: colors.primary, fontWeight: '600' }}>
                  {t('wizard.guided.addEarlierJob')}
                </Text>
              </Pressable>
            )}
          </>
        );

      case 'highlights':
        if (answers.noExperienceYet) {
          return (
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
              {t('wizard.guided.noExperienceNote')}
            </Text>
          );
        }
        return (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {HIGHLIGHT_PROMPT_KEYS.map((p) => (
                <View
                  key={p}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 100,
                    backgroundColor: colors.primary + '10',
                    borderWidth: 1,
                    borderColor: colors.primary + '25',
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '500' }}>
                    {t(`wizard.guided.prompts.${p}`)}
                  </Text>
                </View>
              ))}
            </View>
            {answers.roles.map((role, i) =>
              role.title || role.company || i === 0 ? (
                <Field
                  key={i}
                  label={
                    role.title || role.company
                      ? t('wizard.guided.atCompany', { name: role.company || role.title })
                      : t('wizard.guided.whatYouDid')
                  }
                  value={role.highlights}
                  onChangeText={(v) => patchRole(i, { highlights: v })}
                  placeholder={t('wizard.guided.highlightsPlaceholder')}
                  multiline
                  colors={colors}
                />
              ) : null,
            )}
          </>
        );

      case 'skills':
        return (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {suggestions.map((s) => {
                const on = answers.skills.includes(s);
                return (
                  <Pressable
                    key={s}
                    onPress={() => toggleSkill(s)}
                    style={{
                      paddingVertical: 9,
                      paddingHorizontal: 14,
                      borderRadius: 100,
                      backgroundColor: on ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: on ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: on ? 'white' : colors.text,
                        fontSize: 13,
                        fontWeight: on ? '700' : '500',
                      }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Anything the user added themselves that isn't in the chip set */}
            {answers.skills.filter((s) => !suggestions.includes(s)).length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {answers.skills
                  .filter((s) => !suggestions.includes(s))
                  .map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => toggleSkill(s)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 9,
                        paddingHorizontal: 14,
                        borderRadius: 100,
                        backgroundColor: colors.primary,
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>{s}</Text>
                      <X size={13} color="white" style={{ marginLeft: 6 }} />
                    </Pressable>
                  ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={customSkill}
                onChangeText={setCustomSkill}
                onSubmitEditing={addCustomSkill}
                returnKeyType="done"
                placeholder={t('wizard.guided.addYourOwn')}
                placeholderTextColor={colors.textMuted}
                style={[fieldStyle, { flex: 1 }]}
              />
              <Pressable
                onPress={addCustomSkill}
                style={{
                  paddingHorizontal: 18,
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Plus size={18} color={colors.primary} />
              </Pressable>
            </View>
          </>
        );

      case 'education':
        return (
          <Field
            label={t('wizard.guided.educationLabel')}
            value={answers.education}
            onChangeText={(v) => patch({ education: v })}
            placeholder={t('wizard.guided.educationPlaceholder')}
            multiline
            colors={colors}
          />
        );
    }
  };

  /* ---------------------------------------------------------------- render */

  const isLast = stepIndex === STEPS.length - 1;

  return (
    <View style={{ flex: 1 }}>
      {/* Progress */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: i <= stepIndex ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
        <Text style={{ marginTop: 8, fontSize: 12, color: colors.textMuted }}>
          {t('wizard.guided.stepOf', { current: String(stepIndex + 1), total: String(STEPS.length) })}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View key={step} entering={FadeIn.duration(180)}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 }}>
            {t(`wizard.guided.steps.${step}.title`)}
          </Text>
          <Text
            style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 }}
          >
            {t(`wizard.guided.steps.${step}.subtitle`)}
          </Text>
          {renderStep()}
        </Animated.View>

        {isLast && !ready && missing.length > 0 && (
          <View
            style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 10,
              backgroundColor: colors.warning + '12',
              borderWidth: 1,
              borderColor: colors.warning + '35',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
              {t(`wizard.guided.missing.${missing[0]}`)}
            </Text>
          </View>
        )}

        {stepIndex === 0 && (
          <Pressable onPress={onSwitchToFreeText} style={{ marginTop: 18, alignSelf: 'flex-start' }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>
              {t('wizard.guided.switchToFreeText')}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Nav */}
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          padding: 16,
          paddingBottom: 24,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        {stepIndex > 0 && (
          <Pressable
            onPress={() => go(stepIndex - 1)}
            style={{
              paddingHorizontal: 18,
              justifyContent: 'center',
              borderRadius: 14,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            if (!isLast) return go(stepIndex + 1);
            if (!ready) return explainBlocked();
            return handleSubmit();
          }}
          disabled={isLoading}
          style={{
            flex: 1,
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: isLast && !ready ? colors.warning : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
          }}
        >
          {isLast && <Sparkles size={18} color="white" />}
          <Text
            style={{
              color: 'white',
              fontWeight: '700',
              fontSize: 15,
              marginLeft: isLast ? 8 : 0,
            }}
          >
            {isLast
              ? isLoading
                ? t('wizard.generating')
                : t('wizard.guided.buildResume')
              : t('common.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default GuidedComposer;
