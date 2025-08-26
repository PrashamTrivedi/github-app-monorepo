import type { components } from '@octokit/types';

// GitHub API types
export type GitHubRepository = components['schemas']['repository'];
export type GitHubIssue = components['schemas']['issue'];
export type GitHubPullRequest = components['schemas']['pull-request'];
export type GitHubWebhookEvent = components['schemas']['webhook'];

// App-specific types
export interface GitHubAppInstallation {
  id: number;
  account: {
    id: number;
    login: string;
    type: 'User' | 'Organization';
  };
  repositories?: GitHubRepository[];
  permissions: Record<string, string>;
}

export interface ContainerConfig {
  image: string;
  command?: string[];
  env?: Record<string, string>;
  workingDir?: string;
}

export interface GitOperation {
  type: 'clone' | 'pull' | 'push' | 'commit';
  repository: string;
  branch?: string;
  message?: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
}

// API contracts
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WebhookPayload {
  action: string;
  installation?: GitHubAppInstallation;
  repository?: GitHubRepository;
  issue?: GitHubIssue;
  pull_request?: GitHubPullRequest;
}