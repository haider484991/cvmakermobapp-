/**
 * Live Job Feed (v1.11) — the app becomes the START of the job search.
 *
 * Real remote jobs, searchable, pre-filled with the role the user gave during
 * onboarding. Tapping a job opens the detail screen where they can tailor
 * their resume to it in one tap — closing the find → tailor → apply loop that
 * previously required the user to go find a posting somewhere else and paste
 * it in by hand.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Search, MapPin, Briefcase, X, Building2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useJobStore } from '@/stores/jobStore';
import { searchJobs, jobAge } from '@/services/jobs/jobsApi';
import type { Job } from '@/types/jobs';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { gradientColors } from '@/constants/theme';

/** Quick-filter chips — broad categories that cover most job seekers. */
const QUICK_SEARCHES = [
  'Software Engineer',
  'Product Manager',
  'Designer',
  'Marketing',
  'Sales',
  'Customer Support',
  'Data Analyst',
  'Writer',
];

function JobCard({ job, onPress, colors, index }: { job: Job; onPress: () => void; colors: any; index: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 8) * 40).duration(300)}>
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* Company logo (or a fallback tile) */}
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              backgroundColor: colors.primary + '12',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              overflow: 'hidden',
            }}
          >
            {job.companyLogo ? (
              <Image source={{ uri: job.companyLogo }} style={{ width: 46, height: 46 }} resizeMode="contain" />
            ) : (
              <Building2 size={22} color={colors.primary} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={2}>
              {job.title}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {job.company}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <MapPin size={11} color={colors.primary} />
                <Text style={{ fontSize: 11, color: colors.primary, marginLeft: 3, fontWeight: '600' }} numberOfLines={1}>
                  {job.location}
                </Text>
              </View>
              {job.jobType ? (
                <View style={{ backgroundColor: colors.textSecondary + '12', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{job.jobType}</Text>
                </View>
              ) : null}
              {job.publishedAt ? (
                <Text style={{ fontSize: 11, color: colors.textMuted }}>{jobAge(job.publishedAt)}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function Jobs() {
  const router = useRouter();
  const { colors } = useTheme();
  const { hapticEnabled, onboardingProfile } = useUIStore();
  const { setActiveJob, lastQuery, setLastQuery } = useJobStore();

  // Seed the search with the role they told us during onboarding — the feed
  // is relevant the very first time they open it, with zero typing.
  const seed = lastQuery || onboardingProfile.targetRole?.trim() || '';
  const [query, setQuery] = useState(seed);
  const [submitted, setSubmitted] = useState(seed);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (q: string, isRefresh = false) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const { jobs: found } = await searchJobs(q, { signal: ctrl.signal });
        setJobs(found);
        track(ANALYTICS_EVENTS.JOBS_SEARCHED, { query: q.slice(0, 60), results: found.length });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setError("Couldn't load jobs. Check your connection and try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    track(ANALYTICS_EVENTS.JOBS_FEED_OPENED, { seeded: !!seed });
    load(submitted);
    return () => abortRef.current?.abort();
  }, []);

  const runSearch = useCallback(
    (q: string) => {
      Keyboard.dismiss();
      if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuery(q);
      setSubmitted(q);
      setLastQuery(q);
      load(q);
    },
    [load, hapticEnabled, setLastQuery],
  );

  const openJob = useCallback(
    (job: Job) => {
      if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveJob(job);
      track(ANALYTICS_EVENTS.JOB_VIEWED, { title: job.title.slice(0, 60), company: job.company.slice(0, 40) });
      router.push('/job-detail');
    },
    [router, setActiveJob, hapticEnabled],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={gradientColors.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: 'white' }}>Find Jobs</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
              Remote roles you can tailor your resume to in one tap
            </Text>

            {/* Search */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: 14,
                paddingHorizontal: 14,
                marginTop: 14,
              }}
            >
              <Search size={18} color="#64748B" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => runSearch(query)}
                placeholder="Job title or keyword"
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15, color: '#0F172A' }}
              />
              {query.length > 0 && (
                <Pressable onPress={() => runSearch('')} hitSlop={8}>
                  <X size={17} color="#64748B" />
                </Pressable>
              )}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Quick filters */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={QUICK_SEARCHES}
        keyExtractor={(t) => t}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 8 }}
        style={{ flexGrow: 0 }}
        renderItem={({ item }) => {
          const active = submitted.toLowerCase() === item.toLowerCase();
          return (
            <Pressable
              onPress={() => runSearch(item)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 100,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? 'white' : colors.text }}>{item}</Text>
            </Pressable>
          );
        }}
      />

      {/* Results */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.textSecondary }}>Finding jobs…</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📡</Text>
          <Text style={{ color: colors.text, fontWeight: '600', textAlign: 'center' }}>{error}</Text>
          <Pressable
            onPress={() => load(submitted)}
            style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 }}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>Try again</Text>
          </Pressable>
        </View>
      ) : jobs.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Briefcase size={40} color={colors.textMuted} />
          <Text style={{ color: colors.text, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
            No jobs found for “{submitted}”
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 6, textAlign: 'center', fontSize: 13 }}>
            Try a broader title, or tap one of the suggestions above.
          </Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(submitted, true);
              }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10, fontWeight: '600' }}>
              {jobs.length} REMOTE {jobs.length === 1 ? 'JOB' : 'JOBS'}
              {submitted ? ` · ${submitted.toUpperCase()}` : ''}
            </Text>
          }
          renderItem={({ item, index }) => (
            <JobCard job={item} index={index} colors={colors} onPress={() => openJob(item)} />
          )}
        />
      )}
    </View>
  );
}
