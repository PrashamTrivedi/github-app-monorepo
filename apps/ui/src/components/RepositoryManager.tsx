'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { GitHubRepository, GitHubAppInstallation } from '@github-app/shared';
import { parseRepositoryUrl } from '@github-app/shared';

interface RepositoryManagerProps {
  installations: GitHubAppInstallation[];
  onSelectRepository: (repo: GitHubRepository) => void;
  selectedRepository?: GitHubRepository;
}

export function RepositoryManager({
  installations,
  onSelectRepository,
  selectedRepository
}: RepositoryManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstallation, setSelectedInstallation] = useState<number | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customRepoUrl, setCustomRepoUrl] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    // Collect all repositories from installations
    const allRepos = installations.flatMap(installation => 
      installation.repositories || []
    );
    setRepositories(allRepos);
  }, [installations]);

  const filteredRepositories = repositories.filter(repo => {
    const matchesSearch = repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         repo.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesInstallation = selectedInstallation === null || 
                               installations.some(inst => 
                                 inst.id === selectedInstallation && 
                                 inst.repositories?.some(r => r.id === repo.id)
                               );
    
    return matchesSearch && matchesInstallation;
  });

  const handleCustomRepository = async () => {
    if (!customRepoUrl.trim()) return;

    const parsed = parseRepositoryUrl(customRepoUrl);
    if (!parsed) {
      alert('Invalid GitHub repository URL');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.getRepository(parsed.owner, parsed.repo);
      if (response.success && response.data) {
        const repo = response.data as GitHubRepository;
        onSelectRepository(repo);
        setShowCustomInput(false);
        setCustomRepoUrl('');
      } else {
        alert('Repository not found or not accessible');
      }
    } catch (error) {
      alert('Failed to load repository information');
    } finally {
      setIsLoading(false);
    }
  };

  const getInstallationForRepo = (repo: GitHubRepository) => {
    return installations.find(inst => 
      inst.repositories?.some(r => r.id === repo.id)
    );
  };

  return (
    <div className="space-y-6">
      {/* Repository Selection Header */}
      <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-github-900 dark:text-white">
            Repository Manager
          </h2>
          <button
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {showCustomInput ? 'Cancel' : 'Add Custom Repository'}
          </button>
        </div>

        {/* Custom Repository Input */}
        {showCustomInput && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-github-700 rounded-lg">
            <div className="flex space-x-3">
              <input
                type="url"
                value={customRepoUrl}
                onChange={(e) => setCustomRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                className="flex-1 px-3 py-2 border border-github-300 dark:border-github-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-github-600 dark:text-white"
              />
              <button
                onClick={handleCustomRepository}
                disabled={!customRepoUrl.trim() || isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md"
              >
                {isLoading ? 'Loading...' : 'Add'}
              </button>
            </div>
            <p className="mt-2 text-xs text-github-500 dark:text-github-400">
              Add any public GitHub repository or private repository where the app is installed.
            </p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search repositories..."
                className="w-full px-3 py-2 border border-github-300 dark:border-github-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-github-700 dark:text-white"
              />
            </div>
            <select
              value={selectedInstallation || ''}
              onChange={(e) => setSelectedInstallation(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 border border-github-300 dark:border-github-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-github-700 dark:text-white"
            >
              <option value="">All Installations</option>
              {installations.map((installation) => (
                <option key={installation.id} value={installation.id}>
                  {installation.account.login} ({installation.repositories?.length || 0} repos)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Selection */}
        {selectedRepository && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100">
                  Currently Selected:
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedRepository.full_name}
                </p>
              </div>
              <button
                onClick={() => onSelectRepository(selectedRepository)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                View Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Repository Grid */}
      <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
        <h3 className="text-sm font-medium text-github-900 dark:text-white mb-4">
          Available Repositories ({filteredRepositories.length})
        </h3>

        {filteredRepositories.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-github-700 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 7a2 2 0 012-2h10a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-github-900 dark:text-white mb-2">
              No repositories found
            </h3>
            <p className="text-github-600 dark:text-github-400">
              {searchTerm ? 'Try adjusting your search criteria.' : 'No repositories are available from your installations.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRepositories.map((repo) => {
              const installation = getInstallationForRepo(repo);
              const isSelected = selectedRepository?.id === repo.id;

              return (
                <div
                  key={repo.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-github-200 dark:border-github-600 hover:border-github-300 dark:hover:border-github-500'
                  }`}
                  onClick={() => onSelectRepository(repo)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-github-900 dark:text-white truncate">
                        {repo.name}
                      </h4>
                      <p className="text-sm text-github-500 dark:text-github-400">
                        {repo.owner.login}
                      </p>
                    </div>
                    {repo.private && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                        Private
                      </span>
                    )}
                  </div>

                  {repo.description && (
                    <p className="text-sm text-github-600 dark:text-github-300 mb-3 line-clamp-2">
                      {repo.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-github-500 dark:text-github-400">
                    <div className="flex items-center space-x-4">
                      {repo.language && (
                        <span className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {repo.stargazers_count || 0}
                      </span>
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {repo.forks_count || 0}
                      </span>
                    </div>
                  </div>

                  {installation && (
                    <div className="mt-3 pt-3 border-t border-github-200 dark:border-github-600">
                      <div className="text-xs text-github-500 dark:text-github-400">
                        Via {installation.account.login} installation
                      </div>
                    </div>
                  )}

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                      <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Currently Selected
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}