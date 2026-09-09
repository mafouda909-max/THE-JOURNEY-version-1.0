-- THE JOURNEY — additive AI document verification storage
-- Safe to apply to Production V1. No existing rows are modified or deleted.

CREATE TABLE IF NOT EXISTS agent_ai_verification_runs (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'completed',
  overall_confidence REAL,
  risk_level VARCHAR(16),
  recommendation VARCHAR(16),
  result_json TEXT,
  model VARCHAR(80),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_ai_verification_runs_agent_idx
  ON agent_ai_verification_runs(agent_id, created_at DESC);
