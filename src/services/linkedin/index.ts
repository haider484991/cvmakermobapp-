/**
 * LinkedIn Service Exports
 */

export { linkedInService } from './linkedinService';
export { default as linkedInServiceDefault } from './linkedinService';

export {
  mapLinkedInToResume,
  mapLinkedInToResumeWithStats,
  mapLinkedInToHeader,
  mapLinkedInExperience,
  mapLinkedInEducation,
  mapLinkedInSkills,
  mapLinkedInCertifications,
  mapLinkedInLanguages,
} from './profileMapper';

export type { LinkedInMappingResult } from './profileMapper';
