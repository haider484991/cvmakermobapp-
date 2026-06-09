/**
 * PhotoPicker — circular avatar that lets the user attach a headshot to
 * their resume. Stored as a base64 data URI in `resume.header.photo` so it:
 *   - persists to AsyncStorage with the rest of the resume
 *   - embeds directly into the HTML for the WebView preview AND the PDF
 *     export (no file-access issues at print time)
 *
 * Only sidebar / photo-slot templates render it; others ignore it. The
 * crop is forced square (1:1) so it always fills the circular frame.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Camera, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  /** Current photo as a data URI (or undefined). */
  value?: string;
  /** Fires with the new data URI, or null when removed. */
  onChange: (dataUri: string | null) => void;
  size?: number;
}

export function PhotoPicker({ value, onChange, size = 84 }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const pick = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Permission — launchImageLibraryAsync prompts on first use, but we
      // request explicitly to give a clear message if denied.
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow photo access in Settings to add a headshot to your resume.',
        );
        return;
      }

      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1], // force square crop for the circular frame
        quality: 0.6, // compress — keeps the base64 small (~80-150KB)
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        const asset = result.assets[0];
        // Mime defaults to jpeg from the picker's editing flow.
        const mime = asset.mimeType || 'image/jpeg';
        onChange(`data:${mime};base64,${asset.base64}`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      Alert.alert('Could not add photo', 'Please try a different image.');
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  const remove = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(null);
  }, [onChange]);

  return (
    <View style={{ alignItems: 'center', marginBottom: 16 }}>
      <View>
        <Pressable
          onPress={pick}
          disabled={loading}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: value ? colors.primary : colors.border,
            borderStyle: value ? 'solid' : 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : value ? (
            <PhotoImage uri={value} size={size} />
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Camera size={22} color={colors.textSecondary} />
            </View>
          )}
        </Pressable>

        {/* Remove badge */}
        {value && !loading && (
          <Pressable
            onPress={remove}
            hitSlop={8}
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: colors.error,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: colors.background,
            }}
          >
            <X size={14} color="white" strokeWidth={3} />
          </Pressable>
        )}
      </View>

      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
        {value ? 'Tap to change photo' : 'Add photo (optional)'}
      </Text>
    </View>
  );
}

/** Renders the data-URI photo via RN Image. Kept separate so the picker
 *  body stays readable. */
function PhotoImage({ uri, size }: { uri: string; size: number }) {
  // RN Image accepts data URIs directly.
  const { Image } = require('react-native');
  return <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />;
}

export default PhotoPicker;
