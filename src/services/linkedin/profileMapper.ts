/**
 * LinkedIn Profile to Resume Mapper
 * Converts LinkedIn profile data into the app's Resume format
 */

import {
  LinkedInProfile,
  LinkedInPosition,
  LinkedInEducationEntry,
  LinkedInSkill,
  LinkedInCertification,
  LinkedInLanguage,
  LinkedInDate,
} from '@/types/linkedin';
import {
  Resume,
  ResumeHeader,
  WorkExperience,
  Education,
  Skill,
  Certification,
  Language,
  createEmptyResume,
} from '@/types/resume';

/**
 * Convert LinkedIn date to formatted string (YYYY-MM)
 */
function formatLinkedInDate(date?: LinkedInDate): string {
  if (!date) return '';

  const year = date.year?.toString() || '';
  const month = date.month?.toString().padStart(2, '0') || '';

  if (year && month) {
    return `${year}-${month}`;
  }
  return year;
}

/**
 * Convert LinkedIn proficiency level to app's skill level
 */
function mapSkillLevel(
  proficiency?: LinkedInSkill['proficiencyLevel']
): Skill['level'] {
  switch (proficiency) {
    case 'BEGINNER':
      return 'beginner';
    case 'INTERMEDIATE':
      return 'intermediate';
    case 'ADVANCED':
      return 'advanced';
    case 'EXPERT':
      return 'expert';
    default:
      return undefined;
  }
}

/**
 * Convert LinkedIn language proficiency to app's language proficiency
 */
function mapLanguageProficiency(
  proficiency?: LinkedInLanguage['proficiency']
): Language['proficiency'] {
  switch (proficiency) {
    case 'ELEMENTARY':
      return 'basic';
    case 'LIMITED_WORKING':
      return 'conversational';
    case 'PROFESSIONAL_WORKING':
    case 'FULL_PROFESSIONAL':
      return 'professional';
    case 'NATIVE_OR_BILINGUAL':
      return 'native';
    default:
      return 'conversational';
  }
}

/**
 * Generate a unique ID for resume items
 */
function generateId(): string {
  return `li_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Map a single LinkedIn position to WorkExperience
 */
function mapPosition(position: LinkedInPosition): WorkExperience {
  return {
    id: position.id || generateId(),
    company: position.companyName || position.company?.name || '',
    title: position.title || '',
    location: position.locationName || position.location?.city || '',
    startDate: formatLinkedInDate(position.startDate),
    endDate: position.isCurrent ? null : formatLinkedInDate(position.endDate),
    isCurrentRole: position.isCurrent || false,
    description: position.description || '',
    bullets: position.description
      ? extractBulletsFromDescription(position.description)
      : [],
  };
}

/**
 * Extract bullet points from a description text
 */
function extractBulletsFromDescription(description: string): string[] {
  if (!description) return [];

  // Try to extract bullet points if they exist
  const lines = description.split(/[\n\r]+/);
  const bullets: string[] = [];

  for (const line of lines) {
    // Clean up the line
    const cleanLine = line
      .replace(/^[\s\-\*\u2022\u2023\u25E6\u2043\u2219]+/, '') // Remove bullet markers
      .trim();

    if (cleanLine && cleanLine.length > 10) {
      bullets.push(cleanLine);
    }
  }

  // If no bullets found but we have content, return description as single bullet
  if (bullets.length === 0 && description.trim()) {
    return [description.trim()];
  }

  return bullets.slice(0, 5); // Limit to 5 bullets
}

/**
 * Map a single LinkedIn education entry to Education
 */
function mapEducationEntry(entry: LinkedInEducationEntry): Education {
  return {
    id: entry.id || generateId(),
    institution: entry.schoolName || entry.school?.name || '',
    degree: entry.degreeName || '',
    field: entry.fieldOfStudy || '',
    location: '',
    startDate: formatLinkedInDate(entry.startDate),
    endDate: formatLinkedInDate(entry.endDate),
    gpa: entry.grade,
    achievements: entry.activities
      ? extractBulletsFromDescription(entry.activities)
      : undefined,
  };
}

/**
 * Map a single LinkedIn skill to Skill
 */
function mapSkill(skill: LinkedInSkill): Skill {
  return {
    id: skill.id || generateId(),
    name: skill.name,
    level: mapSkillLevel(skill.proficiencyLevel),
  };
}

/**
 * Map a single LinkedIn certification to Certification
 */
function mapCertification(cert: LinkedInCertification): Certification {
  return {
    id: cert.id || generateId(),
    name: cert.name,
    issuer: cert.authority || '',
    date: formatLinkedInDate(cert.startDate),
    expiryDate: cert.endDate ? formatLinkedInDate(cert.endDate) : undefined,
    credentialId: cert.licenseNumber,
    link: cert.url,
  };
}

/**
 * Map a single LinkedIn language to Language
 */
function mapLanguage(lang: LinkedInLanguage): Language {
  return {
    id: lang.id || generateId(),
    name: lang.name,
    proficiency: mapLanguageProficiency(lang.proficiency),
  };
}

/**
 * Map LinkedIn positions to WorkExperience array
 */
export function mapLinkedInExperience(
  positions: LinkedInPosition[]
): WorkExperience[] {
  if (!positions || positions.length === 0) return [];

  return positions.map(mapPosition).sort((a, b) => {
    // Sort by start date descending (most recent first)
    const dateA = a.startDate || '0000';
    const dateB = b.startDate || '0000';
    return dateB.localeCompare(dateA);
  });
}

/**
 * Map LinkedIn education entries to Education array
 */
export function mapLinkedInEducation(
  entries: LinkedInEducationEntry[]
): Education[] {
  if (!entries || entries.length === 0) return [];

  return entries.map(mapEducationEntry).sort((a, b) => {
    // Sort by end date descending (most recent first)
    const dateA = a.endDate || '0000';
    const dateB = b.endDate || '0000';
    return dateB.localeCompare(dateA);
  });
}

/**
 * Map LinkedIn skills to Skill array
 */
export function mapLinkedInSkills(skills: LinkedInSkill[]): Skill[] {
  if (!skills || skills.length === 0) return [];

  return skills.map(mapSkill);
}

/**
 * Map LinkedIn certifications to Certification array
 */
export function mapLinkedInCertifications(
  certifications: LinkedInCertification[]
): Certification[] {
  if (!certifications || certifications.length === 0) return [];

  return certifications.map(mapCertification).sort((a, b) => {
    // Sort by date descending
    const dateA = a.date || '0000';
    const dateB = b.date || '0000';
    return dateB.localeCompare(dateA);
  });
}

/**
 * Map LinkedIn languages to Language array
 */
export function mapLinkedInLanguages(languages: LinkedInLanguage[]): Language[] {
  if (!languages || languages.length === 0) return [];

  return languages.map(mapLanguage);
}

/**
 * Create resume header from LinkedIn profile
 */
export function mapLinkedInToHeader(profile: LinkedInProfile): ResumeHeader {
  return {
    fullName: profile.fullName,
    jobTitle: profile.headline || '',
    photo: profile.profilePictureUrl,
    contact: {
      email: profile.email,
      phone: profile.phone || '',
      location: profile.location || '',
      linkedin: profile.linkedInUrl || profile.vanityName
        ? `linkedin.com/in/${profile.vanityName}`
        : undefined,
      website: profile.website,
    },
  };
}

/**
 * Main function to map complete LinkedIn profile to Resume
 */
export function mapLinkedInToResume(
  profile: LinkedInProfile,
  existingResume?: Resume
): Resume {
  // Start with existing resume or create new one
  const baseResume = existingResume
    ? { ...existingResume }
    : createEmptyResume(`${profile.firstName}'s Resume`);

  // Map all profile sections
  const header = mapLinkedInToHeader(profile);
  const experience = mapLinkedInExperience(profile.positions);
  const education = mapLinkedInEducation(profile.educationEntries);
  const skills = mapLinkedInSkills(profile.skills);
  const certifications = mapLinkedInCertifications(profile.certifications);
  const languages = mapLinkedInLanguages(profile.languages);

  // If merging with existing resume, combine arrays intelligently
  if (existingResume) {
    return {
      ...baseResume,
      header: {
        ...baseResume.header,
        fullName: header.fullName || baseResume.header.fullName,
        jobTitle: header.jobTitle || baseResume.header.jobTitle,
        photo: header.photo || baseResume.header.photo,
        contact: {
          ...baseResume.header.contact,
          email: header.contact.email || baseResume.header.contact.email,
          phone: header.contact.phone || baseResume.header.contact.phone,
          location: header.contact.location || baseResume.header.contact.location,
          linkedin: header.contact.linkedin || baseResume.header.contact.linkedin,
          website: header.contact.website || baseResume.header.contact.website,
        },
      },
      summary: profile.summary || baseResume.summary,
      experience: mergeExperiences(baseResume.experience, experience),
      education: mergeEducation(baseResume.education, education),
      skills: mergeSkills(baseResume.skills, skills),
      certifications: mergeCertifications(baseResume.certifications, certifications),
      languages: mergeLanguages(baseResume.languages, languages),
      updatedAt: new Date().toISOString(),
    };
  }

  // Create fresh resume from LinkedIn data
  return {
    ...baseResume,
    header,
    summary: profile.summary || '',
    experience,
    education,
    skills,
    certifications,
    languages,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge experience arrays, avoiding duplicates based on company + title
 */
function mergeExperiences(
  existing: WorkExperience[],
  imported: WorkExperience[]
): WorkExperience[] {
  const result = [...existing];
  const existingKeys = new Set(
    existing.map((e) => `${e.company.toLowerCase()}_${e.title.toLowerCase()}`)
  );

  for (const exp of imported) {
    const key = `${exp.company.toLowerCase()}_${exp.title.toLowerCase()}`;
    if (!existingKeys.has(key)) {
      result.push(exp);
    }
  }

  return result.sort((a, b) => {
    const dateA = a.startDate || '0000';
    const dateB = b.startDate || '0000';
    return dateB.localeCompare(dateA);
  });
}

/**
 * Merge education arrays, avoiding duplicates based on institution + degree
 */
function mergeEducation(existing: Education[], imported: Education[]): Education[] {
  const result = [...existing];
  const existingKeys = new Set(
    existing.map(
      (e) => `${e.institution.toLowerCase()}_${e.degree.toLowerCase()}`
    )
  );

  for (const edu of imported) {
    const key = `${edu.institution.toLowerCase()}_${edu.degree.toLowerCase()}`;
    if (!existingKeys.has(key)) {
      result.push(edu);
    }
  }

  return result.sort((a, b) => {
    const dateA = a.endDate || '0000';
    const dateB = b.endDate || '0000';
    return dateB.localeCompare(dateA);
  });
}

/**
 * Merge skill arrays, avoiding duplicates based on name
 */
function mergeSkills(existing: Skill[], imported: Skill[]): Skill[] {
  const result = [...existing];
  const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));

  for (const skill of imported) {
    if (!existingNames.has(skill.name.toLowerCase())) {
      result.push(skill);
    }
  }

  return result;
}

/**
 * Merge certification arrays, avoiding duplicates based on name
 */
function mergeCertifications(
  existing: Certification[],
  imported: Certification[]
): Certification[] {
  const result = [...existing];
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

  for (const cert of imported) {
    if (!existingNames.has(cert.name.toLowerCase())) {
      result.push(cert);
    }
  }

  return result.sort((a, b) => {
    const dateA = a.date || '0000';
    const dateB = b.date || '0000';
    return dateB.localeCompare(dateA);
  });
}

/**
 * Merge language arrays, avoiding duplicates based on name
 */
function mergeLanguages(existing: Language[], imported: Language[]): Language[] {
  const result = [...existing];
  const existingNames = new Set(existing.map((l) => l.name.toLowerCase()));

  for (const lang of imported) {
    if (!existingNames.has(lang.name.toLowerCase())) {
      result.push(lang);
    }
  }

  return result;
}

/**
 * Export mapping result interface for type safety
 */
export interface LinkedInMappingResult {
  resume: Resume;
  importedSections: {
    header: boolean;
    summary: boolean;
    experience: number;
    education: number;
    skills: number;
    certifications: number;
    languages: number;
  };
}

/**
 * Map LinkedIn profile to resume with import statistics
 */
export function mapLinkedInToResumeWithStats(
  profile: LinkedInProfile,
  existingResume?: Resume
): LinkedInMappingResult {
  const resume = mapLinkedInToResume(profile, existingResume);

  return {
    resume,
    importedSections: {
      header: Boolean(profile.fullName),
      summary: Boolean(profile.summary),
      experience: profile.positions.length,
      education: profile.educationEntries.length,
      skills: profile.skills.length,
      certifications: profile.certifications.length,
      languages: profile.languages.length,
    },
  };
}
