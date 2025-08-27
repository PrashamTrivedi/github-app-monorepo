'use client';

import { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { apiClient } from '@/lib/api';
import type { GitHubAppInstallation } from '@github-app/shared';

export default function SettingsPage() {
  const [installations, setInstallations] = useState<GitHubAppInstallation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiHealth, setApiHealth] = useState<any>(null);

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load installations
      const installationsResponse = await apiClient.getInstallations();
      if (installationsResponse.success && installationsResponse.data) {
        const installations = installationsResponse.data as GitHubAppInstallation[];
        setInstallations(installations);
      } else {
        setInstallations([]);
      }

      // Check API health
      const healthResponse = await fetch(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787');
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setApiHealth(healthData);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings data');
    } finally {
      setIsLoading(false);
    }
  };

  const getInstallUrl = () => {
    const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'your-github-app-name';
    return `https://github.com/apps/${appName}/installations/new`;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingSpinner size="lg" message="Loading settings..." />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-github-900 dark:text-white">Settings</h1>
          <p className="mt-2 text-github-600 dark:text-github-300">
            Manage your GitHub App configuration, installations, and webhook settings.
          </p>
        </div>

        <div className="space-y-8">
          {/* API Status */}
          <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
            <h2 className="text-lg font-semibold text-github-900 dark:text-white mb-4">
              API Status
            </h2>
            
            {error ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      API Connection Error
                    </h3>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            ) : apiHealth ? (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                      API Connected
                    </h3>
                    <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                      <p>Backend: {apiHealth.message}</p>
                      <p>Environment: {apiHealth.environment}</p>
                      <p>Last Check: {new Date(apiHealth.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <button
                onClick={loadSettingsData}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Refresh Status
              </button>
            </div>
          </div>

          {/* App Configuration */}
          <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
            <h2 className="text-lg font-semibold text-github-900 dark:text-white mb-4">
              App Configuration
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-github-700 dark:text-github-300 mb-2">
                  Environment Variables
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-github-600 dark:text-github-400">API Base URL:</span>
                    <span className="font-mono text-github-900 dark:text-white">
                      {process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-github-600 dark:text-github-400">Environment:</span>
                    <span className="font-mono text-github-900 dark:text-white">
                      {process.env.NODE_ENV || 'development'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-github-600 dark:text-github-400">GitHub App:</span>
                    <span className="font-mono text-github-900 dark:text-white">
                      {process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'your-github-app-name'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-github-700 dark:text-github-300 mb-2">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <a
                    href={getInstallUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Manage App Installations
                    <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Installation Management */}
          <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-github-900 dark:text-white">
                GitHub App Installations
              </h2>
              <span className="text-sm text-github-500 dark:text-github-400">
                {installations.length} installation{installations.length !== 1 ? 's' : ''}
              </span>
            </div>

            {installations.length === 0 ? (
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-github-700 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-github-900 dark:text-white mb-2">
                  No installations found
                </h3>
                <p className="text-github-600 dark:text-github-400 mb-4">
                  Install the GitHub App to get started with repository management.
                </p>
                <a
                  href={getInstallUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Install GitHub App
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {installations.map((installation) => (
                  <div
                    key={installation.id}
                    className="border border-github-200 dark:border-github-600 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
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
                          <div className="flex items-center space-x-4 text-sm text-github-500 dark:text-github-400">
                            <span>{installation.account.type}</span>
                            <span>•</span>
                            <span>Installation #{installation.id}</span>
                            <span>•</span>
                            <span>{installation.repositories?.length || 0} repositories</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={`https://github.com/settings/installations/${installation.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          Manage
                        </a>
                      </div>
                    </div>

                    {installation.repositories && installation.repositories.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-github-200 dark:border-github-600">
                        <h4 className="text-sm font-medium text-github-700 dark:text-github-300 mb-2">
                          Accessible Repositories:
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {installation.repositories.map((repo) => (
                            <div
                              key={repo.id}
                              className="text-sm text-github-600 dark:text-github-300 bg-gray-50 dark:bg-github-700 px-3 py-2 rounded flex items-center justify-between"
                            >
                              <span className="truncate">{repo.full_name}</span>
                              {repo.private && (
                                <svg className="w-3 h-3 text-yellow-500 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {installation.permissions && (
                      <div className="mt-4 pt-4 border-t border-github-200 dark:border-github-600">
                        <h4 className="text-sm font-medium text-github-700 dark:text-github-300 mb-2">
                          Permissions:
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(installation.permissions).map(([permission, level]) => (
                            <span
                              key={permission}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                            >
                              {permission}: {level}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Developer Tools */}
          <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
            <h2 className="text-lg font-semibold text-github-900 dark:text-white mb-4">
              Developer Tools
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-github-700 dark:text-github-300 mb-2">
                  API Endpoints
                </h3>
                <div className="space-y-1 text-xs font-mono">
                  <div className="text-github-600 dark:text-github-400">
                    GET {process.env.NEXT_PUBLIC_API_BASE_URL}/
                  </div>
                  <div className="text-github-600 dark:text-github-400">
                    GET {process.env.NEXT_PUBLIC_API_BASE_URL}/api/installations
                  </div>
                  <div className="text-github-600 dark:text-github-400">
                    GET {process.env.NEXT_PUBLIC_API_BASE_URL}/api/repo/[owner]/[name]
                  </div>
                  <div className="text-github-600 dark:text-github-400">
                    POST {process.env.NEXT_PUBLIC_API_BASE_URL}/git/clone
                  </div>
                  <div className="text-github-600 dark:text-github-400">
                    POST {process.env.NEXT_PUBLIC_API_BASE_URL}/webhooks
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-github-700 dark:text-github-300 mb-2">
                  Useful Links
                </h3>
                <div className="space-y-2">
                  <div>
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      API Health Check
                    </a>
                  </div>
                  <div>
                    <a
                      href="https://docs.github.com/en/developers/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      GitHub Apps Documentation
                    </a>
                  </div>
                  <div>
                    <a
                      href="https://developers.cloudflare.com/workers/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Cloudflare Workers Documentation
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}