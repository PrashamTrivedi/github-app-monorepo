import { Hono } from 'hono';
import type { Env } from '../types.js';
import { generateInstallationToken } from '../lib/github-auth.js';
import { getRepositoryByName } from '../lib/database.js';

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

export const apiRoutes = new Hono<{ Bindings: Env }>();

// Get installations
apiRoutes.get('/installations', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM installations ORDER BY account_login'
    ).all();
    
    return c.json(createApiResponse(true, results));
  } catch (error) {
    console.error('Error fetching installations:', error);
    return c.json(createApiResponse(false, null, 'Failed to fetch installations'), 500);
  }
});

// Get repository information
apiRoutes.get('/repo/:owner/:repo', async (c) => {
  try {
    const owner = c.req.param('owner');
    const repo = c.req.param('repo');
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
});

// Get repository issues
apiRoutes.get('/repo/:owner/:repo/issues', async (c) => {
  try {
    const owner = c.req.param('owner');
    const repo = c.req.param('repo');
    const state = c.req.query('state') || 'open';
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
});

// Validate repository URL
apiRoutes.post('/validate-repo', async (c) => {
  try {
    const { url } = await c.req.json();
    const parsed = parseRepositoryUrl(url);
    
    if (!parsed) {
      return c.json(createApiResponse(false, null, 'Invalid GitHub repository URL'), 400);
    }
    
    return c.json(createApiResponse(true, parsed));
  } catch (error) {
    console.error('Error validating repository:', error);
    return c.json(createApiResponse(false, null, 'Invalid request'), 400);
  }
});