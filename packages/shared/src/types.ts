// GitHub API types - simplified versions based on actual API responses
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    id: number;
    login: string;
    type: 'User' | 'Organization';
  };
  private: boolean;
  clone_url: string;
  html_url: string;
  default_branch: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: {
    id: number;
    login: string;
  };
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  user: {
    id: number;
    login: string;
  };
  html_url: string;
  created_at: string;
  updated_at: string;
}

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