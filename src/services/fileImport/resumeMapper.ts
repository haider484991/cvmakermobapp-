/**
 * Resume Mapper Service
 * Converts parsed resume data into the app's Resume format
 */

import type { ParsedResumeData, ImportStats } from '@/types/resumeImport';
import {
  Resume,
  WorkExperience,
  Education,
  Skill,
  Project,
  Certification,
  Language,
  Award,
  createEmptyResume,
} from '@/types/resume';

/**
 * Generate a unique ID for resume items
 */
function generateId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Normalize parsed data so EVERY array + nested object is present.
 *
 * CRITICAL: the AI (Gemini for PDF import, Grok for the wizard) frequently
 * OMITS keys for sections the resume doesn't have — e.g. a resume with no
 * awards comes back without an `awards` key at all, not `awards: []`. Any
 * downstream `data.awards.map(...)` or `data.awards.length` then throws
 * "Cannot read property of undefined", which crashed the import review
 * modal (blank screen after extraction) and the AI wizard apply step.
 *
 * Defaulting here once means every consumer is safe.
 */
export function normalizeParsedData(data: ParsedResumeData): ParsedResumeData {
  const header = data?.header ?? ({} as ParsedResumeData['header']);
  return {
    ...data,
    header: {
      ...header,
      fullName: header.fullName ?? '',
      jobTitle: header.jobTitle ?? '',
      contact: {
        ...(header.contact ?? {}),
        email: header.contact?.email ?? '',
        phone: header.contact?.phone ?? '',
        location: header.contact?.location ?? '',
        linkedin: header.contact?.linkedin ?? '',
        website: header.contact?.website ?? '',
        github: header.contact?.github ?? '',
      },
    },
    summary: data?.summary ?? '',
    experience: data?.experience ?? [],
    education: data?.education ?? [],
    skills: data?.skills ?? [],
    projects: data?.projects ?? [],
    certifications: data?.certifications ?? [],
    languages: data?.languages ?? [],
    awards: data?.awards ?? [],
  };
}

/**
 * Map parsed experience to WorkExperience
 */
function mapExperience(
  exp: ParsedResumeData['experience'][0]
): WorkExperience {
  return {
    id: generateId(),
    company: exp.company,
    title: exp.title,
    location: exp.location,
    startDate: exp.startDate,
    endDate: exp.endDate,
    isCurrentRole: exp.isCurrentRole,
    description: exp.description,
    bullets: exp.bullets,
  };
}

/**
 * Map parsed education to Education
 */
function mapEducation(edu: ParsedResumeData['education'][0]): Education {
  return {
    id: generateId(),
    institution: edu.institution,
    degree: edu.degree,
    field: edu.field,
    location: edu.location,
    startDate: edu.startDate,
    endDate: edu.endDate,
    gpa: edu.gpa,
    achievements: edu.achievements,
  };
}

/**
 * Map parsed skill to Skill
 */
function mapSkill(skill: ParsedResumeData['skills'][0]): Skill {
  return {
    id: generateId(),
    name: skill.name,
    level: skill.level,
    category: skill.category,
  };
}

/**
 * Map parsed project to Project
 */
function mapProject(proj: ParsedResumeData['projects'][0]): Project {
  return {
    id: generateId(),
    name: proj.name,
    description: proj.description,
    technologies: proj.technologies,
    link: proj.link,
    startDate: proj.startDate,
    endDate: proj.endDate,
  };
}

/**
 * Map parsed certification to Certification
 */
function mapCertification(cert: ParsedResumeData['certifications'][0]): Certification {
  return {
    id: generateId(),
    name: cert.name,
    issuer: cert.issuer,
    date: cert.date,
    expiryDate: cert.expiryDate,
    credentialId: cert.credentialId,
    link: cert.link,
  };
}

/**
 * Map parsed language to Language
 */
function mapLanguage(lang: ParsedResumeData['languages'][0]): Language {
  return {
    id: generateId(),
    name: lang.name,
    proficiency: lang.proficiency,
  };
}

/**
 * Map parsed award to Award
 */
function mapAward(award: ParsedResumeData['awards'][0]): Award {
  return {
    id: generateId(),
    title: award.title,
    issuer: award.issuer,
    date: award.date,
    description: award.description,
  };
}

/**
 * Create a new Resume from parsed data
 */
export function mapParsedDataToResume(
  rawData: ParsedResumeData,
  resumeName?: string
): Resume {
  // Normalize first so missing arrays/objects from the AI don't crash
  // the .map() calls below (the v1.9.0 "blank after extraction" bug).
  const data = normalizeParsedData(rawData);
  const name =
    resumeName ||
    (data.header.fullName ? `${data.header.fullName}'s Resume` : 'Imported Resume');
  const baseResume = createEmptyResume(name);

  // Map all sections
  const experience = data.experience.map(mapExperience);
  const education = data.education.map(mapEducation);
  const skills = data.skills.map(mapSkill);
  const projects = data.projects.map(mapProject);
  const certifications = data.certifications.map(mapCertification);
  const languages = data.languages.map(mapLanguage);
  const awards = data.awards.map(mapAward);

  // Update sections visibility based on content
  const sections = baseResume.sections.map((section) => {
    switch (section.type) {
      case 'projects':
        return { ...section, isVisible: projects.length > 0 };
      case 'certifications':
        return { ...section, isVisible: certifications.length > 0 };
      case 'languages':
        return { ...section, isVisible: languages.length > 0 };
      case 'awards':
        return { ...section, isVisible: awards.length > 0 };
      default:
        return section;
    }
  });

  // Add sections that might not be in default template
  const additionalSections = [];
  if (projects.length > 0 && !sections.find((s) => s.type === 'projects')) {
    additionalSections.push({
      id: generateId(),
      type: 'projects' as const,
      title: 'Projects',
      isVisible: true,
      order: sections.length,
    });
  }
  if (certifications.length > 0 && !sections.find((s) => s.type === 'certifications')) {
    additionalSections.push({
      id: generateId(),
      type: 'certifications' as const,
      title: 'Certifications',
      isVisible: true,
      order: sections.length + 1,
    });
  }
  if (languages.length > 0 && !sections.find((s) => s.type === 'languages')) {
    additionalSections.push({
      id: generateId(),
      type: 'languages' as const,
      title: 'Languages',
      isVisible: true,
      order: sections.length + 2,
    });
  }
  if (awards.length > 0 && !sections.find((s) => s.type === 'awards')) {
    additionalSections.push({
      id: generateId(),
      type: 'awards' as const,
      title: 'Awards',
      isVisible: true,
      order: sections.length + 3,
    });
  }

  return {
    ...baseResume,
    header: {
      fullName: data.header.fullName,
      jobTitle: data.header.jobTitle,
      contact: {
        email: data.header.contact.email,
        phone: data.header.contact.phone,
        location: data.header.contact.location,
        linkedin: data.header.contact.linkedin,
        website: data.header.contact.website,
        github: data.header.contact.github,
      },
    },
    summary: data.summary,
    experience,
    education,
    skills,
    projects,
    certifications,
    languages,
    awards,
    sections: [...sections, ...additionalSections],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge parsed data into an existing resume (avoiding duplicates)
 */
export function mergeParsedDataWithResume(
  data: ParsedResumeData,
  existingResume: Resume
): Resume {
  // Merge experiences avoiding duplicates
  const mergedExperience = mergeExperiences(
    existingResume.experience,
    data.experience.map(mapExperience)
  );

  // Merge education avoiding duplicates
  const mergedEducation = mergeEducation(
    existingResume.education,
    data.education.map(mapEducation)
  );

  // Merge skills avoiding duplicates
  const mergedSkills = mergeSkills(
    existingResume.skills,
    data.skills.map(mapSkill)
  );

  // Merge projects avoiding duplicates
  const mergedProjects = mergeProjects(
    existingResume.projects,
    data.projects.map(mapProject)
  );

  // Merge certifications avoiding duplicates
  const mergedCertifications = mergeCertifications(
    existingResume.certifications,
    data.certifications.map(mapCertification)
  );

  // Merge languages avoiding duplicates
  const mergedLanguages = mergeLanguages(
    existingResume.languages,
    data.languages.map(mapLanguage)
  );

  // Merge awards avoiding duplicates
  const mergedAwards = mergeAwards(
    existingResume.awards,
    data.awards.map(mapAward)
  );

  return {
    ...existingResume,
    header: {
      ...existingResume.header,
      fullName: data.header.fullName || existingResume.header.fullName,
      jobTitle: data.header.jobTitle || existingResume.header.jobTitle,
      contact: {
        email: data.header.contact.email || existingResume.header.contact.email,
        phone: data.header.contact.phone || existingResume.header.contact.phone,
        location: data.header.contact.location || existingResume.header.contact.location,
        linkedin: data.header.contact.linkedin || existingResume.header.contact.linkedin,
        website: data.header.contact.website || existingResume.header.contact.website,
        github: data.header.contact.github || existingResume.header.contact.github,
      },
    },
    summary: data.summary || existingResume.summary,
    experience: mergedExperience,
    education: mergedEducation,
    skills: mergedSkills,
    projects: mergedProjects,
    certifications: mergedCertifications,
    languages: mergedLanguages,
    awards: mergedAwards,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get import statistics for display in review modal
 */
export function getImportStats(rawData: ParsedResumeData): ImportStats {
  // Normalize so a resume missing whole sections (no awards key, etc.)
  // doesn't throw "Cannot read property 'length' of undefined" and blank
  // out the import review modal.
  const data = normalizeParsedData(rawData);
  const hasHeader = Boolean(data.header.fullName || data.header.contact.email);
  const hasSummary = Boolean(data.summary);

  return {
    totalSections:
      (hasHeader ? 1 : 0) +
      (hasSummary ? 1 : 0) +
      (data.experience.length > 0 ? 1 : 0) +
      (data.education.length > 0 ? 1 : 0) +
      (data.skills.length > 0 ? 1 : 0) +
      (data.projects.length > 0 ? 1 : 0) +
      (data.certifications.length > 0 ? 1 : 0) +
      (data.languages.length > 0 ? 1 : 0) +
      (data.awards.length > 0 ? 1 : 0),
    header: hasHeader,
    summary: hasSummary,
    experienceCount: data.experience.length,
    educationCount: data.education.length,
    skillsCount: data.skills.length,
    projectsCount: data.projects.length,
    certificationsCount: data.certifications.length,
    languagesCount: data.languages.length,
    awardsCount: data.awards.length,
  };
}

// Helper merge functions to avoid duplicates

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

function mergeEducation(existing: Education[], imported: Education[]): Education[] {
  const result = [...existing];
  const existingKeys = new Set(
    existing.map((e) => `${e.institution.toLowerCase()}_${e.degree.toLowerCase()}`)
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

function mergeProjects(existing: Project[], imported: Project[]): Project[] {
  const result = [...existing];
  const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

  for (const proj of imported) {
    if (!existingNames.has(proj.name.toLowerCase())) {
      result.push(proj);
    }
  }

  return result;
}

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

function mergeAwards(existing: Award[], imported: Award[]): Award[] {
  const result = [...existing];
  const existingNames = new Set(existing.map((a) => a.title.toLowerCase()));

  for (const award of imported) {
    if (!existingNames.has(award.title.toLowerCase())) {
      result.push(award);
    }
  }

  return result.sort((a, b) => {
    const dateA = a.date || '0000';
    const dateB = b.date || '0000';
    return dateB.localeCompare(dateA);
  });
}
