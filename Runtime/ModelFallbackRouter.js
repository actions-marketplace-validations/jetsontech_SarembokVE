// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

/**
 * SarembokVE - Model Fallback & Graceful Degradation Router (Phase 1 Core)
 * 
 * Automatically routes inference requests across primary frontier providers,
 * secondary fast tier, and sovereign local models (Ollama/Llama 3.x/Gemma 2)
 * when rate limits (429) or outages (503) occur. Cleanly pauses state if all fail.
 */

import sqlite3 from 'better-sqlite3';

export class ModelFallbackRouter {
  constructor(options = {}) {
    this.dbPath = options.dbPath || 'sarembok_memory.db';
    this.primaryModel = options.primaryModel || 'gemini-3.1-flash';
    this.secondaryModel = options.secondaryModel || 'gemini-2.5-flash';
    this.localModel = options.localModel || 'ollama/llama3.2';
    
    this.failureThreshold = options.failureThreshold || 3;
    this.failureCounts = new Map(); // model -> count
    this.activeModel = this.primaryModel;

    this.db = new sqlite3(this.dbPath, { fileMustExist: false });
    this.initLedger();
  }

  initLedger() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS model_fallback_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        failed_model TEXT NOT NULL,
        routed_model TEXT NOT NULL,
        error_reason TEXT NOT NULL,
        recovery_status TEXT NOT NULL
      )
    `).run();
  }

  /**
   * Executes inference request with automatic degradation circuit breaker
   * @param {Function} executionFn Callback accepting modelName and executing call
   * @returns {Promise<any>}
   */
  async executeWithFallback(executionFn) {
    const fallbackTier = [this.primaryModel, this.secondaryModel, this.localModel];

    for (let i = 0; i < fallbackTier.length; i++) {
      const targetModel = fallbackTier[i];

      try {
        const result = await executionFn(targetModel);
        // Reset failure count on success
        this.failureCounts.set(targetModel, 0);
        this.activeModel = targetModel;
        return {
          modelUsed: targetModel,
          tier: i === 0 ? 'PRIMARY' : (i === 1 ? 'SECONDARY' : 'LOCAL_SOVEREIGN'),
          result
        };
      } catch (err) {
        const isRateLimitOrOutage = /429|503|rate\s*limit|quota|overloaded|unavailable/i.test(err.message);
        const currentFailures = (this.failureCounts.get(targetModel) || 0) + 1;
        this.failureCounts.set(targetModel, currentFailures);

        const nextModel = fallbackTier[i + 1] || 'STATE_PAUSED';

        // Log fallback event
        this.db.prepare(`
          INSERT INTO model_fallback_events (
            failed_model, routed_model, error_reason, recovery_status
          ) VALUES (?, ?, ?, ?)
        `).run(
          targetModel,
          nextModel,
          err.message,
          nextModel === 'STATE_PAUSED' ? 'SUSPENDED_AWAITING_RECOVERY' : 'ROUTED_TO_FALLBACK'
        );

        console.warn(`\x1b[33m[Model Router]\x1b[0m ${targetModel} encountered error (${err.message}). Tripping circuit breaker -> ${nextModel}`);

        if (i === fallbackTier.length - 1) {
          // All models failed: Clean state suspension
          return {
            status: 'STATE_SUSPENDED',
            error: `All inference tiers exhausted. Cleanly suspended agent state until API recovers. Last error: ${err.message}`,
            recovering: true
          };
        }
      }
    }
  }

  getActiveRoute() {
    return {
      active_model: this.activeModel,
      primary: this.primaryModel,
      secondary: this.secondaryModel,
      local_sovereign: this.localModel,
      failure_states: Object.fromEntries(this.failureCounts.entries())
    };
  }

  close() {
    this.db.close();
  }
}
