export const POSTGRES_MIGRATIONS = [
  {
    id: '0001_enterprise_foundation',
    sql: `
CREATE TABLE IF NOT EXISTS overlay_orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  profile_picture_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  role TEXT DEFAULT 'user',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE (org_id, email)
);

CREATE TABLE IF NOT EXISTS overlay_projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  instructions TEXT,
  deleted_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_conversations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  last_mode TEXT NOT NULL DEFAULT 'ask',
  ask_model_ids JSONB NOT NULL DEFAULT '[]',
  act_model_id TEXT NOT NULL DEFAULT '',
  last_modified BIGINT NOT NULL,
  deleted_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_conversation_messages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT,
  model_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_files (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id TEXT,
  content TEXT,
  size_bytes BIGINT,
  is_storage_backed BOOLEAN DEFAULT FALSE,
  storage_key TEXT,
  download_url TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_memories (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  segment_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  full_content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  type TEXT,
  importance INTEGER,
  project_id TEXT,
  conversation_id TEXT,
  note_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS overlay_notes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_outputs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_key TEXT,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_skills (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_mcp_servers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_usage_entitlements (
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  plan_kind TEXT DEFAULT 'free',
  daily_usage JSONB NOT NULL DEFAULT '{}',
  daily_limits JSONB NOT NULL DEFAULT '{}',
  budget_used_cents INTEGER DEFAULT 0,
  budget_total_cents INTEGER DEFAULT 0,
  reset_at BIGINT,
  billing_period_end BIGINT,
  last_synced_at BIGINT,
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS overlay_settings (
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS overlay_onboarding (
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  has_seen_onboarding BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS overlay_automations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  schedule TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES overlay_orgs(id),
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS overlay_conversations_user_idx ON overlay_conversations (org_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS overlay_messages_conversation_idx ON overlay_conversation_messages (org_id, conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS overlay_files_user_idx ON overlay_files (org_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS overlay_memories_user_idx ON overlay_memories (org_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS overlay_projects_user_idx ON overlay_projects (org_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS overlay_audit_org_idx ON overlay_audit_events (org_id, created_at DESC);
`,
  },
]
