import { Hono } from 'hono';
import type { GitHubRepository, GitHubIssue, ApiResponse } from '@github-app/shared';
import { createApiResponse, parseRepositoryUrl } from '@github-app/shared';
import type { Env } from '../types.js';

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
    
    const octokit = c.get('octokit');
    const installation = await octokit.getInstallationOctokit(123); // Replace with actual installation ID
    
    const { data: repository } = await installation.rest.repos.get({
      owner,
      repo,
    });
    
    return c.json(createApiResponse<GitHubRepository>(true, repository));
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
    
    const octokit = c.get('octokit');
    const installation = await octokit.getInstallationOctokit(123); // Replace with actual installation ID
    
    const { data: issues } = await installation.rest.issues.listForRepo({
      owner,
      repo,
      state: state as 'open' | 'closed' | 'all',
    });
    
    return c.json(createApiResponse<GitHubIssue[]>(true, issues));
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