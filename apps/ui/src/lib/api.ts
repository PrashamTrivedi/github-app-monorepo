import type { ApiResponse, GitOperation } from '@github-app/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      // Always try to parse the JSON response, even on errors
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // If we have structured error data, preserve it
        if (data && !data.success && data.error) {
          return data as ApiResponse<T>;
        }
        
        // Fallback to generic error for unstructured responses
        return {
          success: false,
          data: null,
          error: `API request failed: ${response.status} ${response.statusText}`
        } as ApiResponse<T>;
      }

      return data as ApiResponse<T>;
    } catch (error) {
      // Handle network errors or JSON parsing errors
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Network error occurred'
      } as ApiResponse<T>;
    }
  }

  // Repository operations
  async validateRepository(url: string) {
    return this.request('/api/validate-repo', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async getRepository(owner: string, repo: string) {
    return this.request(`/api/repo/${owner}/${repo}`);
  }

  async getRepositoryIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    return this.request(`/api/repo/${owner}/${repo}/issues?state=${state}`);
  }

  // Installation management
  async getInstallations() {
    return this.request('/api/installations');
  }

  // Git operations
  async executeGitOperation(operation: GitOperation) {
    return this.request('/git/operation', {
      method: 'POST',
      body: JSON.stringify(operation),
    });
  }

  async cloneRepository(repository: string, branch: string = 'main') {
    return this.request('/git/clone', {
      method: 'POST',
      body: JSON.stringify({ repository, branch }),
    });
  }

  async commitToRepository(repository: string, message: string, files: Array<{ path: string; content: string }>) {
    return this.request('/git/commit', {
      method: 'POST',
      body: JSON.stringify({ repository, message, files }),
    });
  }

  // Health check
  async getHealth() {
    return this.request('/');
  }

  // Webhook operations (for testing)
  async sendTestWebhook(payload: any) {
    return this.request('/webhooks', {
      method: 'POST',
      headers: {
        'x-github-event': 'ping',
        'x-hub-signature-256': 'sha256=test-signature',
      },
      body: JSON.stringify(payload),
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);