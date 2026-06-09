import React from 'react';
import { View, Text } from 'react-native';
import { Mail, Phone, MapPin } from 'lucide-react-native';
import { Resume } from '@/types/resume';
import { ResumeTemplate } from '@/types/template';
import { T, SPACE, FONTS, WEIGHT, SCREEN, LINE_HEIGHT, TRACKING } from './typeScale';

interface TemplateRendererProps {
  resume: Resume;
  template: ResumeTemplate;
}

/**
 * Inline contact row icon. Tiny wrapper so templates can drop in proper
 * lucide icons next to email/phone/location without inline emoji glyphs
 * (✉ ☎ ⚲ look like 90s clip-art on modern devices).
 */
function ContactIcon({
  type,
  color,
  size = 11,
}: {
  type: 'email' | 'phone' | 'location';
  color: string;
  size?: number;
}) {
  const Icon = type === 'email' ? Mail : type === 'phone' ? Phone : MapPin;
  return <Icon size={size} color={color} strokeWidth={2} />;
}

// Classic ATS Layout - Clean, centered, maximum readability
export const ClassicTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: SPACE.XXL }}>
      {/* Header - Centered */}
      <View style={{ alignItems: 'center', marginBottom: SPACE.XL, paddingBottom: SPACE.LG, borderBottomWidth: 2, borderBottomColor: colors.primary }}>
        <Text style={[T.name, { color: colors.text, marginBottom: SPACE.XS }]}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={[T.subheading, { color: colors.primary, marginBottom: SPACE.SM }]}>
          {resume.header.jobTitle || 'Professional Title'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACE.MD }}>
          {resume.header.contact.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS }}>
              <ContactIcon type="email" color={colors.textLight} size={11} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS }}>
              <ContactIcon type="phone" color={colors.textLight} size={11} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.phone}</Text>
            </View>
          )}
          {resume.header.contact.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS }}>
              <ContactIcon type="location" color={colors.textLight} size={11} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.location}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Summary */}
      {resume.summary && (
        <View style={{ marginBottom: SPACE.XL }}>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingBottom: SPACE.XS }]}>
            Professional Summary
          </Text>
          <Text style={[T.body, { color: colors.text }]}>{resume.summary}</Text>
        </View>
      )}

      {/* Experience */}
      {resume.experience.length > 0 && (
        <View style={{ marginBottom: SPACE.XL }}>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingBottom: SPACE.XS }]}>
            Work Experience
          </Text>
          {resume.experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: SPACE.LG }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={[T.subheading, { color: colors.text }]}>{exp.title}</Text>
                <Text style={[T.small, { color: colors.textLight }]}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
              </View>
              <Text style={[T.smallMedium, { color: colors.secondary, fontStyle: 'italic' }]}>
                {exp.company}{exp.location && ` • ${exp.location}`}
              </Text>
              {exp.description && (
                <Text style={[T.body, { color: colors.textLight, marginTop: SPACE.XS + 2 }]}>{exp.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Education */}
      {resume.education.length > 0 && (
        <View style={{ marginBottom: SPACE.XL }}>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingBottom: SPACE.XS }]}>
            Education
          </Text>
          {resume.education.map((edu) => (
            <View key={edu.id} style={{ marginBottom: SPACE.MD }}>
              <Text style={[T.subheading, { color: colors.text }]}>
                {edu.degree}{edu.field && ` in ${edu.field}`}
              </Text>
              <Text style={[T.smallMedium, { color: colors.secondary }]}>{edu.institution}</Text>
              <Text style={[T.small, { color: colors.textLight }]}>
                {edu.startDate} - {edu.endDate}{edu.gpa && ` • GPA: ${edu.gpa}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Skills */}
      {resume.skills.length > 0 && (
        <View>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingBottom: SPACE.XS }]}>
            Skills
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.SM }}>
            {resume.skills.map((skill) => (
              <View key={skill.id} style={{ backgroundColor: colors.primary + '15', paddingHorizontal: SPACE.MD, paddingVertical: SPACE.XS + 2, borderRadius: 4 }}>
                <Text style={[T.smallMedium, { color: colors.primary }]}>{skill.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// Banner Template - Colored header banner
export const BannerTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Banner Header */}
      <View style={{ backgroundColor: colors.primary, padding: SPACE.XXL, paddingTop: SPACE.XXXL, paddingBottom: SPACE.XXL + 4 }}>
        <Text style={[T.name, { color: 'white', marginBottom: SPACE.XS }]}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={[T.subheading, { color: 'rgba(255,255,255,0.92)', marginBottom: SPACE.MD }]}>
          {resume.header.jobTitle || 'Professional Title'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.MD + 2 }}>
          {resume.header.contact.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS }}>
              <ContactIcon type="email" color="rgba(255,255,255,0.85)" size={12} />
              <Text style={[T.small, { color: 'rgba(255,255,255,0.95)' }]}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS }}>
              <ContactIcon type="phone" color="rgba(255,255,255,0.85)" size={12} />
              <Text style={[T.small, { color: 'rgba(255,255,255,0.95)' }]}>{resume.header.contact.phone}</Text>
            </View>
          )}
          {resume.header.contact.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS }}>
              <ContactIcon type="location" color="rgba(255,255,255,0.85)" size={12} />
              <Text style={[T.small, { color: 'rgba(255,255,255,0.95)' }]}>{resume.header.contact.location}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={{ padding: SPACE.XXL }}>
        {/* Summary */}
        {resume.summary && (
          <View style={{ marginBottom: SPACE.XXL }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              PROFESSIONAL SUMMARY
            </Text>
            <Text style={[T.body, { color: colors.text }]}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View style={{ marginBottom: SPACE.XXL }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              EXPERIENCE
            </Text>
            {resume.experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: SPACE.LG, paddingLeft: SPACE.MD, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
                <Text style={[T.subheading, { color: colors.text }]}>{exp.title}</Text>
                <Text style={[T.smallMedium, { color: colors.secondary }]}>{exp.company} • {exp.startDate} - {exp.endDate || 'Present'}</Text>
                {exp.description && (
                  <Text style={[T.body, { color: colors.textLight, marginTop: SPACE.XS + 2 }]}>{exp.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <View style={{ marginBottom: SPACE.XXL }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              EDUCATION
            </Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: SPACE.MD }}>
                <Text style={[T.subheading, { color: colors.text }]}>
                  {edu.degree}{edu.field && ` in ${edu.field}`}
                </Text>
                <Text style={[T.small, { color: colors.textLight }]}>{edu.institution} • {edu.startDate} - {edu.endDate}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              SKILLS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.SM }}>
              {resume.skills.map((skill) => (
                <View key={skill.id} style={{ backgroundColor: colors.primary + '20', paddingHorizontal: SPACE.MD + 2, paddingVertical: SPACE.SM, borderRadius: 20 }}>
                  <Text style={[T.smallMedium, { color: colors.primary }]}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Sidebar Template - Two column with colored sidebar
export const SidebarTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      {/* Sidebar */}
      <View style={{ width: '35%', backgroundColor: colors.primary, padding: SPACE.XL, paddingTop: SPACE.XXXL }}>
        {/* Avatar */}
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: SPACE.LG, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[T.name, { color: 'white', fontSize: 30 }]}>
            {(resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </Text>
        </View>

        <Text style={[T.subheading, { color: 'white', textAlign: 'center', marginBottom: SPACE.XS, fontFamily: FONTS.bodyBold, fontWeight: WEIGHT.BOLD }]}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={[T.small, { color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: SPACE.XL }]}>
          {resume.header.jobTitle}
        </Text>

        {/* Contact */}
        <View style={{ marginBottom: SPACE.XXL }}>
          <Text style={[T.heading, { color: 'rgba(255,255,255,0.75)', marginBottom: SPACE.SM + 2, fontSize: 11 }]}>
            Contact
          </Text>
          {resume.header.contact.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.SM, marginBottom: SPACE.XS + 2 }}>
              <ContactIcon type="email" color="rgba(255,255,255,0.85)" size={11} />
              <Text style={[T.small, { color: 'white', flex: 1 }]} numberOfLines={1}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.SM, marginBottom: SPACE.XS + 2 }}>
              <ContactIcon type="phone" color="rgba(255,255,255,0.85)" size={11} />
              <Text style={[T.small, { color: 'white' }]}>{resume.header.contact.phone}</Text>
            </View>
          )}
          {resume.header.contact.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.SM }}>
              <ContactIcon type="location" color="rgba(255,255,255,0.85)" size={11} />
              <Text style={[T.small, { color: 'white' }]}>{resume.header.contact.location}</Text>
            </View>
          )}
        </View>

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View>
            <Text style={[T.heading, { color: 'rgba(255,255,255,0.75)', marginBottom: SPACE.SM + 2, fontSize: 11 }]}>
              Skills
            </Text>
            {resume.skills.map((skill) => (
              <View key={skill.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.SM }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'white', marginRight: SPACE.SM + 2 }} />
                <Text style={[T.small, { color: 'white' }]}>{skill.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Main Content */}
      <View style={{ flex: 1, padding: SPACE.XXL }}>
        {/* Summary */}
        {resume.summary && (
          <View style={{ marginBottom: SPACE.XXL }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              About Me
            </Text>
            <Text style={[T.body, { color: colors.text }]}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View style={{ marginBottom: SPACE.XXL }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              Experience
            </Text>
            {resume.experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: SPACE.LG }}>
                <Text style={[T.subheading, { color: colors.text }]}>{exp.title}</Text>
                <Text style={[T.smallMedium, { color: colors.primary, marginBottom: SPACE.XS }]}>{exp.company}</Text>
                <Text style={[T.small, { color: colors.textLight, marginBottom: SPACE.XS + 2 }]}>
                  {exp.startDate} - {exp.endDate || 'Present'}{exp.location && ` | ${exp.location}`}
                </Text>
                {exp.description && (
                  <Text style={[T.body, { color: colors.textLight }]}>{exp.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <View>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              Education
            </Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: SPACE.MD }}>
                <Text style={[T.subheading, { color: colors.text }]}>
                  {edu.degree}{edu.field && ` in ${edu.field}`}
                </Text>
                <Text style={[T.smallMedium, { color: colors.primary }]}>{edu.institution}</Text>
                <Text style={[T.small, { color: colors.textLight }]}>{edu.startDate} - {edu.endDate}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

// Modern Template - Clean with accent line
export const ModernTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      {/* Header with accent line */}
      <View style={{ flexDirection: 'row', marginBottom: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 4, backgroundColor: colors.primary, borderRadius: 2, marginRight: 16 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>
            {resume.header.fullName || 'Your Name'}
          </Text>
          <Text style={{ fontSize: 18, color: colors.primary, marginBottom: 10 }}>
            {resume.header.jobTitle || 'Professional Title'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {resume.header.contact.email && (
              <Text style={{ fontSize: 13, color: colors.textLight }}>{resume.header.contact.email}</Text>
            )}
            {resume.header.contact.phone && (
              <Text style={{ fontSize: 13, color: colors.textLight }}>{resume.header.contact.phone}</Text>
            )}
            {resume.header.contact.location && (
              <Text style={{ fontSize: 13, color: colors.textLight }}>{resume.header.contact.location}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Two Column Layout */}
      <View style={{ flexDirection: 'row', gap: 24 }}>
        {/* Left Column - Main Content */}
        <View style={{ flex: 2 }}>
          {/* Summary */}
          {resume.summary && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Profile
              </Text>
              <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>{resume.summary}</Text>
            </View>
          )}

          {/* Experience */}
          {resume.experience.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Experience
              </Text>
              {resume.experience.map((exp) => (
                <View key={exp.id} style={{ marginBottom: 18 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{exp.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.textLight }}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.primary, marginBottom: 6 }}>{exp.company}</Text>
                  {exp.description && (
                    <Text style={{ fontSize: 13, color: colors.textLight, lineHeight: 20 }}>{exp.description}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Right Column - Skills & Education */}
        <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 24 }}>
          {/* Skills */}
          {resume.skills.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Skills
              </Text>
              {resume.skills.map((skill) => (
                <View key={skill.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 10 }} />
                  <Text style={{ fontSize: 13, color: colors.text }}>{skill.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Education */}
          {resume.education.length > 0 && (
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Education
              </Text>
              {resume.education.map((edu) => (
                <View key={edu.id} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{edu.degree}</Text>
                  <Text style={{ fontSize: 13, color: colors.secondary }}>{edu.institution}</Text>
                  <Text style={{ fontSize: 12, color: colors.textLight }}>{edu.startDate} - {edu.endDate}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// Minimal Template - Ultra clean
export const MinimalTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: SPACE.XXXL }}>
      {/* Header */}
      <View style={{ marginBottom: SPACE.XXXL }}>
        <Text style={[T.name, { color: colors.text, fontSize: 32, letterSpacing: 2, textTransform: 'uppercase' }]}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={[T.body, { color: colors.textLight, letterSpacing: 1, marginTop: SPACE.XS }]}>
          {resume.header.jobTitle || 'Professional Title'}
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACE.LG, marginTop: SPACE.MD, flexWrap: 'wrap' }}>
          {resume.header.contact.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
              <ContactIcon type="email" color={colors.textLight} size={11} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
              <ContactIcon type="phone" color={colors.textLight} size={11} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.phone}</Text>
            </View>
          )}
          {resume.header.contact.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
              <ContactIcon type="location" color={colors.textLight} size={11} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.location}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Summary */}
      {resume.summary && (
        <View style={{ marginBottom: SPACE.XXL + 4 }}>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM, fontSize: 11 }]}>PROFILE</Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: SPACE.MD }} />
          <Text style={[T.body, { color: colors.text, lineHeight: SCREEN.BODY * 1.65 }]}>{resume.summary}</Text>
        </View>
      )}

      {/* Experience */}
      {resume.experience.length > 0 && (
        <View style={{ marginBottom: SPACE.XXL + 4 }}>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM, fontSize: 11 }]}>EXPERIENCE</Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: SPACE.MD }} />
          {resume.experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: SPACE.LG + 2 }}>
              <Text style={[T.subheading, { color: colors.text, fontWeight: WEIGHT.MEDIUM, fontFamily: FONTS.bodyMedium }]}>{exp.title}</Text>
              <Text style={[T.small, { color: colors.textLight }]}>{exp.company} — {exp.startDate} - {exp.endDate || 'Present'}</Text>
              {exp.description && (
                <Text style={[T.body, { color: colors.textLight, marginTop: SPACE.SM, lineHeight: SCREEN.BODY * 1.55 }]}>{exp.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Education */}
      {resume.education.length > 0 && (
        <View style={{ marginBottom: SPACE.XXL + 4 }}>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM, fontSize: 11 }]}>EDUCATION</Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: SPACE.MD }} />
          {resume.education.map((edu) => (
            <View key={edu.id} style={{ marginBottom: SPACE.MD }}>
              <Text style={[T.subheading, { color: colors.text, fontWeight: WEIGHT.MEDIUM, fontFamily: FONTS.bodyMedium }]}>{edu.degree}{edu.field && ` in ${edu.field}`}</Text>
              <Text style={[T.small, { color: colors.textLight }]}>{edu.institution} — {edu.startDate} - {edu.endDate}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Skills */}
      {resume.skills.length > 0 && (
        <View>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM, fontSize: 11 }]}>SKILLS</Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: SPACE.MD }} />
          <Text style={[T.body, { color: colors.text }]}>
            {resume.skills.map(s => s.name).join(' • ')}
          </Text>
        </View>
      )}
    </View>
  );
};

// Executive Template - Formal and sophisticated
export const ExecutiveTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: SPACE.XXL + 4 }}>
      {/* Header */}
      <View style={{ alignItems: 'center', marginBottom: SPACE.XXL, paddingBottom: SPACE.XL, borderBottomWidth: 2, borderBottomColor: colors.primary }}>
        {/* Playfair Display name — used ONLY for Executive + Academic
            templates. Per research: Playfair's thin strokes only work
            at large display sizes (24pt+). We keep tracking generous
            and skip uppercase here because Playfair's italic-like serif
            character carries the formality on its own. */}
        <Text style={[T.name, { color: colors.text, fontSize: 28, letterSpacing: 1.2, fontFamily: 'PlayfairDisplay_700Bold' }]}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={[T.subheading, { color: colors.primary, letterSpacing: 1.5, marginTop: SPACE.SM - 2, fontWeight: WEIGHT.REGULAR, fontFamily: FONTS.body }]}>
          {resume.header.jobTitle || 'Executive Title'}
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACE.MD + 2, marginTop: SPACE.SM + 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {resume.header.contact.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
              <ContactIcon type="location" color={colors.textLight} size={10} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.location}</Text>
            </View>
          )}
          {resume.header.contact.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
              <ContactIcon type="email" color={colors.textLight} size={10} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
              <ContactIcon type="phone" color={colors.textLight} size={10} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.phone}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Executive Summary */}
      {resume.summary && (
        <View style={{ marginBottom: SPACE.XXL }}>
          <Text style={[T.heading, { color: colors.primary, letterSpacing: 2, marginBottom: SPACE.SM + 2, fontSize: 11 }]}>EXECUTIVE SUMMARY</Text>
          <Text style={[T.body, { color: colors.text, lineHeight: SCREEN.BODY * 1.65, fontStyle: 'italic' }]}>{resume.summary}</Text>
        </View>
      )}

      {/* Professional Experience */}
      {resume.experience.length > 0 && (
        <View style={{ marginBottom: SPACE.XXL }}>
          <Text style={[T.heading, { color: colors.primary, letterSpacing: 2, marginBottom: SPACE.SM + 2, fontSize: 11 }]}>PROFESSIONAL EXPERIENCE</Text>
          {resume.experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: SPACE.LG + 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[T.subheading, { color: colors.text, fontWeight: WEIGHT.BOLD, fontFamily: FONTS.bodyBold }]}>{exp.title}</Text>
                <Text style={[T.small, { color: colors.textLight, fontStyle: 'italic' }]}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
              </View>
              <Text style={[T.body, { color: colors.secondary, marginBottom: SPACE.XS + 2 }]}>{exp.company}{exp.location && `, ${exp.location}`}</Text>
              {exp.description && (
                <Text style={[T.body, { color: colors.text }]}>{exp.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Education & Skills Row */}
      <View style={{ flexDirection: 'row', gap: SPACE.XXXL }}>
        {/* Education */}
        {resume.education.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={[T.heading, { color: colors.primary, letterSpacing: 2, marginBottom: SPACE.SM + 2, fontSize: 11 }]}>EDUCATION</Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: SPACE.SM + 2 }}>
                <Text style={[T.smallMedium, { color: colors.text, fontWeight: WEIGHT.SEMIBOLD, fontFamily: FONTS.bodySemibold, fontSize: SCREEN.SUBHEADING - 1 }]}>{edu.degree}{edu.field && `, ${edu.field}`}</Text>
                <Text style={[T.small, { color: colors.textLight }]}>{edu.institution}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Core Competencies */}
        {resume.skills.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={[T.heading, { color: colors.primary, letterSpacing: 2, marginBottom: SPACE.SM + 2, fontSize: 11 }]}>CORE COMPETENCIES</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.XS + 2 }}>
              {resume.skills.map((skill) => (
                <Text key={skill.id} style={[T.small, { color: colors.text }]}>• {skill.name}</Text>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Creative Template - Bold and artistic
export const CreativeTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Creative Header */}
      <View style={{ backgroundColor: colors.primary, padding: 24, paddingTop: 32, borderBottomLeftRadius: 40 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: 'white' }}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
          {resume.header.jobTitle || 'Creative Professional'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
          {resume.header.contact.email && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Text style={{ fontSize: 12, color: 'white' }}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Text style={{ fontSize: 12, color: 'white' }}>{resume.header.contact.phone}</Text>
            </View>
          )}
          {resume.header.contact.location && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Text style={{ fontSize: 12, color: 'white' }}>{resume.header.contact.location}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={{ padding: 24 }}>
        {/* Skills as Tags */}
        {resume.skills.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {resume.skills.map((skill) => (
                <View key={skill.id} style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25 }}>
                  <Text style={{ fontSize: 13, color: 'white', fontWeight: '600' }}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary */}
        {resume.summary && (
          <View style={{ marginBottom: 24, padding: 20, backgroundColor: colors.primary + '10', borderRadius: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.primary, marginBottom: 8 }}>About Me</Text>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.primary, marginBottom: 16 }}>Experience</Text>
            {resume.experience.map((exp, index) => (
              <View key={exp.id} style={{ flexDirection: 'row', marginBottom: 20 }}>
                <View style={{ width: 40, alignItems: 'center' }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />
                  {index < resume.experience.length - 1 && (
                    <View style={{ width: 2, flex: 1, backgroundColor: colors.primary + '30', marginTop: 4 }} />
                  )}
                </View>
                <View style={{ flex: 1, paddingLeft: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{exp.title}</Text>
                  <Text style={{ fontSize: 14, color: colors.primary }}>{exp.company}</Text>
                  <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 6 }}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                  {exp.description && (
                    <Text style={{ fontSize: 13, color: colors.textLight, lineHeight: 20 }}>{exp.description}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.primary, marginBottom: 12 }}>Education</Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: 12, padding: 16, backgroundColor: colors.background, borderWidth: 2, borderColor: colors.primary + '30', borderRadius: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{edu.degree}{edu.field && ` in ${edu.field}`}</Text>
                <Text style={{ fontSize: 14, color: colors.primary }}>{edu.institution}</Text>
                <Text style={{ fontSize: 12, color: colors.textLight }}>{edu.startDate} - {edu.endDate}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

// Timeline Template
export const TimelineTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: SPACE.XXL }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.XXL, paddingBottom: SPACE.XL, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 70, height: 70, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.XL }}>
          <Text style={[T.name, { color: 'white', fontSize: 26 }]}>
            {(resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[T.name, { color: colors.text }]}>{resume.header.fullName || 'Your Name'}</Text>
          <Text style={[T.subheading, { color: colors.primary, marginTop: 2 }]}>{resume.header.jobTitle}</Text>
          <View style={{ flexDirection: 'row', gap: SPACE.MD, marginTop: SPACE.SM, flexWrap: 'wrap' }}>
            {resume.header.contact.email && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
                <ContactIcon type="email" color={colors.textLight} size={10} />
                <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.email}</Text>
              </View>
            )}
            {resume.header.contact.phone && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
                <ContactIcon type="phone" color={colors.textLight} size={10} />
                <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.phone}</Text>
              </View>
            )}
            {resume.header.contact.location && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
                <ContactIcon type="location" color={colors.textLight} size={10} />
                <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.location}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Summary */}
      {resume.summary && (
        <View style={{ marginBottom: SPACE.XXL }}>
          <Text style={[T.body, { color: colors.text }]}>{resume.summary}</Text>
        </View>
      )}

      {/* Timeline Experience */}
      {resume.experience.length > 0 && (
        <View style={{ marginBottom: SPACE.XXL }}>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.LG }]}>
            Career Timeline
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 3, backgroundColor: colors.primary, borderRadius: 2 }} />
            <View style={{ flex: 1, paddingLeft: SPACE.XL }}>
              {resume.experience.map((exp, index) => (
                <View key={exp.id} style={{ marginBottom: SPACE.XL, position: 'relative' }}>
                  <View style={{ position: 'absolute', left: -26, top: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: index === 0 ? colors.primary : colors.primary + '60', borderWidth: 3, borderColor: colors.background }} />
                  <Text style={[T.smallMedium, { color: colors.primary, fontWeight: WEIGHT.SEMIBOLD, fontFamily: FONTS.bodySemibold }]}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                  <Text style={[T.subheading, { color: colors.text, marginTop: SPACE.XS }]}>{exp.title}</Text>
                  <Text style={[T.smallMedium, { color: colors.secondary }]}>{exp.company}</Text>
                  {exp.description && <Text style={[T.body, { color: colors.textLight, marginTop: SPACE.XS + 2 }]}>{exp.description}</Text>}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Skills & Education */}
      <View style={{ flexDirection: 'row', gap: SPACE.XXL }}>
        {resume.skills.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.MD }]}>Skills</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.SM }}>
              {resume.skills.map((skill) => (
                <View key={skill.id} style={{ backgroundColor: colors.primary + '15', paddingHorizontal: SPACE.MD, paddingVertical: SPACE.XS + 2, borderRadius: 6 }}>
                  <Text style={[T.small, { color: colors.primary }]}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {resume.education.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.MD }]}>Education</Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: SPACE.SM }}>
                <Text style={[T.smallMedium, { color: colors.text, fontWeight: WEIGHT.SEMIBOLD, fontFamily: FONTS.bodySemibold, fontSize: SCREEN.SUBHEADING - 1 }]}>{edu.degree}</Text>
                <Text style={[T.small, { color: colors.textLight }]}>{edu.institution}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

// Two Column Template
export const TwoColumnTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      {/* Left Column */}
      <View style={{ width: '38%', backgroundColor: colors.primary + '08', padding: SPACE.XL }}>
        {/* Avatar */}
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignSelf: 'center', marginBottom: SPACE.XL, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[T.name, { color: 'white', fontSize: 36 }]}>
            {(resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </Text>
        </View>

        {/* Contact */}
        <View style={{ marginBottom: SPACE.XXL }}>
          <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.MD }]}>Contact</Text>
          {resume.header.contact.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.SM, marginBottom: SPACE.SM }}>
              <ContactIcon type="email" color={colors.primary} size={11} />
              <Text style={[T.small, { color: colors.text, flex: 1 }]} numberOfLines={1}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.SM, marginBottom: SPACE.SM }}>
              <ContactIcon type="phone" color={colors.primary} size={11} />
              <Text style={[T.small, { color: colors.text }]}>{resume.header.contact.phone}</Text>
            </View>
          )}
          {resume.header.contact.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.SM }}>
              <ContactIcon type="location" color={colors.primary} size={11} />
              <Text style={[T.small, { color: colors.text }]}>{resume.header.contact.location}</Text>
            </View>
          )}
        </View>

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View style={{ marginBottom: SPACE.XXL }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.MD }]}>Skills</Text>
            {resume.skills.map((skill) => (
              <View key={skill.id} style={{ marginBottom: SPACE.SM + 2 }}>
                <Text style={[T.small, { color: colors.text, marginBottom: SPACE.XS }]}>{skill.name}</Text>
                <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2 }}>
                  <View style={{ height: 4, width: '85%', backgroundColor: colors.primary, borderRadius: 2 }} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <View>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.MD }]}>Education</Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: SPACE.MD }}>
                <Text style={[T.smallMedium, { color: colors.text, fontWeight: WEIGHT.SEMIBOLD, fontFamily: FONTS.bodySemibold }]}>{edu.degree}</Text>
                <Text style={[T.small, { color: colors.textLight }]}>{edu.institution}</Text>
                <Text style={[T.micro, { color: colors.textLight }]}>{edu.startDate} - {edu.endDate}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Right Column */}
      <View style={{ flex: 1, padding: SPACE.XXL }}>
        {/* Header */}
        <View style={{ marginBottom: SPACE.XL, paddingBottom: SPACE.LG, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={[T.name, { color: colors.text }]}>{resume.header.fullName || 'Your Name'}</Text>
          <Text style={[T.subheading, { color: colors.primary, marginTop: SPACE.XS }]}>{resume.header.jobTitle}</Text>
        </View>

        {/* Summary */}
        {resume.summary && (
          <View style={{ marginBottom: SPACE.XXL }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>About Me</Text>
            <Text style={[T.body, { color: colors.text }]}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>Experience</Text>
            {resume.experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: SPACE.LG + 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.subheading, { color: colors.text }]}>{exp.title}</Text>
                  <Text style={[T.small, { color: colors.textLight }]}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                </View>
                <Text style={[T.smallMedium, { color: colors.primary, marginBottom: SPACE.XS + 2 }]}>{exp.company}</Text>
                {exp.description && <Text style={[T.body, { color: colors.textLight }]}>{exp.description}</Text>}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

// Compact Template
export const CompactTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: SPACE.XL }}>
      {/* Compact Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACE.LG, paddingBottom: SPACE.MD, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View>
          <Text style={[T.name, { color: colors.text, fontSize: 24 }]}>{resume.header.fullName || 'Your Name'}</Text>
          <Text style={[T.smallMedium, { color: colors.primary }]}>{resume.header.jobTitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {resume.header.contact.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1, marginBottom: 2 }}>
              <ContactIcon type="email" color={colors.textLight} size={10} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1, marginBottom: 2 }}>
              <ContactIcon type="phone" color={colors.textLight} size={10} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.phone}</Text>
            </View>
          )}
          {resume.header.contact.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 1 }}>
              <ContactIcon type="location" color={colors.textLight} size={10} />
              <Text style={[T.small, { color: colors.textLight }]}>{resume.header.contact.location}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Summary */}
      {resume.summary && (
        <Text style={[T.body, { color: colors.text, marginBottom: SPACE.LG }]}>{resume.summary}</Text>
      )}

      {/* Two Column Content */}
      <View style={{ flexDirection: 'row', gap: SPACE.XL }}>
        {/* Left - Experience */}
        <View style={{ flex: 1 }}>
          {resume.experience.length > 0 && (
            <View style={{ marginBottom: SPACE.LG }}>
              <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM }]}>Experience</Text>
              {resume.experience.map((exp) => (
                <View key={exp.id} style={{ marginBottom: SPACE.MD }}>
                  <Text style={[T.smallMedium, { color: colors.text, fontWeight: WEIGHT.SEMIBOLD, fontFamily: FONTS.bodySemibold }]}>{exp.title}</Text>
                  <Text style={[T.small, { color: colors.secondary }]}>{exp.company}</Text>
                  <Text style={[T.micro, { color: colors.textLight }]}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                </View>
              ))}
            </View>
          )}

          {resume.education.length > 0 && (
            <View>
              <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM }]}>Education</Text>
              {resume.education.map((edu) => (
                <View key={edu.id} style={{ marginBottom: SPACE.SM }}>
                  <Text style={[T.smallMedium, { color: colors.text, fontWeight: WEIGHT.SEMIBOLD, fontFamily: FONTS.bodySemibold }]}>{edu.degree}</Text>
                  <Text style={[T.small, { color: colors.textLight }]}>{edu.institution}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Right - Skills */}
        {resume.skills.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM }]}>Skills</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.XS + 2 }}>
              {resume.skills.map((skill) => (
                <View key={skill.id} style={{ backgroundColor: colors.primary + '12', paddingHorizontal: SPACE.SM + 2, paddingVertical: 5, borderRadius: 4 }}>
                  <Text style={[T.small, { color: colors.primary }]}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Sidebar Right Template — mirror of SidebarTemplate. Used by templates
// whose PDF layout is `sidebar-right`: designer-pink, modern-pro-right.
export const SidebarRightTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      {/* Main Content (left) */}
      <View style={{ flex: 1, padding: SPACE.XXL }}>
        <Text style={[T.name, { color: colors.text, marginBottom: SPACE.XS }]}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={[T.subheading, { color: colors.primary, marginBottom: SPACE.XL }]}>
          {resume.header.jobTitle || 'Professional Title'}
        </Text>

        {resume.summary && (
          <View style={{ marginBottom: SPACE.XL + 2 }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              About
            </Text>
            <Text style={[T.body, { color: colors.text }]}>{resume.summary}</Text>
          </View>
        )}

        {resume.experience.length > 0 && (
          <View style={{ marginBottom: SPACE.XL + 2 }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              Experience
            </Text>
            {resume.experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: SPACE.MD + 2 }}>
                <Text style={[T.subheading, { color: colors.text }]}>{exp.title}</Text>
                <Text style={[T.smallMedium, { color: colors.primary }]}>{exp.company}</Text>
                <Text style={[T.small, { color: colors.textLight, marginBottom: SPACE.XS }]}>
                  {exp.startDate} - {exp.endDate || 'Present'}
                </Text>
                {exp.description && (
                  <Text style={[T.body, { color: colors.textLight }]}>{exp.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {resume.education.length > 0 && (
          <View>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              Education
            </Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: SPACE.SM + 2 }}>
                <Text style={[T.subheading, { color: colors.text, fontSize: SCREEN.SUBHEADING - 1 }]}>
                  {edu.degree}{edu.field && ` in ${edu.field}`}
                </Text>
                <Text style={[T.small, { color: colors.textLight }]}>{edu.institution}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Sidebar (right) */}
      <View style={{ width: '35%', backgroundColor: colors.primary, padding: SPACE.XL, paddingTop: SPACE.XXXL }}>
        {/* Avatar */}
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: SPACE.LG + 2, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[T.name, { color: 'white', fontSize: 26 }]}>
            {(resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </Text>
        </View>

        {/* Contact */}
        <View style={{ marginBottom: SPACE.XL + 2 }}>
          <Text style={[T.heading, { color: 'rgba(255,255,255,0.75)', marginBottom: SPACE.SM + 2, fontSize: 11 }]}>
            Contact
          </Text>
          {resume.header.contact.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.SM, marginBottom: SPACE.XS + 2 }}>
              <ContactIcon type="email" color="rgba(255,255,255,0.85)" size={11} />
              <Text style={[T.small, { color: 'white', flex: 1 }]} numberOfLines={1}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.SM, marginBottom: SPACE.XS + 2 }}>
              <ContactIcon type="phone" color="rgba(255,255,255,0.85)" size={11} />
              <Text style={[T.small, { color: 'white' }]}>{resume.header.contact.phone}</Text>
            </View>
          )}
          {resume.header.contact.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.SM }}>
              <ContactIcon type="location" color="rgba(255,255,255,0.85)" size={11} />
              <Text style={[T.small, { color: 'white' }]}>{resume.header.contact.location}</Text>
            </View>
          )}
        </View>

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View>
            <Text style={[T.heading, { color: 'rgba(255,255,255,0.75)', marginBottom: SPACE.SM + 2, fontSize: 11 }]}>
              Skills
            </Text>
            {resume.skills.map((skill) => (
              <View key={skill.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.XS + 3 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'white', marginRight: 9 }} />
                <Text style={[T.small, { color: 'white' }]}>{skill.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

// Split Header Template — full-width 2:1 header band, body below. Used by
// templates whose PDF layout is `split-header`: sleek-gradient, marketing-lead.
export const SplitHeaderTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Split Header — 2:1 ratio, name+title on left, contact on right */}
      <View style={{ flexDirection: 'row', minHeight: 130 }}>
        <View style={{ flex: 2, backgroundColor: colors.primary, padding: SPACE.XXL, paddingTop: SPACE.XXL + 6, justifyContent: 'center' }}>
          <Text style={[T.name, { color: 'white', fontFamily: FONTS.bodyHeavy, fontWeight: WEIGHT.HEAVY }]}>
            {resume.header.fullName || 'Your Name'}
          </Text>
          <Text style={[T.subheading, { color: 'rgba(255,255,255,0.92)', marginTop: SPACE.XS, fontWeight: WEIGHT.REGULAR, fontFamily: FONTS.body }]}>
            {resume.header.jobTitle || 'Professional Title'}
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.secondary || colors.primary, padding: SPACE.LG + 2, paddingTop: SPACE.XXL + 6, justifyContent: 'center' }}>
          <Text style={[T.heading, { color: 'white', marginBottom: SPACE.SM + 2, opacity: 0.85, fontSize: 10 }]}>
            Contact
          </Text>
          {resume.header.contact.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 2, marginBottom: SPACE.XS + 1 }}>
              <ContactIcon type="email" color="rgba(255,255,255,0.9)" size={10} />
              <Text style={[T.small, { color: 'white', flex: 1 }]} numberOfLines={1}>{resume.header.contact.email}</Text>
            </View>
          )}
          {resume.header.contact.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 2, marginBottom: SPACE.XS + 1 }}>
              <ContactIcon type="phone" color="rgba(255,255,255,0.9)" size={10} />
              <Text style={[T.small, { color: 'white' }]}>{resume.header.contact.phone}</Text>
            </View>
          )}
          {resume.header.contact.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.XS + 2 }}>
              <ContactIcon type="location" color="rgba(255,255,255,0.9)" size={10} />
              <Text style={[T.small, { color: 'white' }]}>{resume.header.contact.location}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Body */}
      <View style={{ padding: SPACE.XXL }}>
        {resume.summary && (
          <View style={{ marginBottom: SPACE.XL + 2 }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              Summary
            </Text>
            <Text style={[T.body, { color: colors.text }]}>{resume.summary}</Text>
          </View>
        )}

        {resume.experience.length > 0 && (
          <View style={{ marginBottom: SPACE.XL + 2 }}>
            <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
              Experience
            </Text>
            {resume.experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: SPACE.MD + 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.subheading, { color: colors.text }]}>{exp.title}</Text>
                  <Text style={[T.small, { color: colors.textLight }]}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                </View>
                <Text style={[T.smallMedium, { color: colors.primary, marginBottom: SPACE.XS }]}>{exp.company}</Text>
                {exp.description && (
                  <Text style={[T.body, { color: colors.textLight }]}>{exp.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: SPACE.XXL }}>
          {resume.education.length > 0 && (
            <View style={{ flex: 1 }}>
              <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
                Education
              </Text>
              {resume.education.map((edu) => (
                <View key={edu.id} style={{ marginBottom: SPACE.SM + 2 }}>
                  <Text style={[T.smallMedium, { color: colors.text, fontWeight: WEIGHT.SEMIBOLD, fontFamily: FONTS.bodySemibold, fontSize: SCREEN.SUBHEADING - 1 }]}>{edu.degree}</Text>
                  <Text style={[T.small, { color: colors.textLight }]}>{edu.institution}</Text>
                </View>
              ))}
            </View>
          )}
          {resume.skills.length > 0 && (
            <View style={{ flex: 1 }}>
              <Text style={[T.heading, { color: colors.primary, marginBottom: SPACE.SM + 2 }]}>
                Skills
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.XS + 2 }}>
                {resume.skills.map((skill) => (
                  <View key={skill.id} style={{ backgroundColor: colors.primary + '15', paddingHorizontal: SPACE.SM + 2, paddingVertical: SPACE.XS, borderRadius: 4 }}>
                    <Text style={[T.small, { color: colors.primary }]}>{skill.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/* Template router                                                            */
/*                                                                            */
/* SINGLE SOURCE OF TRUTH for which RN preview component renders each         */
/* template id. The corresponding PDF/HTML layout lives in                    */
/* `src/services/pdf/premiumHtmlEngine.ts` THEME_OVERRIDES — these MUST       */
/* stay in sync, otherwise the in-app preview shows one thing and the         */
/* exported PDF shows another (the v1.9 fix: previously 12 template ids       */
/* silently fell through to ClassicTemplate while their PDFs rendered as      */
/* completely different layouts — looked like false advertising).             */
/* -------------------------------------------------------------------------- */

const LAYOUT_BY_ID: Record<string, React.FC<TemplateRendererProps>> = {
  // single-clean
  'ats-classic': ClassicTemplate,
  'executive': ExecutiveTemplate,
  'minimal-clean': MinimalTemplate,
  'swiss-style': CompactTemplate,
  'academic-serif': ExecutiveTemplate,

  // single-accent (centered name + accent rule)
  'ats-professional': BannerTemplate,
  'consultant': BannerTemplate,
  'finance-navy': BannerTemplate,

  // sidebar-left
  'corporate-blue': SidebarTemplate,
  'modern-pro': SidebarTemplate,
  'engineer-mono': SidebarTemplate,
  'product-manager': SidebarTemplate,

  // sidebar-right
  'designer-pink': SidebarRightTemplate,
  'modern-pro-right': SidebarRightTemplate,

  // banner (full-width colored header band)
  'modern-tech': BannerTemplate,
  'startup-bold': BannerTemplate,
  'sales-energetic': BannerTemplate,

  // split-header
  'sleek-gradient': SplitHeaderTemplate,
  'marketing-lead': SplitHeaderTemplate,

  // two-column
  'creative-bold': TwoColumnTemplate,
  'designer-grid': TwoColumnTemplate,

  // timeline
  'timeline-pro': TimelineTemplate,
};

// Template selector function
export const getTemplateComponent = (templateId: string): React.FC<TemplateRendererProps> => {
  return LAYOUT_BY_ID[templateId] || ClassicTemplate;
};
