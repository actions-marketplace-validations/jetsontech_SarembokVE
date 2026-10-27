/**
 * SarembokVE / NVIDIA OpenShell Integration - Isolated Execution Sandbox Runtime
 * 
 * Provides hardened execution sandbox wrapping OpenShell Supervisor:
 * - Minimal sanitized environment (PATH, HOME, USER, NODE_ENV, LANG, TERM)
 * - In-memory Secret Zero resolution prior to spawn
 * - Real-time stream redaction ([REDACTED:SECRET_ZERO]) on stdout and stderr
 * - Working directory jailing (path.resolve boundary check inside workspace root)
 * - 30s hard timeout enforcement
 */

import { exec } from 'node:child_process';
import path from 'node:path';
import { OpenShellSupervisor } from './OpenShellSupervisor.js';
import { ContainerProvisioner } from '../Tools/Provisioner.js';

export class OpenShellSandbox {
  constructor(options = {}) {
    this.supervisor = new OpenShellSupervisor(options);
    this.provisioner = new ContainerProvisioner();
    this.workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  }

  /**
   * Execute an OS command securely inside the jailed OpenShell boundary
   * @param {string} cmd
   * @param {Object} [options]
   * @param {string} [options.agentId='worker']
   * @param {string} [options.approvalId]
   * @param {string} [options.cwd]
   * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
   */
  async runCommand(cmd, options = {}) {
    const action = {
      type: 'command',
      command: cmd,
      agentId: options.agentId || 'worker',
      approvalId: options.approvalId
    };

    return await this.supervisor.executeSafe(action, async (injectedAction) => {
      // 1. Working directory jailing inside workspace root
      const targetCwd = path.resolve(this.workspaceRoot, options.cwd || '.');
      const relative = path.relative(this.workspaceRoot, targetCwd);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Execution directory '${targetCwd}' escapes jailed workspace root '${this.workspaceRoot}'`);
      }

      // 2. Minimal sanitized environment (never leak host process.env)
      const cleanEnv = {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || process.env.USERPROFILE || '',
        USER: process.env.USER || process.env.USERNAME || 'worker',
        NODE_ENV: process.env.NODE_ENV || 'production',
        LANG: process.env.LANG || 'en_US.UTF-8',
        TERM: process.env.TERM || 'xterm-256color'
      };

      // 3. Collect secret values for real-time stream redaction
      const secretsMap = this.supervisor.secretZero.secrets;

      const redactSecrets = (text) => {
        if (!text || typeof text !== 'string') return '';
        let sanitized = text;
        for (const [key, secret] of secretsMap.entries()) {
          if (secret && typeof secret === 'string' && secret.length >= 4) {
            sanitized = sanitized.replaceAll(
              secret,
              `[REDACTED:SECRET_ZERO] [SECRET_REDACTED_BY_OPENSHELL]:${key}`
            );
          }
        }
        return sanitized;
      };

      return new Promise((resolve, reject) => {
        exec(
          injectedAction.command,
          {
            cwd: targetCwd,
            env: cleanEnv,
            timeout: 30000 // 30s hard timeout enforcement
          },
          (error, stdout, stderr) => {
            const redactedStdout = redactSecrets(stdout);
            const redactedStderr = redactSecrets(stderr);

            if (error && error.killed) {
              return reject(new Error('Process execution timed out by OpenShell supervisor (30s limit)'));
            }

            resolve({
              stdout: redactedStdout.trim(),
              stderr: redactedStderr.trim(),
              exitCode: error ? error.code || 1 : 0
            });
          }
        );
      });
    });
  }

  /**
   * Spawns an isolated Chromium container sandbox under OpenShell policy
   * @param {string} targetUrl
   * @param {string|number} [runId]
   */
  async spawnEphemeralContainer(targetUrl, runId = Date.now()) {
    // 1. Validate network egress policy for targetUrl
    this.supervisor.validateNetwork(targetUrl, null, 'provisioner');

    // 2. Call container provisioner
    return await this.provisioner.provisionIsolatedWorker(targetUrl, runId);
  }

  /**
   * Get OpenShell status summary with accurate branding
   */
  getStatus() {
    const pendingHitl = this.supervisor.hitl.listPending();
    const secretsCount = this.supervisor.secretZero.listKeys().length;
    const recentLogs = this.supervisor.getRecentSecurityLogs(5);

    return {
      openshell_engine: 'OpenShell-Compatible Zero-Trust Supervisor v1.0 (NVIDIA OpenShell Policy Schema)',
      active_profile: this.supervisor.profileName,
      read_only_root: this.supervisor.profile.filesystem?.read_only_root ?? true,
      secret_zero_registered_tokens: secretsCount,
      pending_hitl_approvals: pendingHitl.length,
      allowed_domains: this.supervisor.profile.network?.allowed_domains || [],
      deny_patterns_count: this.supervisor.profile.commands?.deny_patterns?.length || 0,
      recent_security_events: recentLogs
    };
  }

  close() {
    this.supervisor.close();
  }
}
