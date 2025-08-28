import { z } from 'zod';

// GitHub webhook common schemas
export const GitHubAccountSchema = z.object({
  id: z.number(),
  login: z.string(),
  type: z.enum(['User', 'Organization']),
  avatar_url: z.string().optional(),
  html_url: z.string().optional(),
});

export const GitHubRepositorySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  name: z.string(),
  private: z.boolean(),
  html_url: z.string(),
  clone_url: z.string(),
  default_branch: z.string(),
});

export const GitHubInstallationSchema = z.object({
  id: z.number(),
  account: GitHubAccountSchema,
  permissions: z.record(z.string()),
  events: z.array(z.string()).optional(),
  single_file_name: z.string().nullable().optional(),
});

export const GitHubIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable().optional(),
  state: z.enum(['open', 'closed']),
  user: GitHubAccountSchema.nullable(),
  assignee: GitHubAccountSchema.nullable().optional(),
  assignees: z.array(GitHubAccountSchema).optional(),
  labels: z.array(z.object({
    id: z.number(),
    name: z.string(),
    color: z.string(),
  })).optional(),
  html_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
});

export const GitHubPullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable().optional(),
  state: z.enum(['open', 'closed']),
  merged: z.boolean(),
  user: GitHubAccountSchema.nullable(),
  assignee: GitHubAccountSchema.nullable().optional(),
  assignees: z.array(GitHubAccountSchema).optional(),
  html_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  merged_at: z.string().nullable().optional(),
  head: z.object({
    ref: z.string(),
    sha: z.string(),
  }),
  base: z.object({
    ref: z.string(),
    sha: z.string(),
  }),
});

// Webhook payload schemas
export const InstallationWebhookPayloadSchema = z.object({
  action: z.enum(['created', 'deleted', 'suspend', 'unsuspend', 'new_permissions_accepted']),
  installation: GitHubInstallationSchema,
  sender: GitHubAccountSchema,
});

export const IssuesWebhookPayloadSchema = z.object({
  action: z.enum(['opened', 'edited', 'deleted', 'closed', 'reopened', 'assigned', 'unassigned', 'labeled', 'unlabeled']),
  issue: GitHubIssueSchema,
  repository: GitHubRepositorySchema,
  installation: GitHubInstallationSchema.optional(),
  sender: GitHubAccountSchema,
  assignee: GitHubAccountSchema.optional(),
  label: z.object({
    id: z.number(),
    name: z.string(),
    color: z.string(),
  }).optional(),
});

export const PullRequestWebhookPayloadSchema = z.object({
  action: z.enum(['opened', 'edited', 'closed', 'reopened', 'assigned', 'unassigned', 'review_requested', 'review_request_removed', 'labeled', 'unlabeled', 'synchronize', 'ready_for_review', 'converted_to_draft']),
  pull_request: GitHubPullRequestSchema,
  repository: GitHubRepositorySchema,
  installation: GitHubInstallationSchema.optional(),
  sender: GitHubAccountSchema,
  assignee: GitHubAccountSchema.optional(),
  requested_reviewer: GitHubAccountSchema.optional(),
  label: z.object({
    id: z.number(),
    name: z.string(),
    color: z.string(),
  }).optional(),
});

// Generic webhook payload (for unknown event types)
export const GenericWebhookPayloadSchema = z.object({
  action: z.string(),
  installation: GitHubInstallationSchema.optional(),
  repository: GitHubRepositorySchema.optional(),
  sender: GitHubAccountSchema,
}).passthrough(); // Allow additional properties

// Union of all webhook payloads
export const WebhookPayloadSchema = z.union([
  InstallationWebhookPayloadSchema,
  IssuesWebhookPayloadSchema,
  PullRequestWebhookPayloadSchema,
  GenericWebhookPayloadSchema,
]);

// Webhook response schema
export const WebhookResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});