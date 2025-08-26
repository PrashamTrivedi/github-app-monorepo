import type { D1Database } from '@cloudflare/workers-types';
import type { GitHubInstallation } from './github-auth.js';

export interface Installation {
  id: number;
  account_id: number;
  account_login: string;
  account_type: 'User' | 'Organization';
  permissions: string;
  created_at: string;
  updated_at: string;
}

export interface Repository {
  id: number;
  installation_id: number;
  name: string;
  full_name: string;
  owner_login: string;
  private: boolean;
  clone_url: string;
  created_at: string;
}

export interface WebhookEvent {
  id: number;
  event_type: string;
  action: string | null;
  installation_id: number | null;
  repository_id: number | null;
  payload: string;
  processed: boolean;
  created_at: string;
}

export interface GitOperation {
  id: number;
  operation_type: 'clone' | 'pull' | 'push' | 'commit';
  repository_id: number | null;
  branch: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Store or update installation data
 */
export async function storeInstallation(
  db: D1Database, 
  installation: GitHubInstallation
): Promise<void> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO installations (id, account_id, account_login, account_type, permissions, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  
  await stmt.bind(
    installation.id,
    installation.account.id,
    installation.account.login,
    installation.account.type,
    JSON.stringify(installation.permissions)
  ).run();
  
  // Store repositories if provided
  if (installation.repositories) {
    for (const repo of installation.repositories) {
      await storeRepository(db, installation.id, repo);
    }
  }
}

/**
 * Store or update repository data
 */
export async function storeRepository(
  db: D1Database,
  installationId: number,
  repository: GitHubInstallation['repositories'][0]
): Promise<void> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO repositories (id, installation_id, name, full_name, owner_login, private, clone_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  await stmt.bind(
    repository.id,
    installationId,
    repository.name,
    repository.full_name,
    repository.owner.login,
    repository.private ? 1 : 0,
    repository.clone_url
  ).run();
}

/**
 * Get installation by ID
 */
export async function getInstallation(
  db: D1Database, 
  installationId: number
): Promise<Installation | null> {
  const stmt = db.prepare('SELECT * FROM installations WHERE id = ?');
  const result = await stmt.bind(installationId).first<Installation>();
  return result || null;
}

/**
 * Get all installations
 */
export async function getAllInstallations(db: D1Database): Promise<Installation[]> {
  const stmt = db.prepare('SELECT * FROM installations ORDER BY updated_at DESC');
  const result = await stmt.all<Installation>();
  return result.results || [];
}

/**
 * Get repositories for an installation
 */
export async function getInstallationRepositories(
  db: D1Database,
  installationId: number
): Promise<Repository[]> {
  const stmt = db.prepare('SELECT * FROM repositories WHERE installation_id = ? ORDER BY name');
  const result = await stmt.all<Repository>();
  return result.results || [];
}

/**
 * Get repository by full name
 */
export async function getRepositoryByName(
  db: D1Database,
  fullName: string
): Promise<Repository | null> {
  const stmt = db.prepare('SELECT * FROM repositories WHERE full_name = ?');
  const result = await stmt.bind(fullName).first<Repository>();
  return result || null;
}

/**
 * Delete installation and related data
 */
export async function deleteInstallation(
  db: D1Database,
  installationId: number
): Promise<void> {
  // Delete in correct order due to foreign key constraints
  await db.prepare('DELETE FROM git_operations WHERE repository_id IN (SELECT id FROM repositories WHERE installation_id = ?)').bind(installationId).run();
  await db.prepare('DELETE FROM webhook_events WHERE installation_id = ?').bind(installationId).run();
  await db.prepare('DELETE FROM repositories WHERE installation_id = ?').bind(installationId).run();
  await db.prepare('DELETE FROM installations WHERE id = ?').bind(installationId).run();
}

/**
 * Store webhook event
 */
export async function storeWebhookEvent(
  db: D1Database,
  event: Omit<WebhookEvent, 'id' | 'created_at'>
): Promise<number> {
  const stmt = db.prepare(`
    INSERT INTO webhook_events (event_type, action, installation_id, repository_id, payload, processed)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = await stmt.bind(
    event.event_type,
    event.action,
    event.installation_id,
    event.repository_id,
    event.payload,
    event.processed ? 1 : 0
  ).run();
  
  return result.meta?.last_row_id || 0;
}

/**
 * Mark webhook event as processed
 */
export async function markWebhookProcessed(
  db: D1Database,
  eventId: number
): Promise<void> {
  const stmt = db.prepare('UPDATE webhook_events SET processed = 1 WHERE id = ?');
  await stmt.bind(eventId).run();
}

/**
 * Create git operation record
 */
export async function createGitOperation(
  db: D1Database,
  operation: Omit<GitOperation, 'id' | 'created_at' | 'completed_at'>
): Promise<number> {
  const stmt = db.prepare(`
    INSERT INTO git_operations (operation_type, repository_id, branch, status, result)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const result = await stmt.bind(
    operation.operation_type,
    operation.repository_id,
    operation.branch,
    operation.status,
    operation.result
  ).run();
  
  return result.meta?.last_row_id || 0;
}

/**
 * Update git operation status
 */
export async function updateGitOperation(
  db: D1Database,
  operationId: number,
  status: GitOperation['status'],
  result?: string
): Promise<void> {
  const completedAt = status === 'completed' || status === 'failed' ? "datetime('now')" : 'NULL';
  
  const stmt = db.prepare(`
    UPDATE git_operations 
    SET status = ?, result = ?, completed_at = ${completedAt}
    WHERE id = ?
  `);
  
  await stmt.bind(status, result || null, operationId).run();
}

/**
 * Get git operation by ID
 */
export async function getGitOperation(
  db: D1Database,
  operationId: number
): Promise<GitOperation | null> {
  const stmt = db.prepare('SELECT * FROM git_operations WHERE id = ?');
  const result = await stmt.bind(operationId).first<GitOperation>();
  return result || null;
}

/**
 * Get recent git operations for a repository
 */
export async function getRecentGitOperations(
  db: D1Database,
  repositoryId: number,
  limit: number = 10
): Promise<GitOperation[]> {
  const stmt = db.prepare(`
    SELECT * FROM git_operations 
    WHERE repository_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  
  const result = await stmt.all<GitOperation>();
  return result.results || [];
}