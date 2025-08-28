import jwt from 'jsonwebtoken';
import type { Env } from '../types.js';
import { Logger, PerformanceTimer } from './logger.js';

export interface GitHubInstallation {
  id: number;
  account: {
    id: number;
    login: string;
    type: 'User' | 'Organization';
  };
  permissions: Record<string, string>;
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
    private: boolean;
    clone_url: string;
  }>;
}

export interface InstallationToken {
  token: string;
  expires_at: string;
}

/**
 * Generate a GitHub App JWT token for authentication
 */
export function generateAppJWT(env: Env): string {
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  try {
    if (!env.GITHUB_APP_ID || !env.GITHUB_PRIVATE_KEY) {
      logger.error('github-auth', 'GitHub App credentials not configured', {
        hasAppId: !!env.GITHUB_APP_ID,
        hasPrivateKey: !!env.GITHUB_PRIVATE_KEY
      });
      throw new Error('GitHub App ID and Private Key are required');
    }

    logger.debug('github-auth', 'Generating GitHub App JWT', {
      appId: env.GITHUB_APP_ID
    });

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued at time (allow 60 seconds of clock skew)
      exp: now + (10 * 60), // JWT expires in 10 minutes
      iss: env.GITHUB_APP_ID // GitHub App ID
    };
    
    // Handle both RSA and PKCS#8 key formats
    let privateKey = env.GITHUB_PRIVATE_KEY;
    
    // If key is split into chunks (workaround for Cloudflare secret size limit)
    if (!privateKey && env.GITHUB_PRIVATE_KEY_CHUNK_1) {
      privateKey = [
        env.GITHUB_PRIVATE_KEY_CHUNK_1,
        env.GITHUB_PRIVATE_KEY_CHUNK_2
      ].filter(Boolean).join('');
    }
    
    if (!privateKey) {
      throw new Error('GitHub Private Key not found in environment or chunks');
    }
    
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    const jwt_token = jwt.sign(payload, privateKey, { 
      algorithm: 'RS256' 
    });

    const duration = timer.end();
    logger.logAuthEvent('jwt_generation', true, undefined, duration, {
      appId: env.GITHUB_APP_ID
    });

    return jwt_token;
  } catch (error) {
    const duration = timer.end();
    logger.logAuthEvent('jwt_generation', false, undefined, duration, {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Generate an installation access token for a specific installation
 */
export async function generateInstallationToken(
  installationId: number, 
  env: Env
): Promise<InstallationToken> {
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  logger.debug('github-auth', 'Generating installation token', {
    installationId
  });

  // Ensure GitHub app credentials are configured
  if (!env.GITHUB_APP_ID || !env.GITHUB_PRIVATE_KEY) {
    const duration = timer.end();
    logger.error('github-auth', 'GitHub App credentials not configured', {
      installationId,
      environment: env.ENVIRONMENT,
      hasAppId: !!env.GITHUB_APP_ID,
      hasPrivateKey: !!env.GITHUB_PRIVATE_KEY
    });
    logger.logAuthEvent('installation_token_error', false, installationId, duration);
    throw new Error('GitHub App credentials (GITHUB_APP_ID and GITHUB_PRIVATE_KEY) are required');
  }

  // Check cache first (if available)
  const cacheKey = `install_token_${installationId}`;
  let cached = null;
  if (env.TOKEN_CACHE) {
    try {
      cached = await env.TOKEN_CACHE.get(cacheKey);
      if (cached) {
        logger.debug('github-auth', 'Found cached installation token', {
          installationId,
          cacheKey
        });
      }
    } catch (error) {
      logger.warn('github-auth', 'Token cache not available', {
        installationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  if (cached) {
    const token = JSON.parse(cached) as InstallationToken;
    // Check if token expires in more than 5 minutes
    const expiresAt = new Date(token.expires_at).getTime();
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    
    if (expiresAt > fiveMinutesFromNow) {
      const duration = timer.end();
      logger.logAuthEvent('installation_token_cache_hit', true, installationId, duration, {
        expiresAt: token.expires_at
      });
      return token;
    } else {
      logger.debug('github-auth', 'Cached token expired, generating new one', {
        installationId,
        expiresAt: token.expires_at
      });
    }
  }
  
  try {
    const appJWT = generateAppJWT(env);
    const apiTimer = new PerformanceTimer();
    
    const endpoint = `https://api.github.com/app/installations/${installationId}/access_tokens`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appJWT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-App-Backend/1.0'
      }
    });
    
    const apiDuration = apiTimer.end();
    logger.logGitHubAPICall(endpoint, 'POST', response.status, apiDuration, {
      installationId,
      operation: 'generate_installation_token'
    });
    
    if (!response.ok) {
      const error = await response.text();
      const duration = timer.end();
      logger.logAuthEvent('installation_token_error', false, installationId, duration, {
        status: response.status,
        error
      });
      throw new Error(`Failed to generate installation token: ${response.status} ${error}`);
    }
    
    const data = await response.json() as InstallationToken;
    
    // Cache the token (expires in 1 hour, so cache for 55 minutes)
    if (env.TOKEN_CACHE) {
      try {
        await env.TOKEN_CACHE.put(cacheKey, JSON.stringify(data), { 
          expirationTtl: 55 * 60 
        });
        logger.debug('github-auth', 'Cached installation token', {
          installationId,
          cacheKey,
          expiresAt: data.expires_at
        });
      } catch (error) {
        logger.warn('github-auth', 'Failed to cache token', {
          installationId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const duration = timer.end();
    logger.logAuthEvent('installation_token_success', true, installationId, duration, {
      expiresAt: data.expires_at
    });
    
    return data;
  } catch (error) {
    const duration = timer.end();
    logger.logAuthEvent('installation_token_fallback', false, installationId, duration, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    logger.error('github-auth', 'Error generating installation token, falling back to mock', {
      installationId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Fallback to mock token for development
    return {
      token: 'mock-github-token-for-development',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    };
  }
}

/**
 * Get installation details from GitHub
 */
export async function getInstallation(
  installationId: number,
  env: Env
): Promise<GitHubInstallation> {
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  logger.debug('github-auth', 'Getting installation details', {
    installationId
  });
  
  try {
    const appJWT = generateAppJWT(env);
    
    const endpoint = `https://api.github.com/app/installations/${installationId}`;
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${appJWT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-App-Backend/1.0'
      }
    });
    
    const duration = timer.end();
    logger.logGitHubAPICall(endpoint, 'GET', response.status, duration, {
      installationId,
      operation: 'get_installation'
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error('github-auth', 'Failed to get installation', {
        installationId,
        status: response.status,
        error
      });
      throw new Error(`Failed to get installation: ${response.status} ${error}`);
    }
    
    const installation = await response.json() as GitHubInstallation;
    logger.info('github-auth', 'Successfully retrieved installation details', {
      installationId,
      accountLogin: installation.account?.login
    });
    
    return installation;
  } catch (error) {
    const duration = timer.end();
    logger.error('github-auth', 'Error getting installation', {
      installationId,
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get repositories accessible by an installation
 */
export async function getInstallationRepositories(
  installationId: number,
  env: Env
): Promise<Array<{
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  clone_url: string;
}>> {
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  logger.debug('github-auth', 'Getting installation repositories', {
    installationId
  });
  
  try {
    const tokenData = await generateInstallationToken(installationId, env);
    
    const endpoint = 'https://api.github.com/installation/repositories';
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${tokenData.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-App-Backend/1.0'
      }
    });
    
    const duration = timer.end();
    logger.logGitHubAPICall(endpoint, 'GET', response.status, duration, {
      installationId,
      operation: 'get_installation_repositories'
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error('github-auth', 'Failed to get repositories', {
        installationId,
        status: response.status,
        error
      });
      throw new Error(`Failed to get repositories: ${response.status} ${error}`);
    }
    
    const data = await response.json() as { repositories: Array<{
      id: number;
      name: string;
      full_name: string;
      owner: { login: string };
      private: boolean;
      clone_url: string;
    }> };
    
    const repositories = data.repositories || [];
    logger.info('github-auth', 'Successfully retrieved installation repositories', {
      installationId,
      repositoryCount: repositories.length,
      repositories: repositories.map(r => r.full_name)
    });
    
    return repositories;
  } catch (error) {
    const duration = timer.end();
    logger.error('github-auth', 'Error getting installation repositories', {
      installationId,
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Check if the GitHub App is installed on a specific repository
 */
export async function checkRepositoryInstallation(
  owner: string,
  repo: string,
  env: Env
): Promise<{
  isInstalled: boolean;
  installationId?: number;
  error?: string;
}> {
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  logger.debug('github-auth', 'Checking repository installation status', {
    owner,
    repo,
    fullName: `${owner}/${repo}`
  });
  
  try {
    if (!env.GITHUB_APP_ID || !env.GITHUB_PRIVATE_KEY) {
      const duration = timer.end();
      logger.error('github-auth', 'GitHub App credentials not configured', {
        owner,
        repo,
        environment: env.ENVIRONMENT,
        hasAppId: !!env.GITHUB_APP_ID,
        hasPrivateKey: !!env.GITHUB_PRIVATE_KEY,
        duration
      });
      return {
        isInstalled: false,
        error: 'GitHub App credentials (GITHUB_APP_ID and GITHUB_PRIVATE_KEY) are required'
      };
    }

    const appJWT = generateAppJWT(env);
    
    // Get all installations and check if the repository is accessible
    const endpoint = 'https://api.github.com/app/installations';
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${appJWT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-App-Backend/1.0'
      }
    });
    
    const duration = timer.end();
    logger.logGitHubAPICall(endpoint, 'GET', response.status, duration, {
      owner,
      repo,
      operation: 'check_repository_installation'
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error('github-auth', 'Failed to fetch installations for repository check', {
        owner,
        repo,
        status: response.status,
        error
      });
      return {
        isInstalled: false,
        error: `GitHub API error: ${response.status}`
      };
    }
    
    const installations = await response.json() as GitHubInstallation[];
    
    // Check each installation to see if it has access to the repository
    for (const installation of installations) {
      try {
        const repositories = await getInstallationRepositories(installation.id, env);
        const targetRepo = repositories.find(r => r.full_name === `${owner}/${repo}`);
        
        if (targetRepo) {
          logger.info('github-auth', 'Found repository in installation', {
            owner,
            repo,
            installationId: installation.id,
            accountLogin: installation.account.login
          });
          return {
            isInstalled: true,
            installationId: installation.id
          };
        }
      } catch (error) {
        logger.warn('github-auth', 'Error checking installation repositories', {
          installationId: installation.id,
          error: error instanceof Error ? error.message : String(error)
        });
        continue; // Try next installation
      }
    }
    
    logger.info('github-auth', 'Repository not found in any installation', {
      owner,
      repo,
      installationsChecked: installations.length
    });
    
    return {
      isInstalled: false,
      error: 'GitHub App not installed on this repository'
    };
  } catch (error) {
    const duration = timer.end();
    logger.error('github-auth', 'Error checking repository installation', {
      owner,
      repo,
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      isInstalled: false,
      error: error instanceof Error ? error.message : 'Unknown error checking installation'
    };
  }
}

/**
 * Validate installation access for a specific repository by installation ID
 */
export async function validateInstallationAccess(
  installationId: number,
  owner: string,
  repo: string,
  env: Env
): Promise<{
  hasAccess: boolean;
  error?: string;
}> {
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  logger.debug('github-auth', 'Validating installation access to repository', {
    installationId,
    owner,
    repo
  });
  
  try {
    if (!env.GITHUB_APP_ID || !env.GITHUB_PRIVATE_KEY) {
      logger.warn('github-auth', 'GitHub credentials not configured, assuming access for development', {
        installationId,
        owner,
        repo,
        environment: env.ENVIRONMENT
      });
      return { hasAccess: true };
    }

    const repositories = await getInstallationRepositories(installationId, env);
    const targetRepo = repositories.find(r => r.full_name === `${owner}/${repo}`);
    
    const duration = timer.end();
    
    if (targetRepo) {
      logger.info('github-auth', 'Installation has access to repository', {
        installationId,
        owner,
        repo,
        repositoryId: targetRepo.id,
        duration
      });
      return { hasAccess: true };
    } else {
      
      logger.warn('github-auth', 'Installation does not have access to repository', {
        installationId,
        owner,
        repo,
        availableRepos: repositories.map(r => r.full_name),
        duration
      });
      return {
        hasAccess: false,
        error: 'Installation does not have access to this repository'
      };
    }
  } catch (error) {
    const duration = timer.end();
    logger.error('github-auth', 'Error validating installation access', {
      installationId,
      owner,
      repo,
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      hasAccess: false,
      error: error instanceof Error ? error.message : 'Error validating access'
    };
  }
}

/**
 * Get all installations with enhanced error handling and validation
 */
export async function getAllInstallationsFromGitHub(
  env: Env
): Promise<{
  installations: GitHubInstallation[];
  source: 'github' | 'database' | 'mock';
  error?: string;
}> {
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  logger.debug('github-auth', 'Fetching all installations from GitHub');
  
  // Ensure GitHub app credentials are configured
  if (!env.GITHUB_APP_ID || !env.GITHUB_PRIVATE_KEY) {
    const duration = timer.end();
    logger.error('github-auth', 'GitHub App credentials not configured', {
      environment: env.ENVIRONMENT,
      hasAppId: !!env.GITHUB_APP_ID,
      hasPrivateKey: !!env.GITHUB_PRIVATE_KEY,
      duration
    });
    return {
      installations: [],
      source: 'github',
      error: 'GitHub App credentials (GITHUB_APP_ID and GITHUB_PRIVATE_KEY) are required'
    };
  }
  
  try {
    const appJWT = generateAppJWT(env);
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
      operation: 'get_all_installations_enhanced'
    });
    
    if (!response.ok) {
      const error = await response.text();
      const duration = timer.end();
      logger.error('github-auth', 'GitHub API error fetching installations', {
        status: response.status,
        error,
        duration
      });
      return {
        installations: [],
        source: 'github',
        error: `GitHub API error: ${response.status} - ${error}`
      };
    }
    
    const installations = await response.json() as GitHubInstallation[];
    const duration = timer.end();
    
    logger.info('github-auth', 'Successfully fetched installations from GitHub', {
      installationCount: installations.length,
      duration
    });
    
    return {
      installations,
      source: 'github'
    };
  } catch (error) {
    const duration = timer.end();
    logger.error('github-auth', 'Error fetching installations from GitHub', {
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      installations: [],
      source: 'github',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  env: Env
): Promise<boolean> {
  const logger = new Logger(env);
  const timer = new PerformanceTimer();
  
  try {
    // Allow for development mode without webhook secret
    if (!secret) {
      logger.warn('webhook-auth', 'No webhook secret provided, skipping signature verification (development mode)', {
        environment: env.ENVIRONMENT
      });
      const duration = timer.end();
      logger.logAuthEvent('webhook_signature_skip', true, undefined, duration, {
        reason: 'no_secret_development_mode'
      });
      return true;
    }

    if (!signature) {
      logger.error('webhook-auth', 'No signature provided for webhook verification', {
        hasPayload: !!payload,
        payloadLength: payload.length
      });
      const duration = timer.end();
      logger.logAuthEvent('webhook_signature_missing', false, undefined, duration);
      return false;
    }

    logger.debug('webhook-auth', 'Verifying webhook signature', {
      signatureLength: signature.length,
      payloadLength: payload.length,
      signaturePrefix: signature.substring(0, 10)
    });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const expected = `sha256=${expectedHex}`;
    
    // Use timing-safe comparison
    if (signature.length !== expected.length) {
      const duration = timer.end();
      logger.logAuthEvent('webhook_signature_length_mismatch', false, undefined, duration, {
        signatureLength: signature.length,
        expectedLength: expected.length
      });
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    
    const isValid = result === 0;
    const duration = timer.end();
    
    logger.logAuthEvent('webhook_signature_verification', isValid, undefined, duration, {
      signatureValid: isValid
    });
    
    if (!isValid) {
      logger.error('webhook-auth', 'Webhook signature verification failed', {
        signaturePrefix: signature.substring(0, 10),
        expectedPrefix: expected.substring(0, 10)
      });
    } else {
      logger.debug('webhook-auth', 'Webhook signature verification successful');
    }
    
    return isValid;
  } catch (error) {
    const duration = timer.end();
    logger.logAuthEvent('webhook_signature_error', false, undefined, duration, {
      error: error instanceof Error ? error.message : String(error)
    });
    logger.error('webhook-auth', 'Error verifying webhook signature', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}