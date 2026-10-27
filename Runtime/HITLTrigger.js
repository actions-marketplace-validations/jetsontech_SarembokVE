/**
 * SarembokVE / NVIDIA OpenShell Integration - Human-In-The-Loop (HITL) Trigger
 * 
 * Defines strict programmatic thresholds that pause agent execution and require
 * explicit human operator sign-off before dangerous actions are committed.
 */

import sqlite3 from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export class HITLTrigger {
  constructor(options = {}) {
    this.dbPath = options.dbPath || 'sarembok_memory.db';
    this.autoTimeoutSeconds = options.autoTimeoutSeconds || 300;
    this.requiredApprovals = new Set(options.requireApproval || [
      'production_db_write',
      'production_db_migration',
      'external_payment',
      'financial_transaction',
      'privileged_execution',
      'cloud_resource_destroy',
      'external_email_dispatch'
    ]);

    this.db = new sqlite3(this.dbPath, { fileMustExist: false });
    this.initLedger();
  }

  initLedger() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS hitl_approvals (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        agent_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        command_or_target TEXT,
        details TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        decided_at DATETIME,
        decided_by TEXT,
        decision_reason TEXT,
        expires_at INTEGER NOT NULL
      )
    `).run();
  }

  /**
   * Evaluates if a given action type or command payload requires human sign-off
   * @param {string} actionType
   * @param {string|Object} [payload]
   * @returns {boolean}
   */
  isApprovalRequired(actionType, payload = null) {
    if (this.requiredApprovals.has(actionType)) {
      return true;
    }

    // Inspect command text for sensitive actions if actionType is generic command
    if (payload) {
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const destructiveDbPattern = /\b(DROP|TRUNCATE|ALTER)\b\s+(TABLE|DATABASE|SCHEMA)/i;
      const financialPattern = /\b(stripe|charge|transfer|payment|invoice)\b/i;
      const destroyCloudPattern = /\b(gcloud\s+projects\s+delete|terraform\s+destroy|aws\s+.*delete)\b/i;

      if (destructiveDbPattern.test(text) || financialPattern.test(text) || destroyCloudPattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Creates a pending approval record in SQLite-WAL
   * @param {Object} params
   * @param {string} params.agentId
   * @param {string} params.actionType
   * @param {string} [params.commandOrTarget]
   * @param {Object} [params.details]
   * @returns {string} Approval Request ID
   */
  requestApproval({ agentId, actionType, commandOrTarget = '', details = {} }) {
    const id = `hitl-${randomUUID().slice(0, 8)}`;
    const expiresAt = Date.now() + (this.autoTimeoutSeconds * 1000);

    this.db.prepare(`
      INSERT INTO hitl_approvals (
        id, agent_id, action_type, command_or_target, details, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(
      id,
      agentId,
      actionType,
      String(commandOrTarget),
      JSON.stringify(details),
      expiresAt
    );

    console.log(`\x1b[33m[OpenShell HITL]\x1b[0m Action Paused: ${actionType} triggered approval gate. Request ID: ${id}`);
    return id;
  }

  /**
   * Approve an action
   * @param {string} requestId
   * @param {string} [decidedBy='operator']
   * @returns {boolean}
   */
  approve(requestId, decidedBy = 'operator') {
    const row = this.db.prepare('SELECT status, expires_at FROM hitl_approvals WHERE id = ?').get(requestId);
    if (!row) {
      throw new Error(`Approval request '${requestId}' not found.`);
    }

    if (Date.now() > row.expires_at) {
      this.db.prepare("UPDATE hitl_approvals SET status = 'EXPIRED' WHERE id = ?").run(requestId);
      throw new Error(`Approval request '${requestId}' has expired.`);
    }

    if (row.status !== 'PENDING') {
      throw new Error(`Approval request '${requestId}' is already resolved with status '${row.status}'.`);
    }

    this.db.prepare(`
      UPDATE hitl_approvals 
      SET status = 'APPROVED', decided_at = CURRENT_TIMESTAMP, decided_by = ? 
      WHERE id = ?
    `).run(decidedBy, requestId);

    console.log(`\x1b[32m✔ [OpenShell HITL]\x1b[0m Action Approved: ${requestId} by ${decidedBy}`);
    return true;
  }

  /**
   * Reject an action
   * @param {string} requestId
   * @param {string} [decidedBy='operator']
   * @param {string} [reason='Operator rejected execution']
   * @returns {boolean}
   */
  reject(requestId, decidedBy = 'operator', reason = 'Operator rejected execution') {
    const row = this.db.prepare('SELECT status FROM hitl_approvals WHERE id = ?').get(requestId);
    if (!row) {
      throw new Error(`Approval request '${requestId}' not found.`);
    }

    this.db.prepare(`
      UPDATE hitl_approvals 
      SET status = 'REJECTED', decided_at = CURRENT_TIMESTAMP, decided_by = ?, decision_reason = ? 
      WHERE id = ?
    `).run(decidedBy, reason, requestId);

    console.log(`\x1b[31m✕ [OpenShell HITL]\x1b[0m Action Rejected: ${requestId} by ${decidedBy}. Reason: ${reason}`);
    return true;
  }

  /**
   * Get status of an approval request
   * @param {string} requestId
   * @returns {Object|null}
   */
  getStatus(requestId) {
    const row = this.db.prepare('SELECT * FROM hitl_approvals WHERE id = ?').get(requestId);
    if (!row) return null;

    if (row.status === 'PENDING' && Date.now() > row.expires_at) {
      this.db.prepare("UPDATE hitl_approvals SET status = 'EXPIRED' WHERE id = ?").run(requestId);
      row.status = 'EXPIRED';
    }

    return {
      id: row.id,
      agentId: row.agent_id,
      actionType: row.action_type,
      commandOrTarget: row.command_or_target,
      details: JSON.parse(row.details || '{}'),
      status: row.status,
      createdAt: row.created_at,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
      reason: row.decision_reason
    };
  }

  /**
   * List all pending approval requests
   * @returns {Array}
   */
  listPending() {
    const rows = this.db.prepare(`
      SELECT * FROM hitl_approvals WHERE status = 'PENDING' ORDER BY created_at DESC
    `).all();

    const now = Date.now();
    return rows.map(r => {
      if (now > r.expires_at) {
        this.db.prepare("UPDATE hitl_approvals SET status = 'EXPIRED' WHERE id = ?").run(r.id);
        r.status = 'EXPIRED';
      }
      return {
        id: r.id,
        agentId: r.agent_id,
        actionType: r.action_type,
        commandOrTarget: r.command_or_target,
        details: JSON.parse(r.details || '{}'),
        status: r.status,
        createdAt: r.created_at
      };
    }).filter(r => r.status === 'PENDING');
  }

  close() {
    this.db.close();
  }
}
