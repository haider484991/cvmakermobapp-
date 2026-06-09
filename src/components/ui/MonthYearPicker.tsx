/**
 * MonthYearPicker — month + year wheel picker for resume dates.
 *
 * Why custom and not @react-native-community/datetimepicker?
 *   - DateTimePicker forces a day field. Resume dates never include the
 *     day, so user has to ignore the day spinner — confusing.
 *   - DateTimePicker's display is platform-divergent: iOS shows spinners,
 *     Android shows a calendar. We want the same UX both places so design
 *     screenshots match.
 *   - We need 1950..currentYear+5 year range. Calendar pickers default
 *     to ±1 year and force scrolling — slow for a 10-year-old job.
 *
 * Stores dates as "YYYY-MM" strings (matches the resume schema) but
 * displays them as "Jan 2024" / "Feb 2018" to users.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Calendar, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface Props {
  /** Current value as YYYY-MM (or empty) */
  value?: string;
  /** Fires when user picks. Argument is YYYY-MM, e.g. "2024-03". */
  onChange: (value: string) => void;
  /** Display label, e.g. "Start Date". */
  label?: string;
  /** Placeholder if value is empty, e.g. "Pick a date". */
  placeholder?: string;
  /** Disable the trigger button. */
  disabled?: boolean;
  /** Min year — defaults to 1960 (covers most working careers). */
  minYear?: number;
  /** Max year — defaults to current year + 5. */
  maxYear?: number;
}

/**
 * Parse "YYYY-MM" into { year, monthIndex (0-11) }. Returns null for
 * empty/invalid input so the picker opens on "today".
 */
function parse(value?: string): { year: number; monthIndex: number } | null {
  if (!value) return null;
  // Accept both "YYYY-MM" (canonical) and "Jan 2024" (legacy free-text)
  // so users with old resumes don't see an empty picker.
  const ymMatch = value.match(/^(\d{4})-(\d{1,2})$/);
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10) - 1;
    if (y > 0 && m >= 0 && m < 12) return { year: y, monthIndex: m };
  }
  const monthYearMatch = value.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthYearMatch) {
    const monthIdx = MONTHS.findIndex(
      (m) => m.toLowerCase() === monthYearMatch[1].slice(0, 3).toLowerCase(),
    );
    const y = parseInt(monthYearMatch[2], 10);
    if (monthIdx >= 0 && y > 0) return { year: y, monthIndex: monthIdx };
  }
  return null;
}

/** Format YYYY-MM for display. "2024-03" → "Mar 2024". */
export function formatMonthYear(value?: string): string {
  const parsed = parse(value);
  if (!parsed) return value || '';
  return `${MONTHS[parsed.monthIndex]} ${parsed.year}`;
}

export function MonthYearPicker({
  value,
  onChange,
  label,
  placeholder = 'Pick a date',
  disabled = false,
  minYear = 1960,
  maxYear,
}: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  // Editor state — only commits on "Done"
  const initial = useMemo(() => {
    return parse(value) ?? { year: new Date(2024, 0).getFullYear(), monthIndex: 0 };
  }, [value, open]);
  const [draftYear, setDraftYear] = useState(initial.year);
  const [draftMonth, setDraftMonth] = useState(initial.monthIndex);

  // Date.now() is unavailable in worker contexts; new Date() is fine on RN.
  // Default the upper bound to the current year + 5 so future grad dates work.
  const upperYear = maxYear ?? new Date(2030, 0).getFullYear();
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = upperYear; y >= minYear; y--) out.push(y);
    return out;
  }, [upperYear, minYear]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const seed = parse(value);
    setDraftYear(seed?.year ?? new Date(2024, 0).getFullYear());
    setDraftMonth(seed?.monthIndex ?? 0);
    setOpen(true);
  }, [disabled, value]);

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const mm = String(draftMonth + 1).padStart(2, '0');
    onChange(`${draftYear}-${mm}`);
    setOpen(false);
  }, [draftMonth, draftYear, onChange]);

  const handleCancel = useCallback(() => setOpen(false), []);

  const displayed = formatMonthYear(value);

  return (
    <View>
      {label && (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      )}
      <Pressable
        onPress={handleOpen}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: disabled ? colors.surfaceSecondary : colors.surface,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Calendar size={16} color={displayed ? colors.text : colors.textMuted} />
        <Text
          style={{
            marginLeft: 10,
            flex: 1,
            color: displayed ? colors.text : colors.textMuted,
            fontSize: 15,
          }}
        >
          {displayed || placeholder}
        </Text>
      </Pressable>

      {/* Picker modal */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <Pressable
          onPress={handleCancel}
          style={styles.backdrop}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheet, { backgroundColor: colors.background }]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Pressable onPress={handleCancel} hitSlop={8}>
                <X size={22} color={colors.textSecondary} />
              </Pressable>
              <Text
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 16,
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                {label || 'Pick a date'}
              </Text>
              <Pressable
                onPress={handleConfirm}
                hitSlop={8}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>
                  Done
                </Text>
              </Pressable>
            </View>

            {/* Display value preview */}
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, letterSpacing: 1, marginBottom: 4 }}>
                YOU'RE PICKING
              </Text>
              <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '700' }}>
                {MONTHS[draftMonth]} {draftYear}
              </Text>
            </View>

            {/* Two columns: months + years */}
            <View style={{ flexDirection: 'row', height: 280, paddingHorizontal: 12 }}>
              {/* Months */}
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    letterSpacing: 1,
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  MONTH
                </Text>
                <FlatList
                  data={MONTHS}
                  keyExtractor={(_, i) => `m-${i}`}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item, index }) => {
                    const selected = index === draftMonth;
                    return (
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDraftMonth(index);
                        }}
                        style={{
                          paddingVertical: 12,
                          alignItems: 'center',
                          borderRadius: 10,
                          backgroundColor: selected ? colors.primary : 'transparent',
                          marginVertical: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? 'white' : colors.text,
                            fontWeight: selected ? '700' : '400',
                            fontSize: 15,
                          }}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>

              {/* Years */}
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    letterSpacing: 1,
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  YEAR
                </Text>
                <FlatList
                  data={years}
                  keyExtractor={(y) => `y-${y}`}
                  showsVerticalScrollIndicator={false}
                  initialScrollIndex={Math.max(0, years.indexOf(draftYear))}
                  getItemLayout={(_, i) => ({ length: 44, offset: 44 * i, index: i })}
                  renderItem={({ item }) => {
                    const selected = item === draftYear;
                    return (
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDraftYear(item);
                        }}
                        style={{
                          paddingVertical: 12,
                          alignItems: 'center',
                          borderRadius: 10,
                          backgroundColor: selected ? colors.primary : 'transparent',
                          marginVertical: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? 'white' : colors.text,
                            fontWeight: selected ? '700' : '400',
                            fontSize: 15,
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>
            <View style={{ height: 16 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
});
