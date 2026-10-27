import { execSync } from 'child_process';
import { ShannonEntropyEvaluator } from '../Runtime/EntropyDefense.js';

export class ContainerProvisioner {
  constructor() {
    this.evaluator = new ShannonEntropyEvaluator();
    this.imageName = 'sarembok-chromium-worker:latest';
  }

  /**
   * Verified Provisioning Engine for Ephemeral Environments
   */
  async provisionIsolatedWorker(targetUrl, runId) {
    console.log(`\x1b[36m[Provisioner]\x1b[0m Checking environment engine status for container runtime...`);

    // Auto-detect container backend infrastructure
    let runtimeCmd = 'docker';
    try {
      execSync('podman --version', { stdio: 'ignore' });
      runtimeCmd = 'podman';
    } catch {
      // Fallback cleanly to default docker
    }

    const containerName = `sarembok-worker-${runId}`;
    console.log(`\x1b[36m[Provisioner]\x1b[0m Spawning sandbox using engine: ${runtimeCmd}`);

    // Core Security Architecture Blueprint Enforcement
    // - Dropped all kernel capabilities
    // - Enforced hard 768MB memory limit
    // - Completely read-only root file system with explicit runtime tmpfs allocations
    const provisionCommand = `
      ${runtimeCmd} run -d \
      --name ${containerName} \
      --cap-drop=ALL \
      --memory=768m \
      --read-only \
      --tmpfs /tmp:rw,noexec,nosuid,size=64m \
      --tmpfs /home/node/.config:rw,noexec,nosuid,size=16m \
      -e TARGET_URL="${targetUrl}" \
      ${this.imageName}
    `.trim().replace(/\s+/g, ' ');

    try {
      execSync(provisionCommand);
      return { success: true, containerId: containerName, engine: runtimeCmd };
    } catch (error) {
      try {
        this.evaluator.db.prepare(
          'INSERT INTO cognitive_traces (agent_role, state_hash, entropy_score) VALUES (?, ?, ?)'
        ).run('provisioner', `FAILURE_CRITICAL_SANDBOX_BOOT_ERR: ${error.message}`, 1.0);
      } catch {
        // Trace error recording
      }
      throw new Error(`Critical Isolation Breach: Unable to securely spawn environment boundary: ${error.message}`);
    }
  }

  async teardownWorker(containerName, runtimeCmd = 'docker') {
    try {
      execSync(`${runtimeCmd} rm -f ${containerName}`, { stdio: 'ignore' });
      return { status: 'purged' };
    } catch {
      return { status: 'stale_cleanup_required' };
    }
  }
}
