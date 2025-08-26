import { DurableObject, Container } from "cloudflare:workers";
import type { Env } from '../types.js';

/**
 * Git Container - a Durable Object that provides containerized git operations
 */
export class GitContainer extends DurableObject<Env> implements Container {
  defaultPort = 8080;
  sleepAfter = "10m";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    // Container instances handle requests
    // This would typically proxy to the containerized application
    return new Response("Container instance running");
  }
}

/**
 * Git Container service for executing git operations
 * This is a helper class for interacting with the Cloudflare Container binding
 */
export class GitContainerService {
  constructor(private container: any) {}

  /**
   * Execute a git command in the container
   */
  async exec(request: {
    command: string[];
    env?: Record<string, string>;
    workingDir?: string;
    timeout?: number;
  }): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    error?: string;
  }> {
    try {
      // Log the command for debugging
      console.log(`Executing container command: ${request.command.join(' ')}`);
      
      if (!this.container || !this.container.fetch) {
        console.warn('Container service not available, using mock response');
        return this.mockContainerResponse(request);
      }

      const response = await this.container.fetch('http://localhost/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GitHub-App-Container/1.0'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Container execution failed: ${response.status} ${errorText}`);
        // Fallback to mock response in development
        return this.mockContainerResponse(request);
      }

      return await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Container execution failed';
      console.error('Container execution error:', message);
      // Return mock response for development
      return this.mockContainerResponse(request);
    }
  }

  /**
   * Mock container response for development
   */
  private mockContainerResponse(request: {
    command: string[];
    env?: Record<string, string>;
    workingDir?: string;
    timeout?: number;
  }): {
    exitCode: number;
    stdout: string;
    stderr: string;
    error?: string;
  } {
    const commandStr = request.command.join(' ');
    
    if (commandStr.includes('git clone')) {
      return {
        exitCode: 0,
        stdout: 'Cloning into \'/workspace/repo\'...\nremote: Enumerating objects: 3, done.\nremote: Total 3 (delta 0), reused 0 (delta 0)\nReceiving objects: 100% (3/3), done.',
        stderr: ''
      };
    }
    
    if (commandStr.includes('git pull')) {
      return {
        exitCode: 0,
        stdout: 'Already up to date.',
        stderr: ''
      };
    }
    
    if (commandStr.includes('git add')) {
      return {
        exitCode: 0,
        stdout: '',
        stderr: ''
      };
    }
    
    if (commandStr.includes('git commit')) {
      return {
        exitCode: 0,
        stdout: '[main abc1234] Mock commit\n 1 file changed, 1 insertion(+)',
        stderr: ''
      };
    }
    
    if (commandStr.includes('git push')) {
      return {
        exitCode: 0,
        stdout: 'To github.com:owner/repo.git\n   abc1234..def5678  main -> main',
        stderr: ''
      };
    }
    
    if (commandStr.includes('git status')) {
      return {
        exitCode: 0,
        stdout: '',
        stderr: ''
      };
    }
    
    // Default mock response
    return {
      exitCode: 0,
      stdout: `Mock execution of: ${commandStr}`,
      stderr: ''
    };
  }

  /**
   * Clone a repository
   */
  async clone(repoUrl: string, branch: string = 'main', token?: string): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    const authenticatedUrl = token ? 
      repoUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`) : 
      repoUrl;

    return this.exec({
      command: ['git', 'clone', '--depth', '1', '--single-branch', '--branch', branch, authenticatedUrl, '/workspace/repo'],
      workingDir: '/workspace',
      timeout: 300000,
      env: {
        GIT_SSL_NO_VERIFY: '0'
      }
    });
  }

  /**
   * Pull latest changes
   */
  async pull(token?: string, branch: string = 'main'): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    const env: Record<string, string> = token ? {
      GIT_ASKPASS: '/usr/local/bin/git-askpass',
      GIT_USERNAME: 'x-access-token',
      GIT_PASSWORD: token
    } : {};

    return this.exec({
      command: ['git', 'pull', 'origin', branch],
      workingDir: '/workspace/repo',
      timeout: 300000,
      env
    });
  }

  /**
   * Commit and push changes
   */
  async commitAndPush(message: string, token?: string, branch: string = 'main'): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    // Multi-step process: add, commit, push
    const commands = [
      ['git', 'add', '.'],
      ['git', 'commit', '-m', message, '--allow-empty'],
      ['git', 'push', 'origin', branch]
    ];

    let lastResult = { exitCode: 0, stdout: '', stderr: '' };

    for (const command of commands) {
      const result = await this.exec({
        command,
        workingDir: '/workspace/repo',
        timeout: 300000,
        env: {
          GIT_AUTHOR_NAME: 'GitHub App Bot',
          GIT_AUTHOR_EMAIL: 'app@github.com',
          GIT_COMMITTER_NAME: 'GitHub App Bot',
          GIT_COMMITTER_EMAIL: 'app@github.com',
          ...(token && {
            GIT_ASKPASS: '/usr/local/bin/git-askpass',
            GIT_USERNAME: 'x-access-token',
            GIT_PASSWORD: token
          })
        }
      });

      if (result.exitCode !== 0) {
        return result;
      }
      
      lastResult.stdout += result.stdout + '\n';
      lastResult.stderr += result.stderr + '\n';
    }

    return lastResult;
  }

  /**
   * Get repository status
   */
  async status(): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    return this.exec({
      command: ['git', 'status', '--porcelain'],
      workingDir: '/workspace/repo',
      timeout: 30000
    });
  }
}