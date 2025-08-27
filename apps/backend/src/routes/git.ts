import { Hono } from 'hono';
import type { Env } from '../types.js';
import { generateInstallationToken } from '../lib/github-auth.js';

// Simple response helper since we can't import from shared
function createApiResponse<T>(success: boolean, data?: T | null, error?: string) {
  return { success, data, error };
}

// Git operation type since we can't import from shared
interface GitOperation {
  type: 'clone' | 'pull' | 'push' | 'commit';
  repository: string;
  branch?: string;
  message?: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
}
import { 
  getRepositoryByName, 
  createGitOperation, 
  updateGitOperation, 
  getGitOperation, 
  getRecentGitOperations 
} from '../lib/database.js';
import { GitContainerService } from '../lib/git-container.js';

export const gitRoutes = new Hono<{ Bindings: Env }>();

// Execute git operations using Cloudflare containers
gitRoutes.post('/operation', async (c) => {
  try {
    const operation: GitOperation = await c.req.json();
    
    const result = await executeGitOperation(c, operation);
    
    return c.json(createApiResponse(true, result));
  } catch (error) {
    console.error('Git operation error:', error);
    return c.json(createApiResponse(false, null, 'Git operation failed'), 500);
  }
});

// Clone repository
gitRoutes.post('/clone', async (c) => {
  try {
    const { repository, branch } = await c.req.json();
    
    const operation: GitOperation = {
      type: 'clone',
      repository,
      branch: branch || 'main'
    };
    
    const result = await executeGitOperation(c, operation);
    
    return c.json(createApiResponse(true, result));
  } catch (error) {
    console.error('Clone error:', error);
    return c.json(createApiResponse(false, null, 'Clone operation failed'), 500);
  }
});

// Commit and push changes
gitRoutes.post('/commit', async (c) => {
  try {
    const { repository, message, files, branch } = await c.req.json();
    
    const operation: GitOperation = {
      type: 'commit',
      repository,
      message,
      files,
      branch: branch || 'main'
    };
    
    const result = await executeGitOperation(c, operation);
    
    return c.json(createApiResponse(true, result));
  } catch (error) {
    console.error('Commit error:', error);
    return c.json(createApiResponse(false, null, 'Commit operation failed'), 500);
  }
});

// Get git operation status
gitRoutes.get('/operation/:id', async (c) => {
  try {
    const operationId = parseInt(c.req.param('id'));
    
    if (isNaN(operationId)) {
      return c.json(createApiResponse(false, null, 'Invalid operation ID'), 400);
    }
    
    const operation = await getGitOperation(c.env.DB, operationId);
    
    if (!operation) {
      return c.json(createApiResponse(false, null, 'Operation not found'), 404);
    }
    
    return c.json(createApiResponse(true, operation));
  } catch (error) {
    console.error('Get operation error:', error);
    return c.json(createApiResponse(false, null, 'Failed to get operation status'), 500);
  }
});

// Get recent git operations for a repository
gitRoutes.get('/repository/:owner/:name/operations', async (c) => {
  try {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const fullName = `${owner}/${name}`;
    
    const repository = await getRepositoryByName(c.env.DB, fullName);
    if (!repository) {
      return c.json(createApiResponse(false, null, 'Repository not found'), 404);
    }
    
    const operations = await getRecentGitOperations(c.env.DB, repository.id, 20);
    
    return c.json(createApiResponse(true, operations));
  } catch (error) {
    console.error('Get repository operations error:', error);
    return c.json(createApiResponse(false, null, 'Failed to get repository operations'), 500);
  }
});

async function executeGitOperation(c: any, operation: GitOperation): Promise<string> {
  const env: Env = c.env;
  
  // Get repository information from database
  const repository = await getRepositoryByName(env.DB, operation.repository);
  if (!repository) {
    throw new Error(`Repository ${operation.repository} not accessible. Please ensure the GitHub App is installed on this repository and try again.`);
  }
  
  // Generate installation token for GitHub authentication
  const tokenData = await generateInstallationToken(repository.installation_id, env);
  
  // Create git operation record
  const operationId = await createGitOperation(env.DB, {
    operation_type: operation.type,
    repository_id: repository.id,
    branch: operation.branch || 'main',
    status: 'pending',
    result: null
  });
  
  try {
    // Update status to running
    await updateGitOperation(env.DB, operationId, 'running');
    
    if (!env.GIT_CONTAINER) {
      throw new Error('Container service not available. Please configure GIT_CONTAINER binding.');
    }
    
    // Create container service instance
    const containerService = new GitContainerService(env.GIT_CONTAINER);
    
    console.log(`Executing git operation: ${operation.type} for ${repository.name}`);
    
    let result: { exitCode: number; stdout: string; stderr: string; };
    
    switch (operation.type) {
      case 'clone':
        result = await containerService.clone(
          repository.clone_url,
          operation.branch || 'main',
          tokenData.token
        );
        break;
        
      case 'pull':
        result = await containerService.pull(
          tokenData.token,
          operation.branch || 'main'
        );
        break;
        
      case 'commit':
        // Handle file changes if provided
        if (operation.files && operation.files.length > 0) {
          for (const file of operation.files) {
            // Write file changes to workspace - this would need container support
            await containerService.exec({
              command: ['sh', '-c', `echo ${JSON.stringify(file.content)} > "${file.path}"`],
              workingDir: '/workspace/repo',
              timeout: 30000
            });
          }
        }
        
        result = await containerService.commitAndPush(
          operation.message || 'Automated commit',
          tokenData.token,
          operation.branch || 'main'
        );
        break;
        
      case 'push':
        result = await containerService.exec({
          command: ['git', 'push', 'origin', operation.branch || 'main'],
          workingDir: '/workspace/repo',
          timeout: 300000,
          env: {
            GIT_ASKPASS: '/usr/local/bin/git-askpass',
            GIT_USERNAME: 'x-access-token',
            GIT_PASSWORD: tokenData.token
          }
        });
        break;
        
      default:
        throw new Error(`Unsupported operation: ${operation.type}`);
    }
    
    console.log(`Container operation completed with exit code: ${result.exitCode}`);
    
    // Log output for debugging
    if (result.stdout) {
      console.log(`Container stdout: ${result.stdout.substring(0, 500)}...`);
    }
    if (result.stderr) {
      console.log(`Container stderr: ${result.stderr.substring(0, 500)}...`);
    }
    
    if (result.exitCode !== 0) {
      const errorMessage = `Command failed with exit code ${result.exitCode}: ${result.stderr || 'Unknown error'}`;
      await updateGitOperation(env.DB, operationId, 'failed', errorMessage);
      throw new Error(errorMessage);
    }
    
    // Update operation as completed
    await updateGitOperation(env.DB, operationId, 'completed', result.stdout);
    
    return result.stdout || 'Operation completed successfully';
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await updateGitOperation(env.DB, operationId, 'failed', errorMessage);
    throw error;
  }
}