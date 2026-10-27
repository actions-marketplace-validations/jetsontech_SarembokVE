/**
 * SarembokVE / NVIDIA OpenShell Integration - Isolated Execution Sandbox Runtime
 * 
 * Provides high-level execution sandbox wrapping OpenShell Supervisor,
 * Secret Zero Injection, and Container Provisioning.
 */

import { exec } from 'child_process';
import { OpenShellSupervisor } from './OpenShellSupervisor.js';
import { ContainerProvisioner } from '../Tools/Provisioner.js';

export class OpenShellSandbox {
  constructor(options = {}) {
    this.supervisor = new OpenShellSupervisor(options);
    this.provisioner = new ContainerProvisioner();
  }

  /**
   * Execute an OS command securely inside the OpenShell boundary
   * @param {string} cmd
   * @param {Object} [options]
   * @param {string} [options.agentId='worker']
   * @param {string} [options.approvalId]
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
      return new Promise((resolve, reject) => {
        exec(injectedAction.command, { timeout: 15000 }, (error, stdout, stderr) => {
          if (error && error.killed) {
            return reject(new Error('Process execution timed out by OpenShell supervisor'));
          }
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: error ? error.code || 1 : 0
          });
        });
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
   * Get OpenShell status summary
   */
  getStatus() {
    const pendingHitl = this.supervisor.hitl.listPending();
    const secretsCount = this.supervisor.secretZero.listKeys().length;
    const recentLogs = this.supervisor.getRecentSecurityLogs(5);

    return {
      openshell_engine: 'NVIDIA OpenShell Safety Runtime v1.0',
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
