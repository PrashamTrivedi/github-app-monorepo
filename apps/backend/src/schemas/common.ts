import { z } from 'zod';

// Common API response schema
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.nullable().optional(),
    error: z.string().optional(),
  });

// Common error response schemas
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  data: z.null().optional(),
});

// HTTP error response schemas
export const BadRequestResponseSchema = ErrorResponseSchema;
export const UnauthorizedResponseSchema = ErrorResponseSchema;
export const NotFoundResponseSchema = ErrorResponseSchema;
export const InternalServerErrorResponseSchema = ErrorResponseSchema;
export const ServiceUnavailableResponseSchema = ErrorResponseSchema;

// Path parameter schemas
export const OwnerParamSchema = z.object({
  owner: z.string().min(1).describe('Repository owner username'),
});

export const RepoParamSchema = z.object({
  repo: z.string().min(1).describe('Repository name'),
});

export const OwnerRepoParamSchema = z.object({
  owner: z.string().min(1).describe('Repository owner username'),
  repo: z.string().min(1).describe('Repository name'),
});

export const IdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number).describe('Numeric ID'),
});

export const NameParamSchema = z.object({
  name: z.string().min(1).describe('Repository name'),
});