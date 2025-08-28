'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { GitHubAppInstallation } from '@github-app/shared';

interface InstallationFlowProps {
  onInstallationComplete?: (installation: GitHubAppInstallation) => void;
}

export function InstallationFlow({ onInstallationComplete }: InstallationFlowProps) {
  const [installations, setInstallations] = useState<GitHubAppInstallation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingCallback, setIsCheckingCallback] = useState(false);

  useEffect(() => {
    loadInstallations();
    
    // Check if we're returning from GitHub OAuth flow
    const urlParams = new URLSearchParams(window.location.search);
    const installationId = urlParams.get('installation_id');
    const setupAction = urlParams.get('setup_action');
    
    if (installationId && setupAction) {
      handleInstallationCallback(installationId, setupAction);
    }
  }, []);

  const loadInstallations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.getInstallations();
      
      if (response.success && response.data) {
        const installations = response.data as GitHubAppInstallation[];
        setInstallations(installations);
      } else {
        setInstallations([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load installations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallationCallback = async (installationId: string, _setupAction: string) => {
    setIsCheckingCallback(true);
    
    try {
      // Wait a moment for GitHub to process the installation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reload installations to get the new one
      await loadInstallations();
      
      // Find the new installation
      const newInstallation = installations.find(inst => inst.id.toString() === installationId);
      
      if (newInstallation && onInstallationComplete) {
        onInstallationComplete(newInstallation);
      }
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError('Failed to process installation. Please try again.');
    } finally {
      setIsCheckingCallback(false);
    }
  };

  const getInstallUrl = () => {
    const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'your-github-app-name';
    const returnUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    return `https://github.com/apps/${appName}/installations/new?state=${returnUrl}`;
  };

  if (isCheckingCallback) {
    return (
      <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-github-600 dark:text-github-300">
            Processing GitHub App installation...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Installation Status */}
      <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-github-900 dark:text-white">
            GitHub App Installation
          </h2>
          <button
            onClick={loadInstallations}
            disabled={isLoading}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Installation Error
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : installations.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-github-700 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-github-900 dark:text-white mb-2">
              No Installations Found
            </h3>
            <p className="text-github-600 dark:text-github-300 mb-6">
              Install the GitHub App on your repositories to get started with automated operations.
            </p>
            <a
              href={getInstallUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Install GitHub App
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center text-green-600 dark:text-green-400 mb-4">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">GitHub App is installed!</span>
            </div>

            {installations.map((installation) => (
              <div
                key={installation.id}
                className="border border-github-200 dark:border-github-600 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">\n                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-github-700 rounded-full flex items-center justify-center">
                      {installation.account.type === 'Organization' ? (
                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-github-900 dark:text-white">
                        {installation.account.login}
                      </h3>
                      <p className="text-sm text-github-500 dark:text-github-400">
                        {installation.account.type} • Installation #{installation.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-github-500 dark:text-github-400">
                    {installation.repositories?.length || 0} repositories
                  </div>
                </div>

                {installation.repositories && installation.repositories.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-github-200 dark:border-github-600">
                    <h4 className="text-sm font-medium text-github-700 dark:text-github-300 mb-2">
                      Accessible Repositories:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {installation.repositories.slice(0, 4).map((repo) => (
                        <div
                          key={repo.id}
                          className="text-sm text-github-600 dark:text-github-300 bg-gray-50 dark:bg-github-700 px-3 py-2 rounded"
                        >
                          {repo.full_name}
                        </div>
                      ))}
                      {installation.repositories.length > 4 && (
                        <div className="text-sm text-github-500 dark:text-github-400 bg-gray-50 dark:bg-github-700 px-3 py-2 rounded">
                          +{installation.repositories.length - 4} more...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="pt-4 border-t border-github-200 dark:border-github-600">
              <div className="flex items-center justify-between">
                <p className="text-sm text-github-600 dark:text-github-400">
                  Need to install on additional repositories?
                </p>
                <a
                  href={getInstallUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                >
                  Manage Installation
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Installation Help */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              About GitHub App Installation
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p className="mb-2">
                The GitHub App needs to be installed with appropriate permissions to:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Read repository content and metadata</li>
                <li>Access repository issues and pull requests</li>
                <li>Perform git operations (clone, commit, push)</li>
                <li>Receive webhook notifications for repository events</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}