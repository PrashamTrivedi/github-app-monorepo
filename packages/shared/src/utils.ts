export function formatRepositoryUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

export function parseRepositoryUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, '')
  };
}

export function validateGitHubUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/.test(url);
}

export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: string
): { success: boolean; data?: T; error?: string } {
  return { success, data, error };
}