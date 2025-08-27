'use client';

import type { GitHubIssue } from '@github-app/shared';

interface IssuesListProps {
  issues: GitHubIssue[];
  repository: { owner: string; repo: string } | null;
}

export function IssuesList({ issues, repository }: IssuesListProps) {
  if (!repository) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStateBadgeColor = (state: string) => {
    switch (state) {
      case 'open':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'closed':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700">
      <div className="px-6 py-4 border-b border-github-200 dark:border-github-700">
        <h2 className="text-lg font-semibold text-github-900 dark:text-white">
          Issues ({issues.length})
        </h2>
      </div>

      {issues.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <svg className="mx-auto h-12 w-12 text-github-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m-16-4c0 4.418-7.163 8-16 8s-16-3.582-16-8" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-github-900 dark:text-white">
            No issues found
          </h3>
          <p className="mt-1 text-sm text-github-500 dark:text-github-400">
            This repository doesn't have any open issues yet.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-github-200 dark:divide-github-700">
          {issues.map((issue) => (
            <div key={issue.id} className="px-6 py-4 hover:bg-github-50 dark:hover:bg-github-700/50">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-sm font-medium text-github-900 dark:text-white truncate">
                      {issue.title}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStateBadgeColor(issue.state)}`}>
                      {issue.state}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-xs text-github-500 dark:text-github-400 space-x-4">
                    <span>#{issue.number}</span>
                    <span>opened {formatDate(issue.created_at)}</span>
                    <span>by {issue.user.login}</span>
                    {issue.assignee && (
                      <span>assigned to {issue.assignee.login}</span>
                    )}
                  </div>

                  {issue.labels && issue.labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {issue.labels.slice(0, 5).map((label: any) => (
                        <span
                          key={label.id}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `#${label.color}20`,
                            color: `#${label.color}`,
                            border: `1px solid #${label.color}40`,
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                      {issue.labels.length > 5 && (
                        <span className="text-xs text-github-500 dark:text-github-400">
                          +{issue.labels.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {issue.comments > 0 && (
                    <div className="flex items-center text-xs text-github-500 dark:text-github-400">
                      <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      {issue.comments}
                    </div>
                  )}
                  
                  <a
                    href={issue.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View on GitHub
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}