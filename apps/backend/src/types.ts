/// <reference types="../worker-configuration" />

import type { GitContainer } from './lib/git-container.js';

// Extend the generated Cloudflare types
export interface Env extends Cloudflare.Env {
  // Container binding as DurableObjectNamespace
  GIT_CONTAINER: DurableObjectNamespace<GitContainer>;
  
  // Environment variables (secrets)
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY?: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  
  // Private key chunks (workaround for Cloudflare secret size limit)
  GITHUB_PRIVATE_KEY_CHUNK_1?: string;
  GITHUB_PRIVATE_KEY_CHUNK_2?: string;
  
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