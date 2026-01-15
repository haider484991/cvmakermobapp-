/**
 * LinkedIn OAuth and Profile Types
 */

// LinkedIn OAuth Token Response
export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
  token_type: string;
}

// LinkedIn API Error Response
export interface LinkedInErrorResponse {
  error: string;
  error_description: string;
}

// LinkedIn Profile Picture
export interface LinkedInProfilePicture {
  displayImage: string;
  identifiers?: {
    identifier: string;
    mediaType: string;
    file: string;
    identifierType: string;
    identifierExpiresInSeconds?: number;
  }[];
}

// LinkedIn Date (month and year)
export interface LinkedInDate {
  month?: number;
  year?: number;
}

// LinkedIn Localized String
export interface LinkedInLocalizedString {
  localized: Record<string, string>;
  preferredLocale: {
    country: string;
    language: string;
  };
}

// LinkedIn Company Information
export interface LinkedInCompany {
  name?: string;
  localizedName?: string;
  logoUrl?: string;
  industry?: string;
}

// LinkedIn Position (Work Experience)
export interface LinkedInPosition {
  id?: string;
  title: string;
  companyName?: string;
  company?: LinkedInCompany;
  locationName?: string;
  location?: {
    country?: string;
    city?: string;
  };
  startDate?: LinkedInDate;
  endDate?: LinkedInDate;
  description?: string;
  isCurrent?: boolean;
}

// LinkedIn Experience (Collection of positions)
export interface LinkedInExperience {
  elements: LinkedInPosition[];
  paging?: {
    count: number;
    start: number;
    total: number;
  };
}

// LinkedIn School Information
export interface LinkedInSchool {
  name?: string;
  localizedName?: string;
  logoUrl?: string;
}

// LinkedIn Education Entry
export interface LinkedInEducationEntry {
  id?: string;
  schoolName?: string;
  school?: LinkedInSchool;
  degreeName?: string;
  fieldOfStudy?: string;
  startDate?: LinkedInDate;
  endDate?: LinkedInDate;
  activities?: string;
  notes?: string;
  grade?: string;
}

// LinkedIn Education (Collection of entries)
export interface LinkedInEducation {
  elements: LinkedInEducationEntry[];
  paging?: {
    count: number;
    start: number;
    total: number;
  };
}

// LinkedIn Skill
export interface LinkedInSkill {
  id?: string;
  name: string;
  proficiencyLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
}

// LinkedIn Skills (Collection)
export interface LinkedInSkills {
  elements: LinkedInSkill[];
  paging?: {
    count: number;
    start: number;
    total: number;
  };
}

// LinkedIn Certification
export interface LinkedInCertification {
  id?: string;
  name: string;
  authority?: string;
  licenseNumber?: string;
  displaySource?: string;
  url?: string;
  startDate?: LinkedInDate;
  endDate?: LinkedInDate;
}

// LinkedIn Certifications (Collection)
export interface LinkedInCertifications {
  elements: LinkedInCertification[];
  paging?: {
    count: number;
    start: number;
    total: number;
  };
}

// LinkedIn Language
export interface LinkedInLanguage {
  id?: string;
  name: string;
  proficiency?: 'ELEMENTARY' | 'LIMITED_WORKING' | 'PROFESSIONAL_WORKING' | 'FULL_PROFESSIONAL' | 'NATIVE_OR_BILINGUAL';
}

// LinkedIn Languages (Collection)
export interface LinkedInLanguages {
  elements: LinkedInLanguage[];
  paging?: {
    count: number;
    start: number;
    total: number;
  };
}

// LinkedIn Basic Profile (r_liteprofile scope)
export interface LinkedInBasicProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  firstName?: LinkedInLocalizedString;
  lastName?: LinkedInLocalizedString;
  profilePicture?: LinkedInProfilePicture;
  vanityName?: string;
}

// LinkedIn Email Address (r_emailaddress scope)
export interface LinkedInEmailAddress {
  elements: {
    'handle~': {
      emailAddress: string;
    };
    handle: string;
    type: string;
    primary?: boolean;
  }[];
}

// Full LinkedIn Profile (r_fullprofile scope - requires partnership)
export interface LinkedInFullProfile extends LinkedInBasicProfile {
  headline?: string;
  summary?: string;
  industryName?: string;
  locationName?: string;
  location?: {
    country?: {
      code: string;
      name?: string;
    };
    city?: string;
  };
  positions?: LinkedInExperience;
  education?: LinkedInEducation;
  skills?: LinkedInSkills;
  certifications?: LinkedInCertifications;
  languages?: LinkedInLanguages;
  websites?: {
    elements: {
      url: string;
      type: string;
      label?: string;
    }[];
  };
  phoneNumbers?: {
    elements: {
      number: string;
      type: string;
    }[];
  };
}

// Normalized LinkedIn Profile (used internally after parsing)
export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  headline?: string;
  summary?: string;
  profilePictureUrl?: string;
  industry?: string;
  location?: string;
  vanityName?: string;
  linkedInUrl?: string;
  phone?: string;
  website?: string;
  positions: LinkedInPosition[];
  educationEntries: LinkedInEducationEntry[];
  skills: LinkedInSkill[];
  certifications: LinkedInCertification[];
  languages: LinkedInLanguage[];
}

// LinkedIn Connection State
export interface LinkedInConnectionState {
  isConnected: boolean;
  accessToken: string | null;
  tokenExpiresAt: number | null;
  profile: LinkedInProfile | null;
}

// LinkedIn Import Result
export interface LinkedInImportResult {
  success: boolean;
  profile?: LinkedInProfile;
  error?: string;
}

// LinkedIn OAuth Configuration
export interface LinkedInOAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
}

// LinkedIn OAuth State
export type LinkedInAuthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'authenticating' }
  | { status: 'fetching_profile' }
  | { status: 'success'; profile: LinkedInProfile }
  | { status: 'error'; error: string };
