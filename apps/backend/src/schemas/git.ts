import { z } from 'zod';
import { ApiResponseSchema } from './common.js';

// Git operation types
export const GitOperationTypeSchema = z.enum(['clone', 'pull', 'push', 'commit']);

// File change schema for commits
export const FileChangeSchema = z.object({
  path: z.string().min(1).describe('File path relative to repository root'),
  content: z.string().describe('File content'),
});

// Base git operation request schema
export const BaseGitOperationSchema = z.object({
  repository: z.string().min(1).describe('Repository full name (owner/repo)'),
  branch: z.string().default('main').optional().describe('Git branch name'),
});

// Specific operation request schemas
export const GitOperationRequestSchema = BaseGitOperationSchema.extend({
  type: GitOperationTypeSchema,
  message: z.string().optional().describe('Commit message for commit operations'),
  files: z.array(FileChangeSchema).optional().describe('Files to modify for commit operations'),
});

export const CloneRequestSchema = BaseGitOperationSchema;

export const CommitRequestSchema = BaseGitOperationSchema.extend({
  message: z.string().min(1).describe('Commit message'),
  files: z.array(FileChangeSchema).min(1).describe('Files to commit'),
});

// Git operation database record schema
export const GitOperationRecordSchema = z.object({
  id: z.number(),
  operation_type: GitOperationTypeSchema,
  repository_id: z.number(),
  repository_name: z.string().optional(),
  branch: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  result: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Response schemas
export const GitOperationResponseSchema = ApiResponseSchema(z.string());
export const GetOperationResponseSchema = ApiResponseSchema(GitOperationRecordSchema);
export const ListOperationsResponseSchema = ApiResponseSchema(z.array(GitOperationRecordSchema));