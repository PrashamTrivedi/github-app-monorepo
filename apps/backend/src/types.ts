export interface Env {
  // Bindings
  DB: D1Database;
  TOKEN_CACHE: KVNamespace;
  GIT_CONTAINER: Container;
  
  // Environment variables (secrets)
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  
  // Optional runtime configuration
  CONTAINER_TIMEOUT?: string;
  MAX_OPERATION_TIME?: string;
  DEBUG_MODE?: string;
}

export interface Container {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export interface ContainerExecRequest {
  command: string[];
  env?: Record<string, string>;
  workingDir?: string;
  timeout?: number;
}

export interface ContainerExecResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
  duration?: number;
  timestamp?: string;
}

// GitHub API types for webhook payloads
export interface GitHubWebhookInstallation {
  id: number;
  account: {
    id: number;
    login: string;
    type: 'User' | 'Organization';
  };
  permissions: Record<string, string>;
  repository_selection?: 'all' | 'selected';
}

// Enhanced git operation status
export interface GitOperationStatus {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  started_at?: string;
  completed_at?: string;
}