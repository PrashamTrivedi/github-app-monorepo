'use client';

import { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { InstallationFlow } from '@/components/InstallationFlow';
import { RepositoryManager } from '@/components/RepositoryManager';
import { Dashboard } from '@/components/Dashboard';
import { GitOperationsPanel } from '@/components/GitOperationsPanel';
import { apiClient } from '@/lib/api';
import type { GitHubRepository, GitHubAppInstallation } from '@github-app/shared';

type ViewMode = 'installations' | 'repositories' | 'dashboard';

export default function HomePage() {
  const [currentView, setCurrentView] = useState<ViewMode>('installations');
  const [installations, setInstallations] = useState<GitHubAppInstallation[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<GitHubRepository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.getInstallations();
      
      if (response.success && response.data) {
        const installations = response.data as GitHubAppInstallation[];
        setInstallations(installations);
        
        // If we have installations, show repository manager
        if (installations.length > 0) {
          setCurrentView('repositories');
        }
      } else {
        setInstallations([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallationComplete = (installation: GitHubAppInstallation) => {
    setInstallations(prev => [...prev, installation]);
    setCurrentView('repositories');
  };

  const handleRepositorySelect = (repo: GitHubRepository) => {
    setSelectedRepository(repo);
    setCurrentView('dashboard');
  };

  const handleBackToRepositories = () => {
    setCurrentView('repositories');
  };

  const handleBackToInstallations = () => {
    setCurrentView('installations');
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingSpinner size="lg" message="Loading GitHub App data..." />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Breadcrumbs */}
        <nav className="flex mb-6" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <button
                onClick={handleBackToInstallations}
                className={`inline-flex items-center text-sm font-medium ${
                  currentView === 'installations'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-github-700 hover:text-blue-600 dark:text-github-400 dark:hover:text-blue-400'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L9 5.414V17a1 1 0 102 0V5.414l5.293 5.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                Installation
              </button>
            </li>
            
            {(currentView === 'repositories' || currentView === 'dashboard') && installations.length > 0 && (
              <>
                <li>
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <button
                      onClick={handleBackToRepositories}
                      className={`ml-1 text-sm font-medium ${
                        currentView === 'repositories'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-github-700 hover:text-blue-600 dark:text-github-400 dark:hover:text-blue-400'
                      }`}
                    >
                      Repositories
                    </button>
                  </div>
                </li>
              </>
            )}
            
            {currentView === 'dashboard' && selectedRepository && (
              <li>
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                    {selectedRepository.name}
                  </span>
                </div>
              </li>
            )}
          </ol>
        </nav>

        {/* Main Content */}
        {currentView === 'installations' && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-github-900 dark:text-white mb-4">
                GitHub App Dashboard
              </h1>
              <p className="text-lg text-github-600 dark:text-github-300">
                Manage your GitHub repositories with powerful automation and git operations.
              </p>
            </div>
            
            <InstallationFlow 
              onInstallationComplete={handleInstallationComplete}
            />
          </div>
        )}

        {currentView === 'repositories' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-github-900 dark:text-white mb-4">
                Select Repository
              </h1>
              <p className="text-lg text-github-600 dark:text-github-300">
                Choose a repository to manage issues and perform git operations.
              </p>
            </div>
            
            <RepositoryManager
              installations={installations}
              onSelectRepository={handleRepositorySelect}
              selectedRepository={selectedRepository || undefined}
            />
          </div>
        )}

        {currentView === 'dashboard' && selectedRepository && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-github-900 dark:text-white">
                  {selectedRepository.name}
                </h1>
                <p className="text-github-600 dark:text-github-300">
                  {selectedRepository.full_name}
                </p>
              </div>
              <button
                onClick={handleBackToRepositories}
                className="px-4 py-2 text-sm font-medium text-github-700 dark:text-github-300 bg-github-100 dark:bg-github-700 hover:bg-github-200 dark:hover:bg-github-600 border border-github-300 dark:border-github-600 rounded-md"
              >
                Change Repository
              </button>
            </div>

            {/* Git Operations Panel */}
            <GitOperationsPanel
              repository={{
                owner: selectedRepository.owner.login,
                repo: selectedRepository.name
              }}
            />

            {/* Original Dashboard Content */}
            <Dashboard
              repoUrl={selectedRepository.html_url}
              onChangeRepo={handleBackToRepositories}
            />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Error loading data
                  </h3>
                  <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={loadInitialData}
                      className="text-sm font-medium text-red-800 dark:text-red-200 underline hover:no-underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}