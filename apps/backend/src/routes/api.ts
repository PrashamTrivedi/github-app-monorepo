import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../types.js';
import { generateInstallationToken } from '../lib/github-auth.js';
import { getRepositoryByName } from '../lib/database.js';
import { Logger, PerformanceTimer } from '../lib/logger.js';
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

// Debug endpoint to check environment variables
apiRoutes.get('/debug/env', async (c) => {
  return c.json({
    hasGitHubAppId: !!c.env.GITHUB_APP_ID,
    hasGitHubPrivateKey: !!c.env.GITHUB_PRIVATE_KEY,
    appIdLength: c.env.GITHUB_APP_ID?.length || 0,
    keyStartsWith: c.env.GITHUB_PRIVATE_KEY?.substring(0, 30) || 'not found'
  });
});

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
    const logger = new Logger(c.env);
    const timer = new PerformanceTimer();
    
    logger.info('api', 'Fetching installations', {
      hasCredentials: !!(c.env.GITHUB_APP_ID && c.env.GITHUB_PRIVATE_KEY),
      environment: c.env.ENVIRONMENT
    });
    
    try {
      // Try to fetch installations from GitHub API first
      if (c.env.GITHUB_APP_ID && c.env.GITHUB_PRIVATE_KEY) {
        logger.debug('api', 'Attempting GitHub API fetch for installations');
        
        try {
          const { generateAppJWT } = await import('../lib/github-auth.js');
          const appJWT = generateAppJWT(c.env);
          
          const apiTimer = new PerformanceTimer();
          const endpoint = 'https://api.github.com/app/installations';
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${appJWT}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'GitHub-App-Backend/1.0'
            }
          });
          
          const apiDuration = apiTimer.end();
          logger.logGitHubAPICall(endpoint, 'GET', response.status, apiDuration, {
            operation: 'get_all_installations'
          });
          
          if (response.ok) {
            const installations = await response.json() as any[];
            const totalDuration = timer.end();
            
            logger.info('api', 'Successfully fetched installations from GitHub API', {
              installationCount: installations.length,
              duration: totalDuration,
              source: 'github_api'
            });
            
            return c.json(createApiResponse(true, installations));
          } else {
            const error = await response.text();
            logger.error('api', 'GitHub API error for installations', {
              status: response.status,
              error: error,
              duration: apiDuration
            });
          }
        } catch (githubError) {
          logger.error('api', 'Error fetching installations from GitHub API', {
            error: githubError instanceof Error ? githubError.message : String(githubError)
          });
        }
      } else {
        logger.info('api', 'GitHub credentials not available, falling back to database', {
          hasAppId: !!c.env.GITHUB_APP_ID,
          hasPrivateKey: !!c.env.GITHUB_PRIVATE_KEY
        });
      }
      
      // Fallback to database
      logger.debug('api', 'Fetching installations from database');
      const dbTimer = new PerformanceTimer();
      const { results } = await c.env.DB.prepare(
        'SELECT * FROM installations ORDER BY account_login'
      ).all();
      
      const dbDuration = dbTimer.end();
      const totalDuration = timer.end();
      
      logger.logDatabaseOperation('SELECT installations', 'installations', dbDuration, {
        resultCount: results.length
      });
      
      logger.info('api', 'Successfully fetched installations from database', {
        installationCount: results.length,
        duration: totalDuration,
        source: 'database'
      });
      
      return c.json(createApiResponse(true, results));
    } catch (error) {
      const duration = timer.end();
      logger.error('api', 'Error fetching installations', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
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
    const logger = new Logger(c.env);
    const timer = new PerformanceTimer();
    
    try {
      const { owner, repo } = c.req.valid('param');
      const fullName = `${owner}/${repo}`;
      
      logger.info('api', 'Fetching repository information', {
        owner,
        repo,
        fullName
      });
      
      // Get repository from database to find installation ID
      const dbTimer = new PerformanceTimer();
      const dbRepository = await getRepositoryByName(c.env.DB, fullName);
      const dbDuration = dbTimer.end();
      
      logger.logDatabaseOperation('SELECT repository by name', 'repositories', dbDuration, {
        fullName,
        found: !!dbRepository
      });
      
      if (!dbRepository) {
        const duration = timer.end();
        logger.warn('api', 'Repository not found in database', {
          fullName,
          duration
        });
        return c.json(createApiResponse(false, null, 'Repository not found or app not installed'), 404);
      }
      
      logger.debug('api', 'Found repository in database', {
        fullName,
        installationId: dbRepository.installation_id
      });
      
      // Generate installation token
      const tokenData = await generateInstallationToken(dbRepository.installation_id, c.env);
      
      // Make GitHub API call
      const apiTimer = new PerformanceTimer();
      const endpoint = `https://api.github.com/repos/${owner}/${repo}`;
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-App-Backend/1.0'
        }
      });
      
      const apiDuration = apiTimer.end();
      logger.logGitHubAPICall(endpoint, 'GET', response.status, apiDuration, {
        owner,
        repo,
        installationId: dbRepository.installation_id,
        operation: 'get_repository'
      });
      
      if (!response.ok) {
        const duration = timer.end();
        logger.error('api', 'GitHub API error fetching repository', {
          owner,
          repo,
          status: response.status,
          duration
        });
        return c.json(createApiResponse(false, null, 'Repository not found'), 404);
      }
      
      const repository = await response.json();
      const duration = timer.end();
      
      logger.info('api', 'Successfully fetched repository information', {
        owner,
        repo,
        repositoryId: repository.id,
        duration
      });
      
      return c.json(createApiResponse(true, repository));
    } catch (error) {
      const duration = timer.end();
      logger.error('api', 'Error fetching repository', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
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
    const logger = new Logger(c.env);
    const timer = new PerformanceTimer();
    
    try {
      const { owner, repo } = c.req.valid('param');
      const { state = 'open' } = c.req.valid('query');
      const fullName = `${owner}/${repo}`;
      
      logger.info('api', 'Fetching repository issues', {
        owner,
        repo,
        state,
        fullName
      });
      
      // Get repository from database to find installation ID
      const dbTimer = new PerformanceTimer();
      const dbRepository = await getRepositoryByName(c.env.DB, fullName);
      const dbDuration = dbTimer.end();
      
      logger.logDatabaseOperation('SELECT repository by name', 'repositories', dbDuration, {
        fullName,
        found: !!dbRepository
      });
      
      if (!dbRepository) {
        const duration = timer.end();
        logger.warn('api', 'Repository not found for issues fetch', {
          fullName,
          duration
        });
        return c.json(createApiResponse(false, null, 'Repository not found or app not installed'), 404);
      }
      
      // Generate installation token
      const tokenData = await generateInstallationToken(dbRepository.installation_id, c.env);
      
      // Make GitHub API call
      const apiTimer = new PerformanceTimer();
      const endpoint = `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}`;
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-App-Backend/1.0'
        }
      });
      
      const apiDuration = apiTimer.end();
      logger.logGitHubAPICall(endpoint, 'GET', response.status, apiDuration, {
        owner,
        repo,
        state,
        installationId: dbRepository.installation_id,
        operation: 'get_repository_issues'
      });
      
      if (!response.ok) {
        const duration = timer.end();
        logger.error('api', 'Failed to fetch issues from GitHub API', {
          owner,
          repo,
          state,
          status: response.status,
          duration
        });
        return c.json(createApiResponse(false, null, 'Failed to fetch issues'), 500);
      }
      
      const issues = await response.json();
      const duration = timer.end();
      
      logger.info('api', 'Successfully fetched repository issues', {
        owner,
        repo,
        state,
        issueCount: issues.length,
        duration
      });
      
      return c.json(createApiResponse(true, issues));
    } catch (error) {
      const duration = timer.end();
      logger.error('api', 'Error fetching issues', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
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
    const logger = new Logger(c.env);
    const timer = new PerformanceTimer();
    
    try {
      const { url } = c.req.valid('json');
      
      logger.info('api', 'Validating repository URL', {
        url: url ? url.substring(0, 50) + '...' : 'undefined'
      });
      
      const parsed = parseRepositoryUrl(url);
      const duration = timer.end();
      
      if (!parsed) {
        logger.warn('api', 'Invalid repository URL provided', {
          url: url ? url.substring(0, 100) : 'undefined',
          duration
        });
        return c.json(createApiResponse(false, null, 'Invalid GitHub repository URL'), 400);
      }
      
      logger.info('api', 'Successfully validated repository URL', {
        owner: parsed.owner,
        repo: parsed.repo,
        duration
      });
      
      return c.json(createApiResponse(true, parsed));
    } catch (error) {
      const duration = timer.end();
      logger.error('api', 'Error validating repository URL', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      return c.json(createApiResponse(false, null, 'Invalid request'), 400);
    }
  }
);