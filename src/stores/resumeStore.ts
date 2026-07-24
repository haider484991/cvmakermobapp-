import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Resume,
  ResumeSection,
  SectionType,
  WorkExperience,
  Education,
  Skill,
  Project,
  Certification,
  Language,
  Award,
  CustomSection,
  createEmptyResume,
} from '@/types/resume';

interface ResumeState {
  resumes: Record<string, Resume>;
  activeResumeId: string | null;
  activeSection: string | null;
  isDirty: boolean;

  // Actions
  createResume: (name?: string) => string;
  importResume: (resume: Resume) => string;
  deleteResume: (id: string) => void;
  duplicateResume: (id: string) => string;
  setActiveResume: (id: string | null) => void;
  setActiveSection: (sectionId: string | null) => void;

  // Update actions
  updateResumeName: (id: string, name: string) => void;
  updateHeader: (id: string, header: Partial<Resume['header']>) => void;
  setAccentColor: (id: string, accentColor: string | null) => void;
  updateSummary: (id: string, summary: string) => void;
  updateTemplate: (id: string, templateId: string) => void;

  // Section management
  reorderSections: (id: string, sections: ResumeSection[]) => void;
  toggleSectionVisibility: (resumeId: string, sectionId: string) => void;

  // Experience
  addExperience: (resumeId: string, experience: WorkExperience) => void;
  updateExperience: (resumeId: string, experienceId: string, data: Partial<WorkExperience>) => void;
  deleteExperience: (resumeId: string, experienceId: string) => void;

  // Education
  addEducation: (resumeId: string, education: Education) => void;
  updateEducation: (resumeId: string, educationId: string, data: Partial<Education>) => void;
  deleteEducation: (resumeId: string, educationId: string) => void;

  // Skills
  addSkill: (resumeId: string, skill: Skill) => void;
  updateSkill: (resumeId: string, skillId: string, data: Partial<Skill>) => void;
  deleteSkill: (resumeId: string, skillId: string) => void;

  // Projects
  addProject: (resumeId: string, project: Project) => void;
  updateProject: (resumeId: string, projectId: string, data: Partial<Project>) => void;
  deleteProject: (resumeId: string, projectId: string) => void;

  // Certifications
  addCertification: (resumeId: string, item: Certification) => void;
  updateCertification: (resumeId: string, itemId: string, data: Partial<Certification>) => void;
  deleteCertification: (resumeId: string, itemId: string) => void;

  // Languages
  addLanguage: (resumeId: string, item: Language) => void;
  updateLanguage: (resumeId: string, itemId: string, data: Partial<Language>) => void;
  deleteLanguage: (resumeId: string, itemId: string) => void;

  // Awards
  addAward: (resumeId: string, item: Award) => void;
  updateAward: (resumeId: string, itemId: string, data: Partial<Award>) => void;
  deleteAward: (resumeId: string, itemId: string) => void;

  // Custom sections
  addCustomSection: (resumeId: string, item: CustomSection) => void;
  updateCustomSection: (resumeId: string, itemId: string, data: Partial<CustomSection>) => void;
  deleteCustomSection: (resumeId: string, itemId: string) => void;

  /** Move an entry up/down inside one of the list sections. */
  moveItem: (
    resumeId: string,
    list: 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'languages' | 'awards' | 'customSections',
    itemId: string,
    direction: 'up' | 'down',
  ) => void;
  /** Move a whole section up/down in the resume's section order. */
  moveSection: (resumeId: string, sectionId: string, direction: 'up' | 'down') => void;
  /** Add an optional section (projects, certifications, languages, awards, custom). */
  addSection: (resumeId: string, type: SectionType, title: string) => void;
  /** Remove a section entry (does not delete the underlying data). */
  removeSection: (resumeId: string, sectionId: string) => void;

  // Sync
  setResumes: (resumes: Resume[]) => void;
  mergeResumes: (serverResumes: Resume[]) => void;

  // Getters
  getActiveResume: () => Resume | null;
  getResume: (id: string) => Resume | null;
  getAllResumes: () => Resume[];
}

/* --------------------------------------------------------------------------
 * Generic list mutators.
 *
 * certifications / languages / awards / customSections all store a flat array
 * of `{ id, ... }` on the resume and need identical add/update/delete logic.
 * These return zustand updater functions so each action stays a one-liner
 * instead of four near-identical 40-line blocks.
 * -------------------------------------------------------------------------- */

type ListKey = 'certifications' | 'languages' | 'awards' | 'customSections';

function listAdd(resumeId: string, key: ListKey, item: { id: string }) {
  return (state: ResumeState): Partial<ResumeState> => {
    const resume = state.resumes[resumeId];
    if (!resume) return state;
    const list = [...((resume[key] as any[]) ?? []), item];
    return {
      resumes: { ...state.resumes, [resumeId]: { ...resume, [key]: list, updatedAt: new Date().toISOString() } },
      isDirty: true,
    };
  };
}

function listUpdate(resumeId: string, key: ListKey, itemId: string, data: object) {
  return (state: ResumeState): Partial<ResumeState> => {
    const resume = state.resumes[resumeId];
    if (!resume) return state;
    const list = ((resume[key] as any[]) ?? []).map((x) => (x?.id === itemId ? { ...x, ...data } : x));
    return {
      resumes: { ...state.resumes, [resumeId]: { ...resume, [key]: list, updatedAt: new Date().toISOString() } },
      isDirty: true,
    };
  };
}

function listDelete(resumeId: string, key: ListKey, itemId: string) {
  return (state: ResumeState): Partial<ResumeState> => {
    const resume = state.resumes[resumeId];
    if (!resume) return state;
    const list = ((resume[key] as any[]) ?? []).filter((x) => x?.id !== itemId);
    return {
      resumes: { ...state.resumes, [resumeId]: { ...resume, [key]: list, updatedAt: new Date().toISOString() } },
      isDirty: true,
    };
  };
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      resumes: {},
      activeResumeId: null,
      activeSection: null,
      isDirty: false,

      createResume: (name) => {
        const resume = createEmptyResume(name);
        set((state) => ({
          resumes: { ...state.resumes, [resume.id]: resume },
          activeResumeId: resume.id,
          isDirty: false,
        }));
        return resume.id;
      },

      importResume: (resume) => {
        // Ensure the resume has a unique ID and timestamps
        const importedResume: Resume = {
          ...resume,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          resumes: { ...state.resumes, [importedResume.id]: importedResume },
          activeResumeId: importedResume.id,
          isDirty: false,
        }));
        return importedResume.id;
      },

      deleteResume: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.resumes;
          return {
            resumes: rest,
            activeResumeId: state.activeResumeId === id ? null : state.activeResumeId,
          };
        });
      },

      duplicateResume: (id) => {
        const original = get().resumes[id];
        if (!original) return '';

        const duplicate: Resume = {
          ...JSON.parse(JSON.stringify(original)),
          id: Date.now().toString(),
          name: `${original.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          resumes: { ...state.resumes, [duplicate.id]: duplicate },
        }));

        return duplicate.id;
      },

      setActiveResume: (id) => set({ activeResumeId: id, isDirty: false }),
      setActiveSection: (sectionId) => set({ activeSection: sectionId }),

      updateResumeName: (id, name) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [id]: {
              ...state.resumes[id],
              name,
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      updateHeader: (id, header) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [id]: {
              ...state.resumes[id],
              header: { ...state.resumes[id].header, ...header },
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      setAccentColor: (id, accentColor) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [id]: {
              ...state.resumes[id],
              accentColor: accentColor ?? undefined,
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      updateSummary: (id, summary) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [id]: {
              ...state.resumes[id],
              summary,
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      updateTemplate: (id, templateId) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [id]: {
              ...state.resumes[id],
              templateId,
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      reorderSections: (id, sections) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [id]: {
              ...state.resumes[id],
              sections,
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      toggleSectionVisibility: (resumeId, sectionId) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              sections: state.resumes[resumeId].sections.map((s) =>
                s.id === sectionId ? { ...s, isVisible: !s.isVisible } : s
              ),
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      // Experience
      addExperience: (resumeId, experience) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              experience: [...state.resumes[resumeId].experience, experience],
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      updateExperience: (resumeId, experienceId, data) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              experience: state.resumes[resumeId].experience.map((exp) =>
                exp.id === experienceId ? { ...exp, ...data } : exp
              ),
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      deleteExperience: (resumeId, experienceId) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              experience: state.resumes[resumeId].experience.filter(
                (exp) => exp.id !== experienceId
              ),
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      // Education
      addEducation: (resumeId, education) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              education: [...state.resumes[resumeId].education, education],
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      updateEducation: (resumeId, educationId, data) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              education: state.resumes[resumeId].education.map((edu) =>
                edu.id === educationId ? { ...edu, ...data } : edu
              ),
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      deleteEducation: (resumeId, educationId) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              education: state.resumes[resumeId].education.filter(
                (edu) => edu.id !== educationId
              ),
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      // Skills
      addSkill: (resumeId, skill) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              skills: [...state.resumes[resumeId].skills, skill],
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      updateSkill: (resumeId, skillId, data) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              skills: state.resumes[resumeId].skills.map((skill) =>
                skill.id === skillId ? { ...skill, ...data } : skill
              ),
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      deleteSkill: (resumeId, skillId) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              skills: state.resumes[resumeId].skills.filter((skill) => skill.id !== skillId),
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      // Projects
      addProject: (resumeId, project) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              projects: [...state.resumes[resumeId].projects, project],
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      updateProject: (resumeId, projectId, data) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              projects: state.resumes[resumeId].projects.map((proj) =>
                proj.id === projectId ? { ...proj, ...data } : proj
              ),
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      deleteProject: (resumeId, projectId) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resumeId]: {
              ...state.resumes[resumeId],
              projects: state.resumes[resumeId].projects.filter((proj) => proj.id !== projectId),
              updatedAt: new Date().toISOString(),
            },
          },
          isDirty: true,
        }));
      },

      /* ------------------------------------------------------------------
       * Certifications / languages / awards / custom sections.
       *
       * These list sections had NO store actions at all, which is why their
       * editors showed "This section is coming soon!" — the PDF engine could
       * already render them and the AI importer could already extract them,
       * so a user could import certifications and then never edit them.
       * They all share the same add/update/delete shape, so they go through
       * one generic helper instead of four copies of the same 40 lines.
       * ------------------------------------------------------------------ */

      addCertification: (resumeId, item) => set(listAdd(resumeId, 'certifications', item)),
      updateCertification: (resumeId, itemId, data) => set(listUpdate(resumeId, 'certifications', itemId, data)),
      deleteCertification: (resumeId, itemId) => set(listDelete(resumeId, 'certifications', itemId)),

      addLanguage: (resumeId, item) => set(listAdd(resumeId, 'languages', item)),
      updateLanguage: (resumeId, itemId, data) => set(listUpdate(resumeId, 'languages', itemId, data)),
      deleteLanguage: (resumeId, itemId) => set(listDelete(resumeId, 'languages', itemId)),

      addAward: (resumeId, item) => set(listAdd(resumeId, 'awards', item)),
      updateAward: (resumeId, itemId, data) => set(listUpdate(resumeId, 'awards', itemId, data)),
      deleteAward: (resumeId, itemId) => set(listDelete(resumeId, 'awards', itemId)),

      addCustomSection: (resumeId, item) => set(listAdd(resumeId, 'customSections', item)),
      updateCustomSection: (resumeId, itemId, data) => set(listUpdate(resumeId, 'customSections', itemId, data)),
      deleteCustomSection: (resumeId, itemId) => set(listDelete(resumeId, 'customSections', itemId)),

      moveItem: (resumeId, list, itemId, direction) => {
        set((state) => {
          const resume = state.resumes[resumeId];
          if (!resume) return state;
          const items = [...((resume[list] as any[]) ?? [])];
          const i = items.findIndex((x) => x?.id === itemId);
          const j = direction === 'up' ? i - 1 : i + 1;
          if (i < 0 || j < 0 || j >= items.length) return state; // already at the edge
          [items[i], items[j]] = [items[j], items[i]];
          return {
            resumes: {
              ...state.resumes,
              [resumeId]: { ...resume, [list]: items, updatedAt: new Date().toISOString() },
            },
            isDirty: true,
          };
        });
      },

      moveSection: (resumeId, sectionId, direction) => {
        set((state) => {
          const resume = state.resumes[resumeId];
          if (!resume) return state;
          // Work on an order-sorted copy so the indices match what the user sees.
          const sections = [...(resume.sections ?? [])].sort((a, b) => a.order - b.order);
          const i = sections.findIndex((s) => s.id === sectionId);
          const j = direction === 'up' ? i - 1 : i + 1;
          if (i < 0 || j < 0 || j >= sections.length) return state;
          [sections[i], sections[j]] = [sections[j], sections[i]];
          // Re-stamp order so it stays contiguous and the exporter can trust it.
          const renumbered = sections.map((s, idx) => ({ ...s, order: idx }));
          return {
            resumes: {
              ...state.resumes,
              [resumeId]: { ...resume, sections: renumbered, updatedAt: new Date().toISOString() },
            },
            isDirty: true,
          };
        });
      },

      addSection: (resumeId, type, title) => {
        set((state) => {
          const resume = state.resumes[resumeId];
          if (!resume) return state;
          const sections = resume.sections ?? [];
          // 'custom' can repeat (several custom sections); the rest are unique.
          if (type !== 'custom' && sections.some((s) => s.type === type)) return state;
          const order = sections.length ? Math.max(...sections.map((s) => s.order)) + 1 : 0;
          const next = [
            ...sections,
            { id: `${Date.now()}-${type}`, type, title, isVisible: true, order },
          ];
          return {
            resumes: {
              ...state.resumes,
              [resumeId]: { ...resume, sections: next, updatedAt: new Date().toISOString() },
            },
            isDirty: true,
          };
        });
      },

      removeSection: (resumeId, sectionId) => {
        set((state) => {
          const resume = state.resumes[resumeId];
          if (!resume) return state;
          const next = (resume.sections ?? [])
            .filter((s) => s.id !== sectionId)
            .map((s, idx) => ({ ...s, order: idx }));
          return {
            resumes: {
              ...state.resumes,
              [resumeId]: { ...resume, sections: next, updatedAt: new Date().toISOString() },
            },
            isDirty: true,
          };
        });
      },

      // Sync
      setResumes: (resumes) => {
        const resumeMap: Record<string, Resume> = {};
        resumes.forEach((resume) => {
          resumeMap[resume.id] = resume;
        });
        set({ resumes: resumeMap, isDirty: false });
      },

      mergeResumes: (serverResumes) => {
        set((state) => {
          const merged = { ...state.resumes };

          serverResumes.forEach((serverResume) => {
            const local = merged[serverResume.id];
            if (!local) {
              // New from server
              merged[serverResume.id] = serverResume;
            } else {
              // Compare timestamps - server wins if newer
              const serverTime = new Date(serverResume.updatedAt).getTime();
              const localTime = new Date(local.updatedAt).getTime();
              if (serverTime > localTime) {
                merged[serverResume.id] = serverResume;
              }
            }
          });

          return { resumes: merged, isDirty: false };
        });
      },

      // Getters
      getActiveResume: () => {
        const state = get();
        if (!state.activeResumeId) return null;
        return state.resumes[state.activeResumeId] || null;
      },

      getResume: (id) => get().resumes[id] || null,

      getAllResumes: () => Object.values(get().resumes).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    }),
    {
      name: 'resume-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
