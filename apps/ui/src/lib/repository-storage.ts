import type { GitHubRepository } from '@github-app/shared';

const REPOSITORY_STORAGE_KEY = 'selectedRepository';

/**
 * Utility functions for persisting selected repository state in localStorage
 */
export const repositoryStorage = {
  /**
   * Save repository to localStorage
   */
  save(repository: GitHubRepository): void {
    try {
      localStorage.setItem(REPOSITORY_STORAGE_KEY, JSON.stringify(repository));
    } catch (error) {
      console.warn('Failed to save repository to localStorage:', error);
    }
  },

  /**
   * Load repository from localStorage
   */
  load(): GitHubRepository | null {
    try {
      const saved = localStorage.getItem(REPOSITORY_STORAGE_KEY);
      if (!saved) return null;
      
      return JSON.parse(saved) as GitHubRepository;
    } catch (error) {
      console.warn('Failed to load repository from localStorage:', error);
      // Clean up corrupted data
      this.clear();
      return null;
    }
  },

  /**
   * Clear repository from localStorage
   */
  clear(): void {
    try {
      localStorage.removeItem(REPOSITORY_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear repository from localStorage:', error);
    }
  },

  /**
   * Check if there's a saved repository
   */
  hasSaved(): boolean {
    try {
      return localStorage.getItem(REPOSITORY_STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }
};