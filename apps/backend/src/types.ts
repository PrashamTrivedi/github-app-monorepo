/// <reference types="../worker-configuration" />

import type {GitContainer} from './lib/git-container.js'

// Re-export Env type from worker configuration
export type Env = Cloudflare.Env;



export interface Container {
  fetch(url: string, init?: RequestInit): Promise<Response>
}

export interface ContainerExecRequest {
  command: string[]
  env?: Record<string, string>
  workingDir?: string
  timeout?: number
}

export interface ContainerExecResponse {
  exitCode: number
  stdout: string
  stderr: string
  error?: string
  duration?: number
  timestamp?: string
}

// GitHub API types for webhook payloads
export interface GitHubWebhookInstallation {
  id: number
  account: {
    id: number
    login: string
    type: 'User' | 'Organization'
  }
  permissions: Record<string, string>
  repository_selection?: 'all' | 'selected'
}

// Enhanced git operation status
export interface GitOperationStatus {
  id: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress?: number
  message?: string
  started_at?: string
  completed_at?: string
}