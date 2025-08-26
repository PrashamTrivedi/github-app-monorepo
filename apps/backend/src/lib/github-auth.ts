import jwt from 'jsonwebtoken';
import type { Env } from '../types.js';

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
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued at time (allow 60 seconds of clock skew)
    exp: now + (10 * 60), // JWT expires in 10 minutes
    iss: env.GITHUB_APP_ID // GitHub App ID
  };
  
  return jwt.sign(payload, env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'), { 
    algorithm: 'RS256' 
  });
}

/**
 * Generate an installation access token for a specific installation
 */
export async function generateInstallationToken(
  installationId: number, 
  env: Env
): Promise<InstallationToken> {
  // Check cache first
  const cacheKey = `install_token_${installationId}`;
  const cached = await env.TOKEN_CACHE.get(cacheKey);
  
  if (cached) {
    const token = JSON.parse(cached) as InstallationToken;
    // Check if token expires in more than 5 minutes
    const expiresAt = new Date(token.expires_at).getTime();
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    
    if (expiresAt > fiveMinutesFromNow) {
      return token;
    }
  }
  
  const appJWT = generateAppJWT(env);
  
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appJWT}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-App-Backend/1.0'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate installation token: ${response.status} ${error}`);
  }
  
  const data = await response.json() as InstallationToken;
  
  // Cache the token (expires in 1 hour, so cache for 55 minutes)
  await env.TOKEN_CACHE.put(cacheKey, JSON.stringify(data), { 
    expirationTtl: 55 * 60 
  });
  
  return data;
}

/**
 * Get installation details from GitHub
 */
export async function getInstallation(
  installationId: number,
  env: Env
): Promise<GitHubInstallation> {
  const appJWT = generateAppJWT(env);
  
  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      'Authorization': `Bearer ${appJWT}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-App-Backend/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get installation: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get repositories accessible by an installation
 */
export async function getInstallationRepositories(
  installationId: number,
  env: Env
): Promise<Array<GitHubInstallation['repositories'][0]>> {
  const tokenData = await generateInstallationToken(installationId, env);
  
  const response = await fetch('https://api.github.com/installation/repositories', {
    headers: {
      'Authorization': `Bearer ${tokenData.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-App-Backend/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get repositories: ${response.status}`);
  }
  
  const data = await response.json();
  return data.repositories || [];
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
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
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  
  return result === 0;
}