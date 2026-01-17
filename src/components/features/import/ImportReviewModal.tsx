/**
 * Import Review Modal Component
 * Displays parsed resume data for user review before import
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, SlideInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  X,
  Check,
  AlertTriangle,
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderOpen,
  Award,
  Languages,
  Trophy,
  AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeImport } from '@/hooks/useResumeImport';
import { gradientColors } from '@/constants/theme';

interface ImportReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (resumeId: string) => void;
}

export function ImportReviewModal({
  visible,
  onClose,
  onConfirm,
}: ImportReviewModalProps) {
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const {
    parsedData,
    confidence,
    warnings,
    importAsNewResume,
    cancelImport,
    getStats,
    isLoading,
  } = useResumeImport();

  const stats = useMemo(() => getStats(), [getStats, parsedData]);

  // Get confidence color
  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return colors.success;
    if (conf >= 0.6) return colors.warning;
    return colors.error;
  };

  // Get confidence label
  const getConfidenceLabel = (conf: number): string => {
    if (conf >= 0.8) return 'High Confidence';
    if (conf >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  // Handle confirm
  const handleConfirm = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const name = parsedData?.header?.fullName
      ? `${parsedData.header.fullName}'s Resume`
      : 'Imported Resume';

    const resumeId = importAsNewResume(name);
    if (resumeId) {
      if (hapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onConfirm(resumeId);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    cancelImport();
    onClose();
  };

  if (!parsedData || !stats) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(100)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: colors.text,
            }}
          >
            Review Import
          </Text>
          <Pressable
            onPress={handleCancel}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Confidence Score */}
          <Animated.View entering={FadeInDown.delay(150)}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 20,
                marginBottom: 16,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: getConfidenceColor(confidence) + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: '700',
                    color: getConfidenceColor(confidence),
                  }}
                >
                  {Math.round(confidence * 100)}%
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: getConfidenceColor(confidence),
                  marginBottom: 4,
                }}
              >
                {getConfidenceLabel(confidence)}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                AI extracted data from your resume
              </Text>
            </View>
          </Animated.View>

          {/* Warnings */}
          {warnings.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200)}>
              <View
                style={{
                  backgroundColor: colors.warning + '15',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: colors.warning + '30',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <AlertTriangle size={18} color={colors.warning} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: colors.warning,
                      marginLeft: 8,
                    }}
                  >
                    Warnings
                  </Text>
                </View>
                {warnings.map((warning, index) => (
                  <Text
                    key={index}
                    style={{
                      fontSize: 13,
                      color: colors.text,
                      marginTop: index > 0 ? 4 : 0,
                    }}
                  >
                    {'\u2022 '}{warning}
                  </Text>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Detected Sections */}
          <Animated.View entering={FadeInDown.delay(250)}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
                marginBottom: 12,
              }}
            >
              Detected Content
            </Text>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              {/* Header Info */}
              <SectionItem
                icon={<User size={18} color={colors.primary} />}
                label="Contact Information"
                value={stats.header ? parsedData.header.fullName || 'Detected' : 'Not found'}
                detected={stats.header}
                colors={colors}
              />

              {/* Summary */}
              <SectionItem
                icon={<FileText size={18} color={colors.primary} />}
                label="Professional Summary"
                value={stats.summary ? 'Detected' : 'Not found'}
                detected={stats.summary}
                colors={colors}
                hasBorder
              />

              {/* Experience */}
              <SectionItem
                icon={<Briefcase size={18} color={colors.primary} />}
                label="Work Experience"
                value={
                  stats.experienceCount > 0
                    ? `${stats.experienceCount} position${stats.experienceCount !== 1 ? 's' : ''}`
                    : 'Not found'
                }
                detected={stats.experienceCount > 0}
                colors={colors}
                hasBorder
              />

              {/* Education */}
              <SectionItem
                icon={<GraduationCap size={18} color={colors.primary} />}
                label="Education"
                value={
                  stats.educationCount > 0
                    ? `${stats.educationCount} entr${stats.educationCount !== 1 ? 'ies' : 'y'}`
                    : 'Not found'
                }
                detected={stats.educationCount > 0}
                colors={colors}
                hasBorder
              />

              {/* Skills */}
              <SectionItem
                icon={<Wrench size={18} color={colors.primary} />}
                label="Skills"
                value={
                  stats.skillsCount > 0
                    ? `${stats.skillsCount} skill${stats.skillsCount !== 1 ? 's' : ''}`
                    : 'Not found'
                }
                detected={stats.skillsCount > 0}
                colors={colors}
                hasBorder
              />

              {/* Projects */}
              {stats.projectsCount > 0 && (
                <SectionItem
                  icon={<FolderOpen size={18} color={colors.primary} />}
                  label="Projects"
                  value={`${stats.projectsCount} project${stats.projectsCount !== 1 ? 's' : ''}`}
                  detected={true}
                  colors={colors}
                  hasBorder
                />
              )}

              {/* Certifications */}
              {stats.certificationsCount > 0 && (
                <SectionItem
                  icon={<Award size={18} color={colors.primary} />}
                  label="Certifications"
                  value={`${stats.certificationsCount} certification${stats.certificationsCount !== 1 ? 's' : ''}`}
                  detected={true}
                  colors={colors}
                  hasBorder
                />
              )}

              {/* Languages */}
              {stats.languagesCount > 0 && (
                <SectionItem
                  icon={<Languages size={18} color={colors.primary} />}
                  label="Languages"
                  value={`${stats.languagesCount} language${stats.languagesCount !== 1 ? 's' : ''}`}
                  detected={true}
                  colors={colors}
                  hasBorder
                />
              )}

              {/* Awards */}
              {stats.awardsCount > 0 && (
                <SectionItem
                  icon={<Trophy size={18} color={colors.primary} />}
                  label="Awards"
                  value={`${stats.awardsCount} award${stats.awardsCount !== 1 ? 's' : ''}`}
                  detected={true}
                  colors={colors}
                  hasBorder
                />
              )}
            </View>
          </Animated.View>

          {/* Total Sections Count */}
          <Animated.View entering={FadeInDown.delay(300)}>
            <View
              style={{
                marginTop: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textSecondary,
                }}
              >
                {stats.totalSections} section{stats.totalSections !== 1 ? 's' : ''} detected
              </Text>
            </View>
          </Animated.View>

          {/* Bottom Spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Action Buttons */}
        <Animated.View
          entering={SlideInUp.delay(400)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 20,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleCancel}
              style={{
                flex: 1,
                paddingVertical: 16,
                borderRadius: 12,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={isLoading}
              style={{ flex: 2 }}
            >
              <LinearGradient
                colors={gradientColors.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: '600',
                        marginLeft: 8,
                      }}
                    >
                      Creating...
                    </Text>
                  </>
                ) : (
                  <>
                    <Check size={20} color="#FFFFFF" />
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: '600',
                        marginLeft: 8,
                      }}
                    >
                      Create Resume
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Section item component for the detected content list
 */
function SectionItem({
  icon,
  label,
  value,
  detected,
  colors,
  hasBorder = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detected: boolean;
  colors: any;
  hasBorder?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: hasBorder ? 1 : 0,
        borderTopColor: colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: detected ? colors.primary + '15' : colors.border + '50',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: colors.text,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: detected ? colors.textSecondary : colors.textMuted,
            marginTop: 2,
          }}
        >
          {value}
        </Text>
      </View>
      {detected ? (
        <Check size={18} color={colors.success} />
      ) : (
        <AlertCircle size={18} color={colors.textMuted} />
      )}
    </View>
  );
}

export default ImportReviewModal;
