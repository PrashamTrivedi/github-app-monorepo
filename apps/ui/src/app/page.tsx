'use client';

import { useState } from 'react';
import { RepoInput } from '@/components/RepoInput';
import { Dashboard } from '@/components/Dashboard';
import { validateGitHubUrl } from '@github-app/shared';

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [isValidRepo, setIsValidRepo] = useState<boolean>(false);

  const handleRepoSubmit = (url: string) => {
    if (validateGitHubUrl(url)) {
      setRepoUrl(url);
      setIsValidRepo(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {!isValidRepo ? (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-github-900 dark:text-white mb-4">
              Connect Your GitHub Repository
            </h2>
            <p className="text-lg text-github-600 dark:text-github-300">
              Enter your GitHub repository URL to get started with automated issue management
            </p>
          </div>
          <RepoInput onSubmit={handleRepoSubmit} />
        </div>
      ) : (
        <Dashboard repoUrl={repoUrl} onChangeRepo={() => setIsValidRepo(false)} />
      )}
    </div>
  );
}