import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Resume,
  ResumeSection,
  WorkExperience,
  Education,
  Skill,
  Project,
  Certification,
  Language,
  Award,
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

  // Sync
  setResumes: (resumes: Resume[]) => void;
  mergeResumes: (serverResumes: Resume[]) => void;

  // Getters
  getActiveResume: () => Resume | null;
  getResume: (id: string) => Resume | null;
  getAllResumes: () => Resume[];
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
