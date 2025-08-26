-- D1 Database schema for GitHub App

CREATE TABLE IF NOT EXISTS installations (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('User', 'Organization')),
  permissions TEXT, -- JSON string of permissions
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER PRIMARY KEY,
  installation_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  owner_login TEXT NOT NULL,
  private BOOLEAN NOT NULL DEFAULT 0,
  clone_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  action TEXT,
  installation_id INTEGER,
  repository_id INTEGER,
  payload TEXT, -- JSON string of the webhook payload
  processed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE SET NULL,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS git_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('clone', 'pull', 'push', 'commit')),
  repository_id INTEGER,
  branch TEXT DEFAULT 'main',
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result TEXT, -- Operation result or error message
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_installations_account ON installations(account_id);
CREATE INDEX IF NOT EXISTS idx_repositories_installation ON repositories(installation_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_installation ON webhook_events(installation_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_git_operations_repository ON git_operations(repository_id);
CREATE INDEX IF NOT EXISTS idx_git_operations_status ON git_operations(status);