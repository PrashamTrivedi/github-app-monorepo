import { Hono } from 'hono';
import type { Env, ContainerExecRequest, ContainerExecResponse } from '../types.js';
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
    throw new Error(`Repository ${operation.repository} not found in database`);
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
    
    let command: string[];
    let workingDir = '/workspace';
    
    switch (operation.type) {
      case 'clone':
        // Prepare authenticated clone URL
        const repoUrl = repository.clone_url.replace('https://github.com/', `https://x-access-token:${tokenData.token}@github.com/`);
        
        const cloneScript = [
          'mkdir -p /workspace',
          `git clone --depth 1 --single-branch --branch "${operation.branch || 'main'}" "${repoUrl}" "/workspace/${repository.name}"`,
          'echo "Clone completed successfully"'
        ].join(' && ');
        
        command = ['sh', '-c', cloneScript];
        break;
        
      case 'pull':
        workingDir = `/workspace/${repository.name}`;
        // Setup git credentials and pull
        const pullScript = [
          `cd /workspace/${repository.name}`,
          `git config credential.helper store`,
          `echo "https://x-access-token:${tokenData.token}@github.com" > ~/.git-credentials`,
          `git pull origin ${operation.branch || 'main'}`,
          'echo "Pull completed successfully"'
        ].join(' && ');
        
        command = ['sh', '-c', pullScript];
        break;
        
      case 'commit':
        workingDir = `/workspace/${repository.name}`;
        // Handle file changes if provided
        let fileChangeScript = '';
        if (operation.files && operation.files.length > 0) {
          const fileCommands = operation.files.map((file: { path: string; content: string }) => 
            `echo ${JSON.stringify(file.content)} > "${file.path}"`
          ).join(' && ');
          fileChangeScript = fileCommands + ' && ';
        }
        
        // Multi-step commit process with proper authentication
        const commitScript = [
          'set -e',
          `cd /workspace/${repository.name}`,
          'git config user.email "app@github.com"',
          'git config user.name "GitHub App Bot"',
          'git config credential.helper store',
          `echo "https://x-access-token:${tokenData.token}@github.com" > ~/.git-credentials`,
          fileChangeScript + 'git add .',
          `git commit -m "${operation.message?.replace(/"/g, '\\\\"') || 'Automated commit'}" || echo "No changes to commit"`,
          `git push origin ${operation.branch || 'main'}`,
          'echo "Commit and push completed successfully"'
        ].join(' && ');
        
        command = ['sh', '-c', commitScript];
        break;
        
      case 'push':
        workingDir = `/workspace/${repository.name}`;
        const pushScript = [
          `cd /workspace/${repository.name}`,
          'git config credential.helper store',
          `echo "https://x-access-token:${tokenData.token}@github.com" > ~/.git-credentials`,
          `git push origin ${operation.branch || 'main'}`,
          'echo "Push completed successfully"'
        ].join(' && ');
        
        command = ['sh', '-c', pushScript];
        break;
        
      default:
        throw new Error(`Unsupported operation: ${operation.type}`);
    }
    
    const execRequest: ContainerExecRequest = {
      command,
      workingDir,
      env: {
        GITHUB_TOKEN: tokenData.token,
        GIT_AUTHOR_NAME: 'GitHub App Bot',
        GIT_AUTHOR_EMAIL: 'app@github.com',
        GIT_SSL_NO_VERIFY: '0' // Enable SSL verification for security
      },
      timeout: 300000 // 5 minutes timeout
    };
    
    // Execute container operation using Cloudflare Container API
    console.log(`Executing git operation: ${operation.type} for ${repository.name}`);
    console.log(`Command: ${command.join(' ')}`);
    
    const response = await env.GIT_CONTAINER.fetch('http://localhost/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-App-Container/1.0'
      },
      body: JSON.stringify(execRequest)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Container execution failed: ${response.status} ${errorText}`);
      throw new Error(`Container execution failed: ${response.status} ${errorText}`);
    }
    
    const result: ContainerExecResponse = await response.json();
    console.log(`Container operation completed with exit code: ${result.exitCode}`);
    
    // Log output for debugging
    if (result.stdout) {
      console.log(`Container stdout: ${result.stdout.substring(0, 500)}...`);
    }
    if (result.stderr) {
      console.log(`Container stderr: ${result.stderr.substring(0, 500)}...`);
    }
    
    if (result.exitCode !== 0) {
      const errorMessage = `Command failed with exit code ${result.exitCode}: ${result.stderr || result.error || 'Unknown error'}`;
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