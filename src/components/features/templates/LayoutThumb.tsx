/**
 * LayoutThumb — shared mini-resume preview.
 *
 * One central thumbnail renderer used by both the Templates picker page and
 * the in-resume preview screen's template switcher strip. Driven by the same
 * `getTemplateLayoutId` the PDF engine uses, so the preview matches the PDF
 * structurally (sidebar templates show a sidebar, banner shows a banner, etc.).
 *
 * Why centralized: previously the picker had 10 hand-coded "John Doe"
 * thumbnails — repetitive and unrealistic. Now one rich sample profile
 * (Sarah Chen, Senior Product Designer) drives every preview consistently.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { ResumeTemplate } from '@/types/template';
import { getTemplateLayoutId, type LayoutId } from '@/services/pdf/premiumHtmlEngine';

const SAMPLE = {
  name: 'Sarah Chen',
  initials: 'SC',
  title: 'Senior Product Designer',
  email: 'sarah.chen@email.com',
  location: 'San Francisco, CA',
  summary: 'Designer with 8+ years building consumer products at scale.',
  experience: [
    { title: 'Design Lead', company: 'Acme · 2022–Now', bullet: 'Led redesign that raised activation 34%' },
    { title: 'Product Designer', company: 'Nova · 2019–22', bullet: 'Shipped onboarding for 2M monthly users' },
  ],
  education: { degree: 'BFA Interaction Design', school: 'RISD · 2018' },
  skills: ['Figma', 'Webflow', 'Design Systems', 'Prototyping', 'User Research'],
} as const;

type Styles = ResumeTemplate['styles'];

function Bar({ width, color, height = 2, mt = 0 }: { width: number | string; color: string; height?: number; mt?: number }) {
  return (
    <View
      style={{
        width: width as any,
        height,
        backgroundColor: color,
        borderRadius: height / 2,
        marginTop: mt,
      }}
    />
  );
}

function SectionLabel({ text, color }: { text: string; color: string }) {
  return (
    <Text
      style={{
        fontSize: 4.2,
        fontWeight: '700',
        color,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginTop: 4,
        marginBottom: 1,
      }}
    >
      {text}
    </Text>
  );
}

function CleanHeader({ s, align = 'left' }: { s: Styles; align?: 'left' | 'center' }) {
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start', paddingHorizontal: 7, paddingTop: 7 }}>
      <Text style={{ fontSize: 7.5, fontWeight: '800', color: s.colors.text, letterSpacing: -0.2 }}>{SAMPLE.name}</Text>
      <Text style={{ fontSize: 4.5, color: s.colors.primary, marginTop: 1 }}>{SAMPLE.title}</Text>
      <Text style={{ fontSize: 3.4, color: s.colors.textLight, marginTop: 1.5 }}>
        {SAMPLE.email} · {SAMPLE.location}
      </Text>
      <View style={{ height: 0.6, backgroundColor: s.colors.primary, opacity: 0.4, width: '100%', marginTop: 4 }} />
    </View>
  );
}

function BodySections({ s }: { s: Styles }) {
  return (
    <View style={{ paddingHorizontal: 7 }}>
      <SectionLabel text="Experience" color={s.colors.primary} />
      {SAMPLE.experience.map((e, i) => (
        <View key={i} style={{ marginBottom: 2 }}>
          <Text style={{ fontSize: 3.8, fontWeight: '700', color: s.colors.text }}>{e.title}</Text>
          <Text style={{ fontSize: 3.4, color: s.colors.textLight }}>{e.company}</Text>
          <Bar width="90%" color={s.colors.border} mt={1} />
        </View>
      ))}
      <SectionLabel text="Education" color={s.colors.primary} />
      <Text style={{ fontSize: 3.6, color: s.colors.text }}>{SAMPLE.education.degree}</Text>
      <Text style={{ fontSize: 3.2, color: s.colors.textLight }}>{SAMPLE.education.school}</Text>
      <SectionLabel text="Skills" color={s.colors.primary} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {SAMPLE.skills.slice(0, 4).map((sk) => (
          <View
            key={sk}
            style={{
              paddingHorizontal: 3,
              paddingVertical: 1,
              borderRadius: 4,
              backgroundColor: s.colors.primary + '18',
            }}
          >
            <Text style={{ fontSize: 3, color: s.colors.primary, fontWeight: '600' }}>{sk}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Avatar({ size = 18, bg, fg }: { size?: number; bg: string; fg: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: fg }}>{SAMPLE.initials}</Text>
    </View>
  );
}

function SidebarPanel({ s, width = 48 }: { s: Styles; width?: number }) {
  return (
    <View style={{ width, backgroundColor: s.colors.primary, paddingHorizontal: 4, paddingVertical: 6 }}>
      <Avatar size={18} bg="rgba(255,255,255,0.25)" fg="white" />
      <Text
        style={{ fontSize: 4.2, fontWeight: '800', color: 'white', textAlign: 'center', marginTop: 2 }}
        numberOfLines={1}
      >
        {SAMPLE.name}
      </Text>
      <Text style={{ fontSize: 3, color: 'rgba(255,255,255,0.78)', textAlign: 'center' }} numberOfLines={1}>
        {SAMPLE.title}
      </Text>
      <SectionLabel text="Contact" color="rgba(255,255,255,0.85)" />
      <Text style={{ fontSize: 3, color: 'white' }} numberOfLines={1}>{SAMPLE.email}</Text>
      <Text style={{ fontSize: 3, color: 'white' }} numberOfLines={1}>{SAMPLE.location}</Text>
      <SectionLabel text="Skills" color="rgba(255,255,255,0.85)" />
      {SAMPLE.skills.slice(0, 4).map((sk) => (
        <Text key={sk} style={{ fontSize: 3, color: 'white', marginTop: 0.5 }}>• {sk}</Text>
      ))}
    </View>
  );
}

function MainColumn({ s }: { s: Styles }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 6, paddingVertical: 6 }}>
      <SectionLabel text="Summary" color={s.colors.primary} />
      <Text style={{ fontSize: 3.4, color: s.colors.text, lineHeight: 5 }}>{SAMPLE.summary}</Text>
      <SectionLabel text="Experience" color={s.colors.primary} />
      {SAMPLE.experience.map((e, i) => (
        <View key={i} style={{ marginBottom: 2 }}>
          <Text style={{ fontSize: 3.6, fontWeight: '700', color: s.colors.text }}>{e.title}</Text>
          <Text style={{ fontSize: 3.2, color: s.colors.textLight }}>{e.company}</Text>
          <Bar width="85%" color={s.colors.border} mt={0.8} />
          <Bar width="70%" color={s.colors.border} mt={1.2} />
        </View>
      ))}
    </View>
  );
}

const LAYOUTS: Record<LayoutId, (s: Styles) => React.ReactNode> = {
  'single-clean': (s) => (
    <View style={{ flex: 1, backgroundColor: s.colors.background }}>
      <CleanHeader s={s} align="center" />
      <BodySections s={s} />
    </View>
  ),
  'single-accent': (s) => (
    <View style={{ flex: 1, backgroundColor: s.colors.background, flexDirection: 'row' }}>
      <View style={{ width: 3, backgroundColor: s.colors.primary }} />
      <View style={{ flex: 1 }}>
        <CleanHeader s={s} align="left" />
        <BodySections s={s} />
      </View>
    </View>
  ),
  'sidebar-left': (s) => (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: s.colors.background }}>
      <SidebarPanel s={s} />
      <MainColumn s={s} />
    </View>
  ),
  'sidebar-right': (s) => (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: s.colors.background }}>
      <MainColumn s={s} />
      <SidebarPanel s={s} />
    </View>
  ),
  banner: (s) => (
    <View style={{ flex: 1, backgroundColor: s.colors.background }}>
      <View style={{ backgroundColor: s.colors.primary, paddingHorizontal: 7, paddingVertical: 6 }}>
        <Text style={{ fontSize: 8, fontWeight: '800', color: 'white' }}>{SAMPLE.name}</Text>
        <Text style={{ fontSize: 4.5, color: 'rgba(255,255,255,0.85)' }}>{SAMPLE.title}</Text>
        <Text style={{ fontSize: 3.3, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
          {SAMPLE.email} · {SAMPLE.location}
        </Text>
      </View>
      <BodySections s={s} />
    </View>
  ),
  'split-header': (s) => (
    <View style={{ flex: 1, backgroundColor: s.colors.background }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1.1, backgroundColor: s.colors.primary, padding: 6 }}>
          <Text style={{ fontSize: 7, fontWeight: '800', color: 'white' }}>{SAMPLE.name}</Text>
          <Text style={{ fontSize: 4, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>{SAMPLE.title}</Text>
        </View>
        <View style={{ flex: 0.9, padding: 6 }}>
          <Text style={{ fontSize: 3.2, color: s.colors.textLight }}>{SAMPLE.email}</Text>
          <Text style={{ fontSize: 3.2, color: s.colors.textLight, marginTop: 1 }}>{SAMPLE.location}</Text>
        </View>
      </View>
      <BodySections s={s} />
    </View>
  ),
  'two-column': (s) => (
    <View style={{ flex: 1, backgroundColor: s.colors.background }}>
      <CleanHeader s={s} align="left" />
      <View style={{ flexDirection: 'row', paddingHorizontal: 7, marginTop: 2 }}>
        <View style={{ width: '38%', paddingRight: 5, borderRightWidth: 0.5, borderRightColor: s.colors.border }}>
          <SectionLabel text="Skills" color={s.colors.primary} />
          {SAMPLE.skills.slice(0, 4).map((sk) => (
            <Text key={sk} style={{ fontSize: 3.2, color: s.colors.text, marginTop: 0.5 }}>• {sk}</Text>
          ))}
          <SectionLabel text="Edu" color={s.colors.primary} />
          <Text style={{ fontSize: 3.2, color: s.colors.text }}>{SAMPLE.education.degree}</Text>
        </View>
        <View style={{ flex: 1, paddingLeft: 5 }}>
          <SectionLabel text="Experience" color={s.colors.primary} />
          {SAMPLE.experience.map((e, i) => (
            <View key={i} style={{ marginBottom: 2 }}>
              <Text style={{ fontSize: 3.5, fontWeight: '700', color: s.colors.text }}>{e.title}</Text>
              <Text style={{ fontSize: 3.1, color: s.colors.textLight }}>{e.company}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  ),
  timeline: (s) => (
    <View style={{ flex: 1, backgroundColor: s.colors.background }}>
      <CleanHeader s={s} align="left" />
      <View style={{ paddingHorizontal: 7, paddingTop: 4 }}>
        <SectionLabel text="Experience" color={s.colors.primary} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 6, alignItems: 'center', paddingTop: 4 }}>
            <View style={{ width: 1, flex: 1, backgroundColor: s.colors.primary, opacity: 0.5 }} />
          </View>
          <View style={{ flex: 1, marginLeft: 4 }}>
            {SAMPLE.experience.map((e, i) => (
              <View key={i} style={{ marginBottom: 4, position: 'relative' }}>
                <View
                  style={{
                    position: 'absolute',
                    left: -7,
                    top: 2,
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: s.colors.primary,
                  }}
                />
                <Text style={{ fontSize: 3.6, fontWeight: '700', color: s.colors.text }}>{e.title}</Text>
                <Text style={{ fontSize: 3.2, color: s.colors.textLight }}>{e.company}</Text>
                <Text style={{ fontSize: 3, color: s.colors.text, marginTop: 0.5 }} numberOfLines={1}>· {e.bullet}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  ),
};

export function LayoutThumb({ template }: { template: ResumeTemplate }) {
  const layoutId = getTemplateLayoutId(template);
  const renderer = LAYOUTS[layoutId] ?? LAYOUTS['single-clean'];
  return <>{renderer(template.styles)}</>;
}

export default LayoutThumb;
