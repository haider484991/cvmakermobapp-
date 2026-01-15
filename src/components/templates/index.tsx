import React from 'react';
import { View, Text } from 'react-native';
import { Resume } from '@/types/resume';
import { ResumeTemplate } from '@/types/template';

interface TemplateRendererProps {
  resume: Resume;
  template: ResumeTemplate;
}

// Classic ATS Layout - Clean, centered, maximum readability
export const ClassicTemplate: React.FC<TemplateRendererProps> = ({ resume, template }) => {
  const { styles } = template;
  const { colors } = styles;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      {/* Header - Centered */}
      <View style={{ alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: colors.primary }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={{ fontSize: 18, color: colors.primary, marginBottom: 8 }}>
          {resume.header.jobTitle || 'Professional Title'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
          {resume.header.contact.email && (
            <Text style={{ fontSize: 13, color: colors.textLight }}>{resume.header.contact.email}</Text>
          )}
          {resume.header.contact.phone && (
            <Text style={{ fontSize: 13, color: colors.textLight }}>• {resume.header.contact.phone}</Text>
          )}
          {resume.header.contact.location && (
            <Text style={{ fontSize: 13, color: colors.textLight }}>• {resume.header.contact.location}</Text>
          )}
        </View>
      </View>

      {/* Summary */}
      {resume.summary && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingBottom: 4 }}>
            Professional Summary
          </Text>
          <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>
            {resume.summary}
          </Text>
        </View>
      )}

      {/* Experience */}
      {resume.experience.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingBottom: 4 }}>
            Work Experience
          </Text>
          {resume.experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{exp.title}</Text>
                <Text style={{ fontSize: 13, color: colors.textLight }}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
              </View>
              <Text style={{ fontSize: 14, color: colors.secondary, fontStyle: 'italic' }}>
                {exp.company}{exp.location && ` • ${exp.location}`}
              </Text>
              {exp.description && (
                <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 6, lineHeight: 20 }}>{exp.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Education */}
      {resume.education.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingBottom: 4 }}>
            Education
          </Text>
          {resume.education.map((edu) => (
            <View key={edu.id} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                {edu.degree}{edu.field && ` in ${edu.field}`}
              </Text>
              <Text style={{ fontSize: 14, color: colors.secondary }}>{edu.institution}</Text>
              <Text style={{ fontSize: 13, color: colors.textLight }}>
                {edu.startDate} - {edu.endDate}{edu.gpa && ` • GPA: ${edu.gpa}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Skills */}
      {resume.skills.length > 0 && (
        <View>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingBottom: 4 }}>
            Skills
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {resume.skills.map((skill) => (
              <View key={skill.id} style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 }}>
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>{skill.name}</Text>
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
      <View style={{ backgroundColor: colors.primary, padding: 24, paddingTop: 32, paddingBottom: 28 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 4 }}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)', marginBottom: 12 }}>
          {resume.header.jobTitle || 'Professional Title'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {resume.header.contact.email && (
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>✉ {resume.header.contact.email}</Text>
          )}
          {resume.header.contact.phone && (
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>☎ {resume.header.contact.phone}</Text>
          )}
          {resume.header.contact.location && (
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>⚲ {resume.header.contact.location}</Text>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={{ padding: 24 }}>
        {/* Summary */}
        {resume.summary && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary, marginBottom: 10 }}>
              PROFESSIONAL SUMMARY
            </Text>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary, marginBottom: 10 }}>
              EXPERIENCE
            </Text>
            {resume.experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: 16, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{exp.title}</Text>
                <Text style={{ fontSize: 14, color: colors.secondary }}>{exp.company} • {exp.startDate} - {exp.endDate || 'Present'}</Text>
                {exp.description && (
                  <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 6 }}>{exp.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary, marginBottom: 10 }}>
              EDUCATION
            </Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                  {edu.degree}{edu.field && ` in ${edu.field}`}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textLight }}>{edu.institution} • {edu.startDate} - {edu.endDate}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary, marginBottom: 10 }}>
              SKILLS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {resume.skills.map((skill) => (
                <View key={skill.id} style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>{skill.name}</Text>
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
      <View style={{ width: '35%', backgroundColor: colors.primary, padding: 20, paddingTop: 32 }}>
        {/* Avatar */}
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32, color: 'white', fontWeight: 'bold' }}>
            {(resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 4 }}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 20 }}>
          {resume.header.jobTitle}
        </Text>

        {/* Contact */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Contact
          </Text>
          {resume.header.contact.email && (
            <Text style={{ fontSize: 12, color: 'white', marginBottom: 6 }}>{resume.header.contact.email}</Text>
          )}
          {resume.header.contact.phone && (
            <Text style={{ fontSize: 12, color: 'white', marginBottom: 6 }}>{resume.header.contact.phone}</Text>
          )}
          {resume.header.contact.location && (
            <Text style={{ fontSize: 12, color: 'white' }}>{resume.header.contact.location}</Text>
          )}
        </View>

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Skills
            </Text>
            {resume.skills.map((skill) => (
              <View key={skill.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'white', marginRight: 10 }} />
                <Text style={{ fontSize: 13, color: 'white' }}>{skill.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Main Content */}
      <View style={{ flex: 1, padding: 24 }}>
        {/* Summary */}
        {resume.summary && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              About Me
            </Text>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Experience
            </Text>
            {resume.experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{exp.title}</Text>
                <Text style={{ fontSize: 14, color: colors.primary, marginBottom: 4 }}>{exp.company}</Text>
                <Text style={{ fontSize: 12, color: colors.textLight, marginBottom: 6 }}>
                  {exp.startDate} - {exp.endDate || 'Present'}{exp.location && ` | ${exp.location}`}
                </Text>
                {exp.description && (
                  <Text style={{ fontSize: 13, color: colors.textLight, lineHeight: 20 }}>{exp.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <View>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Education
            </Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                  {edu.degree}{edu.field && ` in ${edu.field}`}
                </Text>
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
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 32 }}>
      {/* Header */}
      <View style={{ marginBottom: 32 }}>
        <Text style={{ fontSize: 36, fontWeight: 'bold', color: colors.text, letterSpacing: 2, textTransform: 'uppercase' }}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={{ fontSize: 16, color: colors.textLight, letterSpacing: 1, marginTop: 4 }}>
          {resume.header.jobTitle || 'Professional Title'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
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

      {/* Summary */}
      {resume.summary && (
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, letterSpacing: 1, marginBottom: 8 }}>PROFILE</Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />
          <Text style={{ fontSize: 14, color: colors.text, lineHeight: 24 }}>{resume.summary}</Text>
        </View>
      )}

      {/* Experience */}
      {resume.experience.length > 0 && (
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, letterSpacing: 1, marginBottom: 8 }}>EXPERIENCE</Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />
          {resume.experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{exp.title}</Text>
              <Text style={{ fontSize: 14, color: colors.textLight }}>{exp.company} — {exp.startDate} - {exp.endDate || 'Present'}</Text>
              {exp.description && (
                <Text style={{ fontSize: 14, color: colors.textLight, marginTop: 8, lineHeight: 22 }}>{exp.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Education */}
      {resume.education.length > 0 && (
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, letterSpacing: 1, marginBottom: 8 }}>EDUCATION</Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />
          {resume.education.map((edu) => (
            <View key={edu.id} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>{edu.degree}{edu.field && ` in ${edu.field}`}</Text>
              <Text style={{ fontSize: 14, color: colors.textLight }}>{edu.institution} — {edu.startDate} - {edu.endDate}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Skills */}
      {resume.skills.length > 0 && (
        <View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, letterSpacing: 1, marginBottom: 8 }}>SKILLS</Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />
          <Text style={{ fontSize: 14, color: colors.text }}>
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
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 28 }}>
      {/* Header */}
      <View style={{ alignItems: 'center', marginBottom: 24, paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: colors.primary }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.text, letterSpacing: 2, textTransform: 'uppercase' }}>
          {resume.header.fullName || 'Your Name'}
        </Text>
        <Text style={{ fontSize: 16, color: colors.primary, letterSpacing: 1, marginTop: 6 }}>
          {resume.header.jobTitle || 'Executive Title'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
          {resume.header.contact.location && (
            <Text style={{ fontSize: 13, color: colors.textLight }}>{resume.header.contact.location}</Text>
          )}
          {resume.header.contact.email && (
            <Text style={{ fontSize: 13, color: colors.textLight }}>• {resume.header.contact.email}</Text>
          )}
          {resume.header.contact.phone && (
            <Text style={{ fontSize: 13, color: colors.textLight }}>• {resume.header.contact.phone}</Text>
          )}
        </View>
      </View>

      {/* Executive Summary */}
      {resume.summary && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, letterSpacing: 2, marginBottom: 10 }}>EXECUTIVE SUMMARY</Text>
          <Text style={{ fontSize: 14, color: colors.text, lineHeight: 24, fontStyle: 'italic' }}>{resume.summary}</Text>
        </View>
      )}

      {/* Professional Experience */}
      {resume.experience.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, letterSpacing: 2, marginBottom: 10 }}>PROFESSIONAL EXPERIENCE</Text>
          {resume.experience.map((exp) => (
            <View key={exp.id} style={{ marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{exp.title}</Text>
                <Text style={{ fontSize: 13, color: colors.textLight, fontStyle: 'italic' }}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
              </View>
              <Text style={{ fontSize: 15, color: colors.secondary, marginBottom: 6 }}>{exp.company}{exp.location && `, ${exp.location}`}</Text>
              {exp.description && (
                <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>{exp.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Education & Skills Row */}
      <View style={{ flexDirection: 'row', gap: 32 }}>
        {/* Education */}
        {resume.education.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, letterSpacing: 2, marginBottom: 10 }}>EDUCATION</Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{edu.degree}{edu.field && `, ${edu.field}`}</Text>
                <Text style={{ fontSize: 13, color: colors.textLight }}>{edu.institution}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Core Competencies */}
        {resume.skills.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, letterSpacing: 2, marginBottom: 10 }}>CORE COMPETENCIES</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {resume.skills.map((skill) => (
                <Text key={skill.id} style={{ fontSize: 13, color: colors.text }}>• {skill.name}</Text>
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
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 70, height: 70, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 20 }}>
          <Text style={{ fontSize: 28, color: 'white', fontWeight: 'bold' }}>
            {(resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.text }}>{resume.header.fullName || 'Your Name'}</Text>
          <Text style={{ fontSize: 16, color: colors.primary, marginTop: 2 }}>{resume.header.jobTitle}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            {resume.header.contact.email && <Text style={{ fontSize: 12, color: colors.textLight }}>{resume.header.contact.email}</Text>}
            {resume.header.contact.phone && <Text style={{ fontSize: 12, color: colors.textLight }}>{resume.header.contact.phone}</Text>}
          </View>
        </View>
      </View>

      {/* Summary */}
      {resume.summary && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>{resume.summary}</Text>
        </View>
      )}

      {/* Timeline Experience */}
      {resume.experience.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            Career Timeline
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 3, backgroundColor: colors.primary, borderRadius: 2 }} />
            <View style={{ flex: 1, paddingLeft: 20 }}>
              {resume.experience.map((exp, index) => (
                <View key={exp.id} style={{ marginBottom: 20, position: 'relative' }}>
                  <View style={{ position: 'absolute', left: -26, top: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: index === 0 ? colors.primary : colors.primary + '60', borderWidth: 3, borderColor: colors.background }} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 4 }}>{exp.title}</Text>
                  <Text style={{ fontSize: 14, color: colors.secondary }}>{exp.company}</Text>
                  {exp.description && <Text style={{ fontSize: 13, color: colors.textLight, marginTop: 6, lineHeight: 20 }}>{exp.description}</Text>}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Skills & Education */}
      <View style={{ flexDirection: 'row', gap: 24 }}>
        {resume.skills.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Skills</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {resume.skills.map((skill) => (
                <View key={skill.id} style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.primary }}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {resume.education.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Education</Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{edu.degree}</Text>
                <Text style={{ fontSize: 13, color: colors.textLight }}>{edu.institution}</Text>
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
      <View style={{ width: '38%', backgroundColor: colors.primary + '08', padding: 20 }}>
        {/* Avatar */}
        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primary, alignSelf: 'center', marginBottom: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 40, color: 'white', fontWeight: 'bold' }}>
            {(resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </Text>
        </View>

        {/* Contact */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Contact</Text>
          {resume.header.contact.email && <Text style={{ fontSize: 13, color: colors.text, marginBottom: 8 }}>{resume.header.contact.email}</Text>}
          {resume.header.contact.phone && <Text style={{ fontSize: 13, color: colors.text, marginBottom: 8 }}>{resume.header.contact.phone}</Text>}
          {resume.header.contact.location && <Text style={{ fontSize: 13, color: colors.text }}>{resume.header.contact.location}</Text>}
        </View>

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Skills</Text>
            {resume.skills.map((skill) => (
              <View key={skill.id} style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: colors.text, marginBottom: 4 }}>{skill.name}</Text>
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
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Education</Text>
            {resume.education.map((edu) => (
              <View key={edu.id} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{edu.degree}</Text>
                <Text style={{ fontSize: 12, color: colors.textLight }}>{edu.institution}</Text>
                <Text style={{ fontSize: 11, color: colors.textLight }}>{edu.startDate} - {edu.endDate}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Right Column */}
      <View style={{ flex: 1, padding: 24 }}>
        {/* Header */}
        <View style={{ marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>{resume.header.fullName || 'Your Name'}</Text>
          <Text style={{ fontSize: 16, color: colors.primary, marginTop: 4 }}>{resume.header.jobTitle}</Text>
        </View>

        {/* Summary */}
        {resume.summary && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>About Me</Text>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 22 }}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Experience</Text>
            {resume.experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{exp.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textLight }}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.primary, marginBottom: 6 }}>{exp.company}</Text>
                {exp.description && <Text style={{ fontSize: 13, color: colors.textLight, lineHeight: 20 }}>{exp.description}</Text>}
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
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
      {/* Compact Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>{resume.header.fullName || 'Your Name'}</Text>
          <Text style={{ fontSize: 14, color: colors.primary }}>{resume.header.jobTitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {resume.header.contact.email && <Text style={{ fontSize: 12, color: colors.textLight }}>{resume.header.contact.email}</Text>}
          {resume.header.contact.phone && <Text style={{ fontSize: 12, color: colors.textLight }}>{resume.header.contact.phone}</Text>}
          {resume.header.contact.location && <Text style={{ fontSize: 12, color: colors.textLight }}>{resume.header.contact.location}</Text>}
        </View>
      </View>

      {/* Summary */}
      {resume.summary && (
        <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20, marginBottom: 16 }}>{resume.summary}</Text>
      )}

      {/* Two Column Content */}
      <View style={{ flexDirection: 'row', gap: 20 }}>
        {/* Left - Experience */}
        <View style={{ flex: 1 }}>
          {resume.experience.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Experience</Text>
              {resume.experience.map((exp) => (
                <View key={exp.id} style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{exp.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.secondary }}>{exp.company}</Text>
                  <Text style={{ fontSize: 11, color: colors.textLight }}>{exp.startDate} - {exp.endDate || 'Present'}</Text>
                </View>
              ))}
            </View>
          )}

          {resume.education.length > 0 && (
            <View>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Education</Text>
              {resume.education.map((edu) => (
                <View key={edu.id} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{edu.degree}</Text>
                  <Text style={{ fontSize: 12, color: colors.textLight }}>{edu.institution}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Right - Skills */}
        {resume.skills.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Skills</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {resume.skills.map((skill) => (
                <View key={skill.id} style={{ backgroundColor: colors.primary + '12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.primary }}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Template selector function
export const getTemplateComponent = (templateId: string): React.FC<TemplateRendererProps> => {
  switch (templateId) {
    case 'ats-classic':
      return ClassicTemplate;
    case 'ats-professional':
      return BannerTemplate;
    case 'executive':
      return ExecutiveTemplate;
    case 'corporate-blue':
      return SidebarTemplate;
    case 'modern-tech':
      return ModernTemplate;
    case 'sleek-gradient':
      return TwoColumnTemplate;
    case 'creative-bold':
      return CreativeTemplate;
    case 'designer-pink':
      return TimelineTemplate;
    case 'minimal-clean':
      return MinimalTemplate;
    case 'swiss-style':
      return CompactTemplate;
    default:
      return ClassicTemplate;
  }
};
