import type { ApiResponse } from '@github-app/shared';

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
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

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

  async getInstallations() {
    return this.request('/api/installations');
  }

  async executeGitOperation(operation: any) {
    return this.request('/git/operation', {
      method: 'POST',
      body: JSON.stringify(operation),
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);