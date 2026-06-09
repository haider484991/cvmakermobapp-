export type SectionType =
  | 'header'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'languages'
  | 'awards'
  | 'custom';

export interface ContactInfo {
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
  github?: string;
}

export interface ResumeHeader {
  fullName: string;
  jobTitle: string;
  photo?: string;
  contact: ContactInfo;
}

export interface WorkExperience {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string | null;
  isCurrentRole: boolean;
  description: string;
  bullets: string[];
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  achievements?: string[];
}

export interface Skill {
  id: string;
  name: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  category?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  link?: string;
  startDate?: string;
  endDate?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
  link?: string;
}

export interface Language {
  id: string;
  name: string;
  proficiency: 'basic' | 'conversational' | 'professional' | 'native';
}

export interface Award {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description?: string;
}

export interface CustomSection {
  id: string;
  title: string;
  content: string;
}

export interface ResumeSection {
  id: string;
  type: SectionType;
  title: string;
  isVisible: boolean;
  order: number;
}

export interface Resume {
  id: string;
  name: string;
  templateId: string;
  /** Optional user-chosen accent color (hex). Re-colors the active
   *  template's brand surfaces via the per-template color picker. */
  accentColor?: string;
  createdAt: string;
  updatedAt: string;
  sections: ResumeSection[];
  header: ResumeHeader;
  summary: string;
  experience: WorkExperience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
  certifications: Certification[];
  languages: Language[];
  awards: Award[];
  customSections: CustomSection[];
}

export interface ResumeTemplate {
  id: string;
  name: string;
  category: 'ats-optimized' | 'professional' | 'modern' | 'creative' | 'minimal';
  atsScore: number;
  isPremium: boolean;
  thumbnail: string;
  styles: {
    fonts: {
      heading: string;
      body: string;
    };
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      text: string;
    };
    spacing: {
      sectionGap: number;
      itemGap: number;
      margins: number;
    };
  };
}

// Helper function to create a new empty resume
export const createEmptyResume = (name: string = 'Untitled Resume'): Resume => ({
  id: Date.now().toString(),
  name,
  templateId: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sections: [
    { id: '1', type: 'header', title: 'Header', isVisible: true, order: 0 },
    { id: '2', type: 'summary', title: 'Professional Summary', isVisible: true, order: 1 },
    { id: '3', type: 'experience', title: 'Work Experience', isVisible: true, order: 2 },
    { id: '4', type: 'education', title: 'Education', isVisible: true, order: 3 },
    { id: '5', type: 'skills', title: 'Skills', isVisible: true, order: 4 },
  ],
  header: {
    fullName: '',
    jobTitle: '',
    contact: {
      email: '',
      phone: '',
      location: '',
    },
  },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  awards: [],
  customSections: [],
});
