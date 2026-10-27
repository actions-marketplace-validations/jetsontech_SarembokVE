/**
 * SarembokVE / NVIDIA OpenShell Integration - Zero-Trust Supervisor Control Plane
 * 
 * Implements the NVIDIA OpenShell reference architecture:
 * 1. Declarative Deny-By-Default Policy Enforcement outside process boundaries
 * 2. Immutable SQLite-WAL Security Audit Logging
 * 3. External Secret Zero Credential Injection
 * 4. Human-In-The-Loop (HITL) Threshold Interception
 */

import fs from 'fs';
import path from 'path';
import sqlite3 from 'better-sqlite3';
import { SecretZeroGateway } from './SecretZeroGateway.js';
import { HITLTrigger } from './HITLTrigger.js';

export class OpenShellPolicyViolationError extends Error {
  constructor(message, details = {}) {
    super(`[OpenShell Deny-By-Default Policy Breach] ${message}`);
    this.name = 'OpenShellPolicyViolationError';
    this.details = details;
  }
}

export class OpenShellHITLRequiredError extends Error {
  constructor(message, requestId, details = {}) {
    super(`[OpenShell HITL Gate] ${message}`);
    this.name = 'OpenShellHITLRequiredError';
    this.requestId = requestId;
    this.details = details;
  }
}

export class OpenShellSupervisor {
  constructor(options = {}) {
    this.configPath = options.configPath || './sarembok.config.json';
    this.profileName = options.profile || 'strict';
    this.dbPath = options.dbPath || 'sarembok_memory.db';

    this.secretZero = new SecretZeroGateway();
    this.hitl = new HITLTrigger({ dbPath: this.dbPath });

    this.db = new sqlite3(this.dbPath, { fileMustExist: false });
    this.initSecurityLedger();
    this.loadPolicy();
  }

  initSecurityLedger() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS security_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        agent_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        target TEXT,
        policy_decision TEXT NOT NULL, -- 'ALLOW', 'DENY', 'HITL_PAUSE'
        policy_reason TEXT,
        hitl_request_id TEXT
      )
    `).run();
  }

  loadPolicy() {
    // Attempt loading from Config/openshell.profiles.json
    try {
      const profilesPath = path.resolve(process.cwd(), 'Config', 'openshell.profiles.json');
      if (fs.existsSync(profilesPath)) {
        const raw = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
        this.profile = raw.profiles[this.profileName] || raw.profiles['strict'];
        return;
      }
    } catch {
      // Fallback
    }

    // Default Strict Fallback Policy
    this.profile = {
      filesystem: {
        read_only_root: true,
        allowed_paths: ['/workspace', './generated', './public', './scratch', '/tmp'],
        deny_paths: ['~/.ssh', '~/.aws', '.env', '**/.env*', '**/id_rsa*', 'C:/Windows/System32', '/etc/shadow', '/etc/sudoers', '**/credentials.json']
      },
      network: {
        egress_mode: 'whitelist',
        allowed_domains: ['github.com', 'api.github.com', 'registry.npmjs.org', 'sarembok.com', '*.sarembok.com', '*.google.com', 'localhost', '127.0.0.1'],
        denied_ports: [22, 25, 3389, 445, 135]
      },
      commands: {
        max_memory_mb: 768,
        max_execution_time_ms: 5000,
        drop_capabilities: ['ALL'],
        deny_patterns: [
          'rm\\s+-rf\\s+[/~]',
          'format\\s+[a-z]:',
          'mkfs',
          'dd\\s+if=',
          'chmod\\s+777',
          'DROP\\s+(TABLE|DATABASE|VIEW|SCHEMA)',
          'TRUNCATE\\s+(TABLE)?',
          'DELETE\\s+FROM\\s+\\w+\\s*(?!WHERE)',
          'shutdown',
          'reboot',
          'kill\\s+-9\\s+1',
          'curl.*\\|.*(sh|bash|powershell)',
          'wget.*\\|.*(sh|bash|powershell)'
        ]
      },
      hitl_triggers: {
        require_approval: [
          'production_db_write',
          'production_db_migration',
          'external_payment',
          'financial_transaction',
          'privileged_execution',
          'cloud_resource_destroy'
        ]
      }
    };
  }

  logSecurityEvent(agentId, actionType, target, decision, reason = '', hitlId = null) {
    try {
      this.db.prepare(`
        INSERT INTO security_audit_events (
          agent_id, action_type, target, policy_decision, policy_reason, hitl_request_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(agentId, actionType, String(target), decision, reason, hitlId);
    } catch (err) {
      console.error(`[OpenShell Security Log Fault] ${err.message}`);
    }
  }

  /**
   * Validates a command line execution string against deny patterns
   */
  validateCommand(cmd, agentId = 'worker') {
    if (!cmd || typeof cmd !== 'string') return true;

    for (const pattern of this.profile.commands.deny_patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(cmd)) {
        const reason = `Command matches prohibited pattern: '${pattern}'`;
        this.logSecurityEvent(agentId, 'COMMAND_EXEC', cmd, 'DENY', reason);
        throw new OpenShellPolicyViolationError(reason, { command: cmd, pattern });
      }
    }

    return true;
  }

  /**
   * Validates a file access path
   */
  validateFileSystem(targetPath, mode = 'read', agentId = 'worker') {
    if (!targetPath || typeof targetPath !== 'string') return true;
    const normalized = targetPath.replaceAll('\\', '/');

    // Check deny paths
    for (const denied of this.profile.filesystem.deny_paths) {
      let pattern = denied.replaceAll('\\', '/');
      if (pattern.startsWith('~/')) {
        pattern = pattern.slice(2);
      }
      if (pattern.startsWith('**/')) {
        pattern = pattern.slice(3);
      }
      const regexStr = pattern.replaceAll('.', '\\.').replaceAll('*', '.*');
      const regex = new RegExp(regexStr, 'i');

      if (regex.test(normalized)) {
        const reason = `Access to sensitive path denied: '${targetPath}' matches deny rule '${denied}'`;
        this.logSecurityEvent(agentId, `FS_${mode.toUpperCase()}`, targetPath, 'DENY', reason);
        throw new OpenShellPolicyViolationError(reason, { path: targetPath, rule: denied });
      }
    }

    // Check read-only root enforcement
    if (mode === 'write' && this.profile.filesystem.read_only_root) {
      const isAllowed = this.profile.filesystem.allowed_paths.some(p => {
        const normP = p.replaceAll('\\', '/');
        return normP === '*' || normalized.startsWith(normP) || normalized.includes(normP);
      });

      if (!isAllowed) {
        const reason = `Write access to root / unapproved filesystem denied by read-only policy: '${targetPath}'`;
        this.logSecurityEvent(agentId, 'FS_WRITE', targetPath, 'DENY', reason);
        throw new OpenShellPolicyViolationError(reason, { path: targetPath });
      }
    }

    return true;
  }

  /**
   * Validates a network egress target
   */
  validateNetwork(targetUrl, port = null, agentId = 'worker') {
    if (!targetUrl || typeof targetUrl !== 'string') return true;

    // Check denied ports
    if (port && this.profile.network.denied_ports.includes(Number(port))) {
      const reason = `Egress to port ${port} is blocked by enterprise containment policy.`;
      this.logSecurityEvent(agentId, 'NET_EGRESS', `${targetUrl}:${port}`, 'DENY', reason);
      throw new OpenShellPolicyViolationError(reason, { url: targetUrl, port });
    }

    // Check domain whitelist
    if (this.profile.network.egress_mode === 'whitelist') {
      let domain = targetUrl;
      try {
        if (targetUrl.includes('://')) {
          domain = new URL(targetUrl).hostname;
        }
      } catch {
        // use targetUrl directly
      }

      const isAllowed = this.profile.network.allowed_domains.some(allowed => {
        if (allowed === '*') return true;
        if (allowed.startsWith('*.')) {
          const rootDomain = allowed.slice(2);
          return domain === rootDomain || domain.endsWith(`.${rootDomain}`);
        }
        return domain === allowed;
      });

      if (!isAllowed) {
        const reason = `Outbound network egress to '${domain}' not in whitelist.`;
        this.logSecurityEvent(agentId, 'NET_EGRESS', targetUrl, 'DENY', reason);
        throw new OpenShellPolicyViolationError(reason, { domain, url: targetUrl });
      }
    }

    return true;
  }

  /**
   * Full-stack action validation and execution wrapper with Secret Zero and HITL
   * @param {Object} action
   * @param {string} action.type 'command' | 'network' | 'filesystem' | 'custom'
   * @param {string} [action.command]
   * @param {string} [action.path]
   * @param {string} [action.url]
   * @param {string} [action.agentId='worker']
   * @param {string} [action.hitlType]
   * @param {string} [action.approvalId]
   * @param {Function} executeFn Callback executing the isolated action
   * @returns {Promise<any>}
   */
  async executeSafe(action, executeFn) {
    const agentId = action.agentId || 'worker';

    // 1. Policy Boundary Checks
    if (action.command) {
      this.validateCommand(action.command, agentId);
    }
    if (action.path) {
      this.validateFileSystem(action.path, action.mode || 'read', agentId);
    }
    if (action.url) {
      this.validateNetwork(action.url, action.port, agentId);
    }

    // 2. Human-In-The-Loop (HITL) Check
    const hitlType = action.hitlType || action.type;
    if (this.hitl.isApprovalRequired(hitlType, action.command || action.details)) {
      if (!action.approvalId) {
        const reqId = this.hitl.requestApproval({
          agentId,
          actionType: hitlType,
          commandOrTarget: action.command || action.url || action.path,
          details: action
        });
        this.logSecurityEvent(agentId, hitlType, action.command || action.url || '', 'HITL_PAUSE', 'Awaiting operator sign-off', reqId);
        throw new OpenShellHITLRequiredError(`Action '${hitlType}' requires human operator approval. Request ID: ${reqId}`, reqId);
      }

      const status = this.hitl.getStatus(action.approvalId);
      if (!status || status.status !== 'APPROVED') {
        const reason = status ? `Approval status is '${status.status}'` : 'Invalid approval ID';
        this.logSecurityEvent(agentId, hitlType, action.command || '', 'DENY', reason, action.approvalId);
        throw new OpenShellPolicyViolationError(`Action was not approved by operator: ${reason}`, { approvalId: action.approvalId });
      }
    }

    // 3. Secret Zero Credential Injection (outside agent LLM context)
    let processedAction = action;
    if (action.command) {
      processedAction = { ...action, command: this.secretZero.inject(action.command) };
    }
    if (action.headers) {
      processedAction = { ...action, headers: this.secretZero.inject(action.headers) };
    }
    if (action.payload) {
      processedAction = { ...action, payload: this.secretZero.inject(action.payload) };
    }

    // 4. Log Approved Action Execution
    this.logSecurityEvent(agentId, action.type, action.command || action.url || action.path || '', 'ALLOW', 'Policy verification passed');

    // 5. Execute Action
    let result;
    try {
      result = await executeFn(processedAction);
    } catch (err) {
      // Sanitize errors so credentials are never leaked in stack traces
      throw new Error(this.secretZero.sanitize(err.message));
    }

    // 6. Secret Zero Output Sanitization (scrub credentials from response)
    return this.secretZero.sanitize(result);
  }

  getRecentSecurityLogs(limit = 10) {
    return this.db.prepare(`
      SELECT * FROM security_audit_events ORDER BY id DESC LIMIT ?
    `).all(limit);
  }

  close() {
    this.db.close();
    this.hitl.close();
  }
}
