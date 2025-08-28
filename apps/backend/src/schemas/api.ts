import { z } from 'zod';
import { ApiResponseSchema } from './common.js';

// Installation schema
export const InstallationSchema = z.object({
  id: z.number(),
  account_id: z.number(),
  account_login: z.string(),
  account_type: z.string(),
  permissions: z.record(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const InstallationsResponseSchema = ApiResponseSchema(
  z.array(InstallationSchema)
);

// Repository schema from GitHub API
export const GitHubRepositorySchema = z.object({
  id: z.number(),
  node_id: z.string(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  owner: z.object({
    login: z.string(),
    id: z.number(),
    avatar_url: z.string(),
    type: z.string(),
  }),
  html_url: z.string(),
  description: z.string().nullable(),
  fork: z.boolean(),
  url: z.string(),
  clone_url: z.string(),
  default_branch: z.string(),
  language: z.string().nullable(),
  forks_count: z.number(),
  stargazers_count: z.number(),
  watchers_count: z.number(),
  size: z.number(),
  open_issues_count: z.number(),
  has_issues: z.boolean(),
  has_projects: z.boolean(),
  has_wiki: z.boolean(),
  archived: z.boolean(),
  disabled: z.boolean(),
  visibility: z.string(),
  pushed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RepositoryResponseSchema = ApiResponseSchema(GitHubRepositorySchema);

// GitHub Issue schema
export const GitHubIssueSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  number: z.number(),
  title: z.string(),
  user: z.object({
    login: z.string(),
    id: z.number(),
    avatar_url: z.string(),
    type: z.string(),
  }).nullable(),
  labels: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      color: z.string(),
      description: z.string().nullable(),
    })
  ),
  state: z.enum(['open', 'closed']),
  assignee: z.object({
    login: z.string(),
    id: z.number(),
    avatar_url: z.string(),
  }).nullable(),
  assignees: z.array(
    z.object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string(),
    })
  ),
  milestone: z.object({
    id: z.number(),
    title: z.string(),
    description: z.string().nullable(),
    state: z.enum(['open', 'closed']),
  }).nullable(),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  author_association: z.string(),
  body: z.string().nullable(),
  html_url: z.string(),
  pull_request: z.object({
    url: z.string(),
    html_url: z.string(),
    diff_url: z.string(),
    patch_url: z.string(),
  }).optional(),
});

export const IssuesResponseSchema = ApiResponseSchema(z.array(GitHubIssueSchema));

// Query parameters for issues endpoint
export const IssuesQuerySchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open').optional(),
});

// Validate repository URL request/response schemas  
export const ValidateRepoRequestSchema = z.object({
  url: z.string().url().describe('GitHub repository URL'),
});

export const ParsedRepositorySchema = z.object({
  owner: z.string().describe('Repository owner username'),
  repo: z.string().describe('Repository name'),
});

export const ValidateRepoResponseSchema = ApiResponseSchema(ParsedRepositorySchema);

// Health check response schema
export const HealthCheckResponseSchema = z.object({
  message: z.string(),
  environment: z.string().optional(),
  timestamp: z.string(),
});