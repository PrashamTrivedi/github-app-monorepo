import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../types.js';
import { 
  generateInstallationToken, 
  checkRepositoryInstallation,
  validateInstallationAccess,
  getAllInstallationsFromGitHub
} from '../lib/github-auth.js';
import { 
  getRepositoryByName, 
  checkRepositoryInstallationStatus
} from '../lib/database.js';
import { Logger, PerformanceTimer } from '../lib/logger.js';
import {
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

// Get installations - simplified without OpenAPI for now due to schema complexity
apiRoutes.get('/installations', async (c) => {
    const logger = new Logger(c.env);
    const timer = new PerformanceTimer();
    
    logger.info('api', 'Fetching installations', {
      hasCredentials: !!(c.env.GITHUB_APP_ID && c.env.GITHUB_PRIVATE_KEY),
      environment: c.env.ENVIRONMENT
    });
    
    try {
      // Use enhanced GitHub API fetching with better error handling
      const githubResult = await getAllInstallationsFromGitHub(c.env);
      
      if (githubResult.source === 'github' && githubResult.installations.length > 0) {
        const totalDuration = timer.end();
        logger.info('api', 'Successfully fetched installations from GitHub API', {
          installationCount: githubResult.installations.length,
          duration: totalDuration,
          source: 'github_api'
        });
        return c.json(createApiResponse(true, githubResult.installations));
      }
      
      if (githubResult.source === 'mock') {
        const totalDuration = timer.end();
        logger.info('api', 'Using mock installations for development', {
          installationCount: githubResult.installations.length,
          duration: totalDuration,
          source: 'mock_data'
        });
        return c.json(createApiResponse(true, githubResult.installations));
      }
      
      if (githubResult.error) {
        logger.warn('api', 'GitHub API failed, falling back to database', {
          error: githubResult.error
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
});

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
        // Try to check if repository exists on GitHub but app is not installed
        logger.debug('api', 'Repository not in database, checking GitHub installation status');
        
        const installationCheck = await checkRepositoryInstallation(owner, repo, c.env);
        
        if (!installationCheck.isInstalled) {
          const duration = timer.end();
          logger.warn('api', 'GitHub App not installed on repository', {
            owner,
            repo,
            fullName,
            error: installationCheck.error,
            duration
          });
          return c.json(
            createApiResponse(
              false, 
              null, 
              installationCheck.error || 'GitHub App not installed on this repository'
            ), 
            404
          );
        }
        
        const duration = timer.end();
        logger.warn('api', 'Repository found on GitHub but not synced to database', {
          fullName,
          installationId: installationCheck.installationId,
          duration
        });
        return c.json(
          createApiResponse(
            false, 
            null, 
            'Repository not synced. Please trigger a webhook or refresh installation.'
          ), 
          404
        );
      }
      
      logger.debug('api', 'Found repository in database', {
        fullName,
        installationId: dbRepository.installation_id
      });
      
      // Validate that the installation still has access to this repository
      const accessValidation = await validateInstallationAccess(
        dbRepository.installation_id, 
        owner, 
        repo, 
        c.env
      );
      
      if (!accessValidation.hasAccess) {
        const duration = timer.end();
        logger.warn('api', 'Installation no longer has access to repository', {
          fullName,
          installationId: dbRepository.installation_id,
          error: accessValidation.error,
          duration
        });
        return c.json(
          createApiResponse(
            false, 
            null, 
            'GitHub App no longer has access to this repository'
          ), 
          404
        );
      }
      
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
        const errorText = await response.text();
        
        if (response.status === 404) {
          logger.warn('api', 'Repository not found via GitHub API', {
            owner,
            repo,
            status: response.status,
            duration
          });
          return c.json(
            createApiResponse(
              false, 
              null, 
              'Repository not found or GitHub App does not have access'
            ), 
            404
          );
        } else {
          logger.error('api', 'GitHub API error fetching repository', {
            owner,
            repo,
            status: response.status,
            error: errorText,
            duration
          });
          return c.json(
            createApiResponse(
              false, 
              null, 
              `GitHub API error: ${response.status}`
            ), 
            response.status >= 500 ? 500 : 404
          );
        }
      }
      
      const repository = await response.json();
      const duration = timer.end();
      
      logger.info('api', 'Successfully fetched repository information', {
        owner,
        repo,
        repositoryId: (repository as any).id,
        duration
      });
      
      return c.json(createApiResponse(true, repository));
    } catch (error) {
      const duration = timer.end();
      
      // Enhanced error handling for repository endpoint
      const { owner: ownerParam, repo: repoParam } = c.req.valid('param');
      if (error instanceof Error && error.message.includes('installation')) {
        logger.error('api', 'Installation error fetching repository', {
          owner: ownerParam,
          repo: repoParam,
          error: error.message,
          duration
        });
        return c.json(
          createApiResponse(
            false, 
            null, 
            'GitHub App not properly installed or configured'
          ), 
          500
        );
      }
      
      logger.error('api', 'Error fetching repository', {
        owner: ownerParam,
        repo: repoParam,
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      return c.json(
        createApiResponse(
          false, 
          null, 
          'Repository not found or GitHub App not installed'
        ), 
        404
      );
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
        // Try to check if repository exists on GitHub but app is not installed
        logger.debug('api', 'Repository not in database, checking GitHub installation status');
        
        const installationCheck = await checkRepositoryInstallation(owner, repo, c.env);
        
        if (!installationCheck.isInstalled) {
          const duration = timer.end();
          logger.warn('api', 'GitHub App not installed on repository', {
            owner,
            repo,
            fullName,
            error: installationCheck.error,
            duration
          });
          return c.json(
            createApiResponse(
              false, 
              null, 
              installationCheck.error || 'GitHub App not installed on this repository'
            ), 
            404
          );
        }
        
        const duration = timer.end();
        logger.warn('api', 'Repository found on GitHub but not synced to database', {
          fullName,
          installationId: installationCheck.installationId,
          duration
        });
        return c.json(
          createApiResponse(
            false, 
            null, 
            'Repository not synced. Please trigger a webhook or refresh installation.'
          ), 
          404
        );
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
        const errorText = await response.text();
        
        if (response.status === 404) {
          logger.warn('api', 'Repository or issues not accessible via GitHub API', {
            owner,
            repo,
            state,
            status: response.status,
            duration
          });
          return c.json(
            createApiResponse(
              false, 
              null, 
              'Repository not found or GitHub App does not have access to issues'
            ), 
            404
          );
        } else {
          logger.error('api', 'Failed to fetch issues from GitHub API', {
            owner,
            repo,
            state,
            status: response.status,
            error: errorText,
            duration
          });
          return c.json(
            createApiResponse(
              false, 
              null, 
              `GitHub API error: ${response.status}`
            ), 
            response.status >= 500 ? 500 : 404
          );
        }
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
      
      // Enhanced error handling for issues endpoint
      const { owner: ownerParam, repo: repoParam } = c.req.valid('param');
      const { state: stateParam } = c.req.valid('query');
      if (error instanceof Error && error.message.includes('installation')) {
        logger.error('api', 'Installation error fetching issues', {
          owner: ownerParam,
          repo: repoParam,
          state: stateParam,
          error: error.message,
          duration
        });
        return c.json(
          createApiResponse(
            false, 
            null, 
            'GitHub App not properly installed or configured for this repository'
          ), 
          500
        );
      }
      
      logger.error('api', 'Error fetching issues', {
        owner: ownerParam,
        repo: repoParam,
        state: stateParam,
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      return c.json(
        createApiResponse(
          false, 
          null, 
          'Failed to fetch issues - repository may not be accessible or app not installed'
        ), 
        500
      );
    }
  }
);

// Check repository installation status - simplified route
apiRoutes.get('/repo/:owner/:repo/installation-status', async (c) => {
    const logger = new Logger(c.env);
    const timer = new PerformanceTimer();
    
    try {
      const { owner, repo } = c.req.param();
      const fullName = `${owner}/${repo}`;
      
      logger.info('api', 'Checking repository installation status', {
        owner,
        repo,
        fullName
      });
      
      // Check database first for quick lookup
      const dbStatus = await checkRepositoryInstallationStatus(c.env.DB, fullName);
      
      // If found in database, validate GitHub access
      if (dbStatus.exists && dbStatus.installationId) {
        logger.debug('api', 'Found repository in database, validating GitHub access');
        
        const accessValidation = await validateInstallationAccess(
          dbStatus.installationId, 
          owner, 
          repo, 
          c.env
        );
        
        const duration = timer.end();
        
        if (accessValidation.hasAccess) {
          logger.info('api', 'Repository installation confirmed', {
            fullName,
            installationId: dbStatus.installationId,
            source: 'database_validated',
            duration
          });
          
          return c.json(createApiResponse(true, {
            isInstalled: true,
            installationId: dbStatus.installationId,
            hasAccess: true,
            source: 'database',
            repository: dbStatus.repository
          }));
        } else {
          logger.warn('api', 'Installation exists in database but no GitHub access', {
            fullName,
            installationId: dbStatus.installationId,
            error: accessValidation.error,
            duration
          });
          
          return c.json(createApiResponse(false, {
            isInstalled: false,
            hasAccess: false,
            source: 'database',
            repository: dbStatus.repository
          }, accessValidation.error));
        }
      }
      
      // Not in database, check GitHub directly
      logger.debug('api', 'Repository not in database, checking GitHub directly');
      const installationCheck = await checkRepositoryInstallation(owner, repo, c.env);
      
      const duration = timer.end();
      
      if (installationCheck.isInstalled) {
        logger.info('api', 'Repository found on GitHub with app installed', {
          fullName,
          installationId: installationCheck.installationId,
          source: 'github_api',
          duration
        });
        
        return c.json(createApiResponse(true, {
          isInstalled: true,
          installationId: installationCheck.installationId,
          hasAccess: true,
          source: 'github'
        }));
      } else {
        logger.warn('api', 'Repository installation check failed', {
          fullName,
          error: installationCheck.error,
          source: 'github_api',
          duration
        });
        
        return c.json(createApiResponse(false, {
          isInstalled: false,
          hasAccess: false,
          source: 'github'
        }, installationCheck.error), 404);
      }
    } catch (error) {
      const duration = timer.end();
      logger.error('api', 'Error checking repository installation status', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      return c.json(
        createApiResponse(false, null, 'Failed to check installation status'), 
        500
      );
    }
});

// Handle GitHub App installation callback
apiRoutes.get('/installation/callback', async (c) => {
    const logger = new Logger(c.env);
    const timer = new PerformanceTimer();
    
    try {
      const installationId = c.req.query('installation_id');
      const setupAction = c.req.query('setup_action');
      const state = c.req.query('state'); // Return URL
      
      logger.info('api', 'Processing GitHub App installation callback', {
        installationId,
        setupAction,
        hasState: !!state
      });
      
      if (!installationId) {
        const duration = timer.end();
        logger.warn('api', 'Installation callback missing installation_id', {
          query: c.req.query(),
          duration
        });
        return c.json(createApiResponse(false, null, 'Missing installation_id parameter'), 400);
      }
      
      if (!c.env.GITHUB_APP_ID || !c.env.GITHUB_PRIVATE_KEY) {
        const duration = timer.end();
        logger.warn('api', 'GitHub App not configured for installation callback', {
          installationId,
          setupAction,
          duration
        });
        
        // For development, return success but indicate mock mode
        return c.json(createApiResponse(true, {
          installationId: parseInt(installationId),
          message: 'Installation callback received (development mode)',
          mock: true
        }));
      }
      
      try {
        // Fetch installation details from GitHub
        const installation = await getInstallation(parseInt(installationId), c.env);
        
        // Get installation repositories
        const repositories = await getInstallationRepositories(parseInt(installationId), c.env);
        
        // Store installation with repositories
        const installationWithRepos = {
          ...installation,
          repositories
        };
        
        const dbTimer = new PerformanceTimer();
        await storeInstallation(c.env.DB, installationWithRepos);
        const dbDuration = dbTimer.end();
        
        logger.logDatabaseOperation('INSERT installation callback', 'installations', dbDuration, {
          installationId: installation.id,
          accountLogin: installation.account.login,
          repositoryCount: repositories.length
        });
        
        const duration = timer.end();
        logger.info('api', 'Installation callback processed successfully', {
          installationId: installation.id,
          accountLogin: installation.account.login,
          repositoryCount: repositories.length,
          duration
        });
        
        return c.json(createApiResponse(true, {
          installationId: installation.id,
          account: installation.account,
          repositoryCount: repositories.length,
          message: 'Installation synchronized successfully'
        }));
        
      } catch (error) {
        const duration = timer.end();
        logger.error('api', 'Error processing installation callback', {
          installationId,
          error: error instanceof Error ? error.message : String(error),
          duration
        });
        return c.json(
          createApiResponse(false, null, 'Failed to process installation'), 
          500
        );
      }
    } catch (error) {
      const duration = timer.end();
      logger.error('api', 'Installation callback error', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      return c.json(createApiResponse(false, null, 'Installation callback failed'), 500);
    }
});

// Check GitHub App configuration status
apiRoutes.get('/github-app/status', async (c) => {
    const logger = new Logger(c.env);
    const timer = new PerformanceTimer();
    
    try {
      const hasCredentials = !!(c.env.GITHUB_APP_ID && c.env.GITHUB_PRIVATE_KEY);
      
      let appInfo = null;
      if (hasCredentials) {
        try {
          // Try to generate a JWT to test credentials
          const jwt = generateAppJWT(c.env);
          const isValid = !!jwt;
          
          appInfo = {
            appId: c.env.GITHUB_APP_ID,
            configured: true,
            credentialsValid: isValid
          };
        } catch (error) {
          appInfo = {
            appId: c.env.GITHUB_APP_ID,
            configured: true,
            credentialsValid: false,
            error: error instanceof Error ? error.message : 'Invalid credentials'
          };
        }
      } else {
        appInfo = {
          configured: false,
          mode: 'development'
        };
      }
      
      const duration = timer.end();
      logger.info('api', 'GitHub App status checked', {
        configured: hasCredentials,
        duration
      });
      
      return c.json(createApiResponse(true, appInfo));
    } catch (error) {
      const duration = timer.end();
      logger.error('api', 'Error checking GitHub App status', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      return c.json(createApiResponse(false, null, 'Failed to check app status'), 500);
    }
});

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
      
      // Also check installation status for the parsed repository
      try {
        const installationCheck = await checkRepositoryInstallation(parsed.owner, parsed.repo, c.env);
        
        logger.info('api', 'Successfully validated repository URL with installation check', {
          owner: parsed.owner,
          repo: parsed.repo,
          isInstalled: installationCheck.isInstalled,
          duration
        });
        
        return c.json(createApiResponse(true, {
          ...parsed,
          installationStatus: {
            isInstalled: installationCheck.isInstalled,
            installationId: installationCheck.installationId,
            error: installationCheck.error
          }
        }));
      } catch (installationError) {
        // If installation check fails, still return the parsed URL
        logger.warn('api', 'Repository URL valid but installation check failed', {
          owner: parsed.owner,
          repo: parsed.repo,
          installationError: installationError instanceof Error ? installationError.message : String(installationError),
          duration
        });
        
        return c.json(createApiResponse(true, {
          ...parsed,
          installationStatus: {
            isInstalled: false,
            error: 'Could not verify installation status'
          }
        }));
      }
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