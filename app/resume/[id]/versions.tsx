/**
 * Version history.
 *
 * `versionService.ts` (325 lines) and `useVersions.ts` (254 lines) were fully
 * implemented — snapshot, restore, rename, delete, auto-save, pruning — and
 * had no UI consumer anywhere in the app, so none of it was reachable.
 * Resume.io and Kickresume both sell version history; here it was already
 * built and simply not surfaced.
 *
 * Restoring overwrites the current resume, so we snapshot first — that way
 * "restore" is itself undoable.
 */

import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { History, RotateCcw, Trash2, Plus, Clock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useVersions } from '@/hooks/useVersions';
import { ScreenHeader, StateView } from '@/components/ui';
import { track } from '@/services/analytics/analytics';

function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export default function VersionHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { hapticEnabled } = useUIStore();
  const { getResume } = useResumeStore();
  const resume = id ? getResume(id) : null;

  const { versions, isLoading, createVersion, restoreVersion, deleteVersion, refresh } = useVersions({
    resumeId: id!,
  });
  const [busy, setBusy] = useState(false);

  const handleBack = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router, hapticEnabled]);

  const handleSaveVersion = useCallback(async () => {
    if (busy) return;
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    try {
      const v = await createVersion();
      if (v) {
        track('resume_version_saved' as any, { version: v.version });
        if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [busy, createVersion, refresh, hapticEnabled]);

  const handleRestore = useCallback(
    (versionId: string, label: string) => {
      Alert.alert(
        'Restore this version?',
        `Your resume will be replaced with "${label}". We'll snapshot the current version first, so you can undo this.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                // Snapshot the present before overwriting it — otherwise
                // restoring an old version silently destroys current work.
                await createVersion('Before restore');
                const ok = await restoreVersion(versionId);
                if (ok) {
                  track('resume_version_restored' as any, {});
                  if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Restored', 'Your resume has been rolled back to that version.');
                  router.back();
                } else {
                  Alert.alert('Could not restore', 'That version could not be applied.');
                }
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    },
    [createVersion, restoreVersion, hapticEnabled, router],
  );

  const handleDelete = useCallback(
    (versionId: string) => {
      Alert.alert('Delete this version?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteVersion(versionId);
            await refresh();
          },
        },
      ]);
    },
    [deleteVersion, refresh],
  );

  if (!resume) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Version History" onBack={handleBack} />
        <StateView
          variant="error"
          icon={History}
          title="Resume not found"
          message="This resume may have been deleted."
          actionLabel="Go back"
          onAction={handleBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Version History" onBack={handleBack} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 14 }}>
          Save a snapshot before a big rewrite — you can roll back to any version at any time.
        </Text>

        <Pressable
          onPress={handleSaveVersion}
          disabled={busy}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 15,
            borderRadius: 14,
            backgroundColor: colors.primary,
            opacity: busy ? 0.6 : 1,
            marginBottom: 20,
          }}
          accessibilityRole="button"
          accessibilityLabel="Save a version now"
        >
          {busy ? <ActivityIndicator size="small" color="white" /> : <Plus size={18} color="white" />}
          <Text style={{ color: 'white', fontWeight: '700', marginLeft: 8 }}>Save current version</Text>
        </Pressable>

        {isLoading && versions.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : versions.length === 0 ? (
          <StateView
            variant="empty"
            icon={Clock}
            title="No versions saved yet"
            message="Save one before your next big edit and you'll always be able to get back to it."
          />
        ) : (
          versions.map((v, i) => (
            <Animated.View key={v.id} entering={FadeInUp.delay(i * 40)}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.primary + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>v{v.version}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={1}>
                      {v.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {timeAgo(v.createdAt)}
                      {v.isAutoSave ? ' · auto-saved' : ''}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={() => handleRestore(v.id, v.name)}
                    disabled={busy}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: colors.primary + '12',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${v.name}`}
                  >
                    <RotateCcw size={15} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>
                      Restore
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(v.id)}
                    disabled={busy}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 10,
                      backgroundColor: colors.error + '10',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${v.name}`}
                  >
                    <Trash2 size={15} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
