'use client';

import { useState, useEffect } from 'react';
import { parseRepositoryUrl } from '@github-app/shared';
import type { GitHubIssue, GitHubRepository } from '@github-app/shared';
import { IssuesList } from './IssuesList';

interface DashboardProps {
  repoUrl: string;
  onChangeRepo: () => void;
}

export function Dashboard({ repoUrl, onChangeRepo }: DashboardProps) {
  const [repository, setRepository] = useState<GitHubRepository | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const parsedRepo = parseRepositoryUrl(repoUrl);

  useEffect(() => {
    if (!parsedRepo) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError('');

      try {
        // Fetch repository information
        const repoResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/repo/${parsedRepo.owner}/${parsedRepo.repo}`
        );

        if (!repoResponse.ok) {
          throw new Error('Failed to fetch repository information');
        }

        const repoResult = await repoResponse.json();
        if (repoResult.success) {
          setRepository(repoResult.data);
        }

        // Fetch issues
        const issuesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/repo/${parsedRepo.owner}/${parsedRepo.repo}/issues`
        );

        if (!issuesResponse.ok) {
          throw new Error('Failed to fetch issues');
        }

        const issuesResult = await issuesResponse.json();
        if (issuesResult.success) {
          setIssues(issuesResult.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load repository data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [parsedRepo]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-github-600 dark:text-github-300">Loading repository...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading repository
            </h3>
            <div className="mt-1 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
            <div className="mt-3">
              <button
                onClick={onChangeRepo}
                className="text-sm font-medium text-red-800 dark:text-red-200 underline hover:no-underline"
              >
                Try another repository
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Repository Header */}
      {repository && (
        <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-github-900 dark:text-white">
                {repository.full_name}
              </h1>
              {repository.description && (
                <p className="mt-1 text-github-600 dark:text-github-300">
                  {repository.description}
                </p>
              )}
              <div className="mt-3 flex items-center space-x-4 text-sm text-github-500 dark:text-github-400">
                <span className="flex items-center">
                  <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  {repository.language}
                </span>
                <span className="flex items-center">
                  <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {repository.stargazers_count} stars
                </span>
                <span className="flex items-center">
                  <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {repository.forks_count} forks
                </span>
              </div>
            </div>
            <button
              onClick={onChangeRepo}
              className="px-4 py-2 text-sm font-medium text-github-700 dark:text-github-300 bg-github-100 dark:bg-github-700 hover:bg-github-200 dark:hover:bg-github-600 border border-github-300 dark:border-github-600 rounded-md"
            >
              Change Repository
            </button>
          </div>
        </div>
      )}

      {/* Issues List */}
      <IssuesList issues={issues} repository={parsedRepo} />
    </div>
  );
}