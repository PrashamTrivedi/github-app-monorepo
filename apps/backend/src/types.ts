export interface Env {
  // Bindings
  DB: D1Database;
  GIT_CONTAINER: Container;
  
  // Environment variables
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
}