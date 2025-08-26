'use client';

import { useState } from 'react';
import { validateGitHubUrl } from '@github-app/shared';

interface RepoInputProps {
  onSubmit: (url: string) => void;
}

export function RepoInput({ onSubmit }: RepoInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateGitHubUrl(url)) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)');
      return;
    }

    setIsLoading(true);
    
    try {
      // Validate repository with backend API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/validate-repo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Repository validation failed');
      }

      const result = await response.json();
      
      if (result.success) {
        onSubmit(url);
      } else {
        setError(result.error || 'Repository validation failed');
      }
    } catch (err) {
      setError('Failed to validate repository. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="repo-url" className="block text-sm font-medium text-github-700 dark:text-github-300 mb-2">
            Repository URL
          </label>
          <input
            type="url"
            id="repo-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repository"
            className="w-full px-3 py-2 border border-github-300 dark:border-github-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-github-700 dark:text-white"
            required
          />
        </div>

        {error && (
          <div className="text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !url}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
        >
          {isLoading ? 'Validating...' : 'Connect Repository'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-github-200 dark:border-github-700">
        <h3 className="text-sm font-medium text-github-700 dark:text-github-300 mb-2">
          Installation Required
        </h3>
        <p className="text-sm text-github-600 dark:text-github-400 mb-3">
          This GitHub App needs to be installed on your repository to access issues and perform operations.
        </p>
        <a
          href="https://github.com/apps/your-app-name/installations/new"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-3 py-2 border border-github-300 dark:border-github-600 rounded-md text-sm font-medium text-github-700 dark:text-github-300 bg-white dark:bg-github-700 hover:bg-github-50 dark:hover:bg-github-600"
        >
          Install GitHub App
          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}