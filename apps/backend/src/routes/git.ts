import { Hono } from 'hono';
import type { GitOperation, ContainerConfig } from '@github-app/shared';
import { createApiResponse } from '@github-app/shared';
import type { Env } from '../types.js';

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

async function executeGitOperation(c: any, operation: GitOperation): Promise<string> {
  const container = c.env.GIT_CONTAINER;
  
  let command: string[];
  
  switch (operation.type) {
    case 'clone':
      command = ['git', 'clone', '--depth', '1', operation.repository, '/workspace'];
      if (operation.branch) {
        command.push('--branch', operation.branch);
      }
      break;
      
    case 'pull':
      command = ['git', 'pull', 'origin', operation.branch || 'main'];
      break;
      
    case 'commit':
      // This is a simplified example - in practice you'd need multiple commands
      command = ['sh', '-c', `
        cd /workspace &&
        git config user.email "app@github.com" &&
        git config user.name "GitHub App" &&
        git add . &&
        git commit -m "${operation.message}" &&
        git push origin ${operation.branch || 'main'}
      `];
      break;
      
    default:
      throw new Error(`Unsupported operation: ${operation.type}`);
  }
  
  const config: ContainerConfig = {
    image: 'alpine/git:latest',
    command,
    workingDir: '/workspace',
    env: {
      GIT_SSL_NO_VERIFY: '1'
    }
  };
  
  // Execute container operation
  // Note: This is pseudo-code as the actual Cloudflare containers API may differ
  const result = await container.run(config);
  
  return result.output || 'Operation completed';
}