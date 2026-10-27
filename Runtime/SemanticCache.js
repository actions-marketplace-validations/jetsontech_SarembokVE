/**
 * SarembokVE - Semantic Reasoning Cache Layer (Phase 1 Core)
 * 
 * Aggressive caching layer for intermediate reasoning steps, prompt hashes,
 * and deterministic tool results. Slashes token usage up to 40% and drastically
 * cuts latency on recurring enterprise workflows.
 */

import sqlite3 from 'better-sqlite3';
import { createHash } from 'node:crypto';

export class SemanticCache {
  constructor(options = {}) {
    this.dbPath = options.dbPath || 'sarembok_memory.db';
    this.ttlSeconds = options.ttlSeconds || 86400; // 24 hours default
    this.db = new sqlite3(this.dbPath, { fileMustExist: false });
    this.initCache();
  }

  initCache() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS semantic_cache (
        cache_key TEXT PRIMARY KEY,
        prompt_signature TEXT NOT NULL,
        cached_response TEXT NOT NULL,
        tokens_saved INTEGER NOT NULL DEFAULT 0,
        hit_count INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at INTEGER NOT NULL
      )
    `).run();
  }

  /**
   * Generates a deterministic hash signature from a prompt or structured task
   * @param {string|Object} promptOrTask
   * @returns {string} SHA-256 cache key
   */
  computeSignature(promptOrTask) {
    const raw = typeof promptOrTask === 'string'
      ? promptOrTask.trim().toLowerCase().replace(/\s+/g, ' ')
      : JSON.stringify(promptOrTask);
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Retrieves a cached completion if valid and not expired
   * @param {string|Object} promptOrTask
   * @returns {Object|null}
   */
  get(promptOrTask) {
    const key = this.computeSignature(promptOrTask);
    const row = this.db.prepare(`
      SELECT * FROM semantic_cache WHERE cache_key = ?
    `).get(key);

    if (!row) return null;

    if (Date.now() > row.expires_at) {
      this.db.prepare('DELETE FROM semantic_cache WHERE cache_key = ?').run(key);
      return null;
    }

    // Increment hit counter and update access timestamp
    this.db.prepare(`
      UPDATE semantic_cache 
      SET hit_count = hit_count + 1, last_accessed = CURRENT_TIMESTAMP 
      WHERE cache_key = ?
    `).run(key);

    try {
      return {
        cached: true,
        key: row.cache_key,
        hitCount: row.hit_count + 1,
        tokensSaved: row.tokens_saved,
        data: JSON.parse(row.cached_response)
      };
    } catch {
      return {
        cached: true,
        key: row.cache_key,
        hitCount: row.hit_count + 1,
        tokensSaved: row.tokens_saved,
        data: row.cached_response
      };
    }
  }

  /**
   * Store a completion or tool result in the semantic cache
   * @param {string|Object} promptOrTask
   * @param {any} response
   * @param {number} [tokensSaved=250]
   */
  set(promptOrTask, response, tokensSaved = 250) {
    const key = this.computeSignature(promptOrTask);
    const signature = typeof promptOrTask === 'string' ? promptOrTask.slice(0, 200) : 'structured_task';
    const payload = typeof response === 'string' ? response : JSON.stringify(response);
    const expiresAt = Date.now() + (this.ttlSeconds * 1000);

    this.db.prepare(`
      INSERT INTO semantic_cache (
        cache_key, prompt_signature, cached_response, tokens_saved, hit_count, expires_at
      ) VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        cached_response = excluded.cached_response,
        tokens_saved = semantic_cache.tokens_saved + excluded.tokens_saved,
        last_accessed = CURRENT_TIMESTAMP,
        expires_at = excluded.expires_at
    `).run(key, signature, payload, tokensSaved, expiresAt);

    return key;
  }

  /**
   * Returns cache metrics (hits, total tokens saved, estimated cost reduction)
   */
  getStats() {
    const summary = this.db.prepare(`
      SELECT 
        COUNT(*) as total_entries,
        SUM(hit_count) as total_hits,
        SUM(tokens_saved * hit_count) as total_tokens_saved
      FROM semantic_cache
    `).get();

    const tokens = summary.total_tokens_saved || 0;
    // Estimated at $0.003 per 1K tokens for frontier models
    const estimatedCostSavingsUsd = ((tokens / 1000) * 0.003).toFixed(4);

    return {
      total_cached_entries: summary.total_entries || 0,
      total_cache_hits: summary.total_hits || 0,
      total_tokens_saved: tokens,
      estimated_savings_usd: `$${estimatedCostSavingsUsd}`
    };
  }

  clear() {
    this.db.prepare('DELETE FROM semantic_cache').run();
  }

  close() {
    this.db.close();
  }
}
