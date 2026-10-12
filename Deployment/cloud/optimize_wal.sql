-- =====================================================================
-- SAREMBOK VE - L1 SQLITE-WAL ZERO-LOCKING STRUCTURAL OPTIMIZATION SCRIPT
-- Phase 1 Production Remediation
-- =====================================================================

-- 1. High-Performance Concurrency & Write-Ahead-Log Pragmas
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 30000;
PRAGMA wal_autocheckpoint = 1000;
PRAGMA cache_size = -64000;      -- 64MB memory page cache
PRAGMA mmap_size = 268435456;    -- 256MB zero-copy memory-mapped I/O
PRAGMA temp_store = MEMORY;

-- 2. Structured Schemas for Multi-Agent Loops
CREATE TABLE IF NOT EXISTS agent_wal (
    step_id TEXT PRIMARY KEY,
    agent_node TEXT NOT NULL,
    directive TEXT,
    entropy REAL DEFAULT 0.0,
    status TEXT DEFAULT 'RECORDED',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_state (
    session_id TEXT PRIMARY KEY,
    global_status TEXT DEFAULT 'AWAITING_WORKLOAD',
    token_burned INTEGER DEFAULT 0,
    hard_cap INTEGER NOT NULL,
    initialized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_nodes (
    agent_id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'IDLE',
    current_task_id TEXT,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_log (
    task_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    sender_agent_id TEXT NOT NULL,
    recipient_agent_id TEXT,
    payload TEXT NOT NULL,
    tokens_consumed INTEGER DEFAULT 0,
    entropy_score REAL DEFAULT 0.0,
    validation_hash TEXT,
    committed INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES session_state(session_id),
    FOREIGN KEY(sender_agent_id) REFERENCES agent_nodes(agent_id)
);

-- 3. Strict Compound B-Tree Indices to Eliminate Lock Stalls Across 25 Agents
CREATE INDEX IF NOT EXISTS idx_agent_wal_node_ts ON agent_wal(agent_node, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_wal_ts ON agent_wal(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_wal_status ON agent_wal(status);
CREATE INDEX IF NOT EXISTS idx_system_state_updated ON system_state(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tx_session ON transaction_log(session_id, committed);
CREATE INDEX IF NOT EXISTS idx_tx_entropy ON transaction_log(entropy_score) WHERE committed = 1;
CREATE INDEX IF NOT EXISTS idx_tx_sender ON transaction_log(sender_agent_id);
CREATE INDEX IF NOT EXISTS idx_tx_agent_ts ON transaction_log(sender_agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_recipient_ts ON transaction_log(recipient_agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transaction_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_nodes_heartbeat ON agent_nodes(last_heartbeat DESC);

-- 4. Statistics Optimization & Checkpoint Flush
PRAGMA optimize;
PRAGMA wal_checkpoint(TRUNCATE);
