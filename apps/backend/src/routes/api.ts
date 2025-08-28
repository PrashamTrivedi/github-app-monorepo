import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../types.js';
import { generateInstallationToken } from '../lib/github-auth.js';
import { getRepositoryByName } from '../lib/database.js';
import {
  InstallationsResponseSchema,
  RepositoryResponseSchema, 
  IssuesResponseSchema,
  IssuesQuerySchema,
  ValidateRepoRequestSchema,
  ValidateRepoResponseSchema,
} from '../schemas/api.js';
import {
  OwnerRepoParamSchema,
  BadRequestResponseSchema,
  NotFoundResponseSchema,
  InternalServerErrorResponseSchema,
} from '../schemas/common.js';

// Simple response helper since we can't import from shared
function createApiResponse<T>(success: boolean, data?: T | null, error?: string) {
  return { success, data, error };
}

// Simple URL parser since we can't import from shared  
function parseRepositoryUrl(url: string) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

export const apiRoutes = new OpenAPIHono<{ Bindings: Env }>();

// Get installations
apiRoutes.openapi(
  {
    method: 'get',
    path: '/installations',
    summary: 'Get all GitHub App installations',
    description: 'Returns a list of all GitHub App installations',
    responses: {
      200: {
        description: 'List of installations',
        content: {
          'application/json': {
            schema: InstallationsResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: InternalServerErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Installations'],
  },
  async (c) => {
    try {
      const { results } = await c.env.DB.prepare(
        'SELECT * FROM installations ORDER BY account_login'
      ).all();
      
      return c.json(createApiResponse(true, results));
    } catch (error) {
      console.error('Error fetching installations:', error);
      return c.json(createApiResponse(false, null, 'Failed to fetch installations'), 500);
    }
  }
);

// Get repository information
apiRoutes.openapi(
  {
    method: 'get',
    path: '/repo/{owner}/{repo}',
    summary: 'Get repository information',
    description: 'Returns detailed information about a specific GitHub repository',
    request: {
      params: OwnerRepoParamSchema,
    },
    responses: {
      200: {
        description: 'Repository information',
        content: {
          'application/json': {
            schema: RepositoryResponseSchema,
          },
        },
      },
      404: {
        description: 'Repository not found',
        content: {
          'application/json': {
            schema: NotFoundResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: InternalServerErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Repositories'],
  },
  async (c) => {
    try {
      const { owner, repo } = c.req.valid('param');
      const fullName = `${owner}/${repo}`;
      
      // Get repository from database to find installation ID
      const dbRepository = await getRepositoryByName(c.env.DB, fullName);
      if (!dbRepository) {
        return c.json(createApiResponse(false, null, 'Repository not found or app not installed'), 404);
      }
      
      // Generate installation token
      const tokenData = await generateInstallationToken(dbRepository.installation_id, c.env);
      
      // Make GitHub API call
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-App-Backend/1.0'
        }
      });
      
      if (!response.ok) {
        return c.json(createApiResponse(false, null, 'Repository not found'), 404);
      }
      
      const repository = await response.json();
      return c.json(createApiResponse(true, repository));
    } catch (error) {
      console.error('Error fetching repository:', error);
      return c.json(createApiResponse(false, null, 'Repository not found'), 404);
    }
  }
);

// Get repository issues
apiRoutes.openapi(
  {
    method: 'get',
    path: '/repo/{owner}/{repo}/issues',
    summary: 'Get repository issues',
    description: 'Returns a list of issues for a specific repository',
    request: {
      params: OwnerRepoParamSchema,
      query: IssuesQuerySchema,
    },
    responses: {
      200: {
        description: 'List of issues',
        content: {
          'application/json': {
            schema: IssuesResponseSchema,
          },
        },
      },
      404: {
        description: 'Repository not found',
        content: {
          'application/json': {
            schema: NotFoundResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: InternalServerErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Repositories'],
  },
  async (c) => {
    try {
      const { owner, repo } = c.req.valid('param');
      const { state = 'open' } = c.req.valid('query');
      const fullName = `${owner}/${repo}`;
      
      // Get repository from database to find installation ID
      const dbRepository = await getRepositoryByName(c.env.DB, fullName);
      if (!dbRepository) {
        return c.json(createApiResponse(false, null, 'Repository not found or app not installed'), 404);
      }
      
      // Generate installation token
      const tokenData = await generateInstallationToken(dbRepository.installation_id, c.env);
      
      // Make GitHub API call
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=${state}`, {
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-App-Backend/1.0'
        }
      });
      
      if (!response.ok) {
        return c.json(createApiResponse(false, null, 'Failed to fetch issues'), 500);
      }
      
      const issues = await response.json();
      return c.json(createApiResponse(true, issues));
    } catch (error) {
      console.error('Error fetching issues:', error);
      return c.json(createApiResponse(false, null, 'Failed to fetch issues'), 500);
    }
  }
);

// Validate repository URL
apiRoutes.openapi(
  {
    method: 'post',
    path: '/validate-repo',
    summary: 'Validate repository URL',
    description: 'Validates and parses a GitHub repository URL',
    request: {
      body: {
        content: {
          'application/json': {
            schema: ValidateRepoRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Parsed repository information',
        content: {
          'application/json': {
            schema: ValidateRepoResponseSchema,
          },
        },
      },
      400: {
        description: 'Invalid request or URL',
        content: {
          'application/json': {
            schema: BadRequestResponseSchema,
          },
        },
      },
    },
    tags: ['Repositories'],
  },
  async (c) => {
    try {
      const { url } = c.req.valid('json');
      const parsed = parseRepositoryUrl(url);
      
      if (!parsed) {
        return c.json(createApiResponse(false, null, 'Invalid GitHub repository URL'), 400);
      }
      
      return c.json(createApiResponse(true, parsed));
    } catch (error) {
      console.error('Error validating repository:', error);
      return c.json(createApiResponse(false, null, 'Invalid request'), 400);
    }
  }
);