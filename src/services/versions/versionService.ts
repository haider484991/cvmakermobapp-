/**
 * Resume Version Service
 * Manages resume version history for undo/redo and snapshots
 * Note: This service uses local storage. Cloud sync requires matching database schema.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Resume } from '@/types/resume';

export interface ResumeVersion {
  id: string;
  resumeId: string;
  version: number;
  name: string;
  snapshot: Resume;
  createdAt: string;
  isAutoSave: boolean;
}

const VERSION_STORAGE_KEY = 'resume_versions';

class VersionService {
  private maxVersions = 20; // Maximum versions to keep per resume
  private versions: Map<string, ResumeVersion[]> = new Map();
  private initialized = false;

  /**
   * Initialize service by loading from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await AsyncStorage.getItem(VERSION_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as Record<string, ResumeVersion[]>;
        Object.entries(data).forEach(([resumeId, versions]) => {
          this.versions.set(resumeId, versions);
        });
      }
      this.initialized = true;
    } catch (error) {
      console.error('[VersionService] Initialize error:', error);
      this.initialized = true;
    }
  }

  /**
   * Save versions to storage
   */
  private async persist(): Promise<void> {
    try {
      const data: Record<string, ResumeVersion[]> = {};
      this.versions.forEach((versions, resumeId) => {
        data[resumeId] = versions;
      });
      await AsyncStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[VersionService] Persist error:', error);
    }
  }

  /**
   * Create a new version snapshot
   */
  async createVersion(
    resumeId: string,
    resume: Resume,
    name?: string,
    isAutoSave = false
  ): Promise<ResumeVersion | null> {
    await this.initialize();

    try {
      const existingVersions = this.versions.get(resumeId) || [];
      const latestVersion = existingVersions[0]?.version || 0;
      const newVersion = latestVersion + 1;

      const versionName = name || (isAutoSave ? `Auto-save ${newVersion}` : `Version ${newVersion}`);

      const version: ResumeVersion = {
        id: `${resumeId}-v${newVersion}-${Date.now()}`,
        resumeId,
        version: newVersion,
        name: versionName,
        snapshot: JSON.parse(JSON.stringify(resume)), // Deep clone
        createdAt: new Date().toISOString(),
        isAutoSave,
      };

      // Add new version at the beginning
      const updatedVersions = [version, ...existingVersions];

      // Cleanup old versions if needed
      const cleanedVersions = this.cleanupOldVersions(updatedVersions);

      this.versions.set(resumeId, cleanedVersions);
      await this.persist();

      return version;
    } catch (error) {
      console.error('[VersionService] Create version error:', error);
      return null;
    }
  }

  /**
   * Get all versions for a resume
   */
  async getVersions(resumeId: string): Promise<ResumeVersion[]> {
    await this.initialize();
    return this.versions.get(resumeId) || [];
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: string): Promise<ResumeVersion | null> {
    await this.initialize();

    for (const versions of this.versions.values()) {
      const version = versions.find((v) => v.id === versionId);
      if (version) return version;
    }

    return null;
  }

  /**
   * Restore a version - returns the snapshot
   */
  async restoreVersion(versionId: string): Promise<Resume | null> {
    const version = await this.getVersion(versionId);
    if (!version) return null;

    return JSON.parse(JSON.stringify(version.snapshot)); // Deep clone
  }

  /**
   * Delete a version
   */
  async deleteVersion(resumeId: string, versionId: string): Promise<boolean> {
    await this.initialize();

    const versions = this.versions.get(resumeId);
    if (!versions) return false;

    const updatedVersions = versions.filter((v) => v.id !== versionId);
    this.versions.set(resumeId, updatedVersions);
    await this.persist();

    return true;
  }

  /**
   * Rename a version
   */
  async renameVersion(
    resumeId: string,
    versionId: string,
    newName: string
  ): Promise<boolean> {
    await this.initialize();

    const versions = this.versions.get(resumeId);
    if (!versions) return false;

    const updatedVersions = versions.map((v) =>
      v.id === versionId ? { ...v, name: newName } : v
    );
    this.versions.set(resumeId, updatedVersions);
    await this.persist();

    return true;
  }

  /**
   * Get version count for a resume
   */
  async getVersionCount(resumeId: string): Promise<number> {
    await this.initialize();
    return this.versions.get(resumeId)?.length || 0;
  }

  /**
   * Delete all versions for a resume
   */
  async deleteAllVersions(resumeId: string): Promise<boolean> {
    await this.initialize();
    this.versions.delete(resumeId);
    await this.persist();
    return true;
  }

  /**
   * Cleanup old versions to stay within limit
   */
  private cleanupOldVersions(versions: ResumeVersion[]): ResumeVersion[] {
    if (versions.length <= this.maxVersions) return versions;

    // Separate auto-saves and manual versions
    const autoSaves = versions.filter((v) => v.isAutoSave);
    const manual = versions.filter((v) => !v.isAutoSave);

    // Keep all manual versions if possible, remove oldest auto-saves first
    const toKeep: ResumeVersion[] = [];
    let remaining = this.maxVersions;

    // Add manual versions first
    for (const v of manual) {
      if (remaining <= 0) break;
      toKeep.push(v);
      remaining--;
    }

    // Fill with auto-saves (newest first)
    for (const v of autoSaves) {
      if (remaining <= 0) break;
      toKeep.push(v);
      remaining--;
    }

    // Sort by creation date (newest first)
    return toKeep.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Compare two resume versions
   */
  compareVersions(version1: Resume, version2: Resume): VersionDiff {
    const changes: VersionChange[] = [];

    // Compare header
    if (version1.header.fullName !== version2.header.fullName) {
      changes.push({ field: 'header.fullName', type: 'modified' });
    }
    if (version1.header.jobTitle !== version2.header.jobTitle) {
      changes.push({ field: 'header.jobTitle', type: 'modified' });
    }

    // Compare summary
    if (version1.summary !== version2.summary) {
      changes.push({ field: 'summary', type: 'modified' });
    }

    // Compare experience
    const expChanges = this.compareArrays(
      version1.experience,
      version2.experience,
      'experience'
    );
    changes.push(...expChanges);

    // Compare education
    const eduChanges = this.compareArrays(
      version1.education,
      version2.education,
      'education'
    );
    changes.push(...eduChanges);

    // Compare skills
    const skillChanges = this.compareArrays(
      version1.skills,
      version2.skills,
      'skills'
    );
    changes.push(...skillChanges);

    return {
      totalChanges: changes.length,
      changes,
    };
  }

  private compareArrays<T extends { id: string }>(
    arr1: T[],
    arr2: T[],
    fieldName: string
  ): VersionChange[] {
    const changes: VersionChange[] = [];
    const ids1 = new Set(arr1.map((item) => item.id));
    const ids2 = new Set(arr2.map((item) => item.id));

    // Check for additions
    for (const item of arr2) {
      if (!ids1.has(item.id)) {
        changes.push({ field: fieldName, type: 'added', itemId: item.id });
      }
    }

    // Check for deletions
    for (const item of arr1) {
      if (!ids2.has(item.id)) {
        changes.push({ field: fieldName, type: 'removed', itemId: item.id });
      }
    }

    // Check for modifications
    for (const item1 of arr1) {
      const item2 = arr2.find((i) => i.id === item1.id);
      if (item2 && JSON.stringify(item1) !== JSON.stringify(item2)) {
        changes.push({ field: fieldName, type: 'modified', itemId: item1.id });
      }
    }

    return changes;
  }
}

export interface VersionChange {
  field: string;
  type: 'added' | 'removed' | 'modified';
  itemId?: string;
}

export interface VersionDiff {
  totalChanges: number;
  changes: VersionChange[];
}

export const versionService = new VersionService();
export default versionService;
