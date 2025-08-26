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
}