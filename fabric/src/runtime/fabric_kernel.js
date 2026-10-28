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
 * Antigravity Gemini Fabric - Master Runtime Kernel (Frontier Edition)
 * Sovereign Protocol [DIRECTIVE-01]
 * 
 * Unifies:
 * - Pillar 1: Distributed micro-kernel consensus & state mesh (Raft + SQLite-WAL)
 * - Pillar 2: Standardized MCP protocol & cryptographically signed A2A federation gateway
 * - Pillar 3: Formally verified pre-dispatch policy engine & unforgeable capability proofs
 * - Pillar 4: Centralized cloud-native API schema registry & continuous eBPF telemetry
 * - Defensive guardrails: Token budget hard-cap, structural isolation & Shannon entropy traps
 */

import { WalStore } from '../memory/wal_store.js';
import { DistributedStateMesh } from '../memory/distributed_state_mesh.js';
import { StateMachineProjector } from '../memory/state_machine.js';
import { EntropyEvaluator } from '../guardrails/entropy_evaluator.js';
import { RollbackManager } from '../guardrails/rollback_manager.js';
import { TokenBudgetGuard, TokenCapExceededError } from '../guardrails/token_budget.js';
import { CapabilityTokenFactory, CapabilityType } from '../guardrails/capability_token.js';
import { FormalPolicyVerifier } from '../guardrails/formal_verifier.js';
import { SarembokMcpServer } from '../protocols/mcp_server.js';
import { A2AGateway } from '../protocols/a2a_gateway.js';
import { SchemaRegistry } from '../registry/schema_registry.js';
import { EbpfTrafficTracer } from '../registry/ebpf_tracer.js';
import { MessageBus } from '../agents/bus.js';
import { StrategistNode } from '../agents/strategist.js';
import { WorkerNode } from '../agents/worker.js';
import { AuditorNode } from '../agents/auditor.js';

export class FabricKernel {
  /**
   * @param {Object} [options]
   * @param {string} [options.dbPath=':memory:'] Path to SQLite WAL file or ':memory:'
   * @param {string} [options.meshMode='local'] 'local' | 'distributed'
   * @param {string[]} [options.clusterPeers=[]]
   * @param {string} [options.auditSecret]
   * @param {string} [options.signingSecret]
   * @param {string} [options.containmentProfile='enterprise']
   * @param {number} [options.loopThreshold=0.88]
   * @param {number} [options.loopWindowSize=5]
   */
  constructor(options = {}) {
    this.dbPath = options.dbPath || ':memory:';
    this.auditSecret = options.auditSecret || 'SOVEREIGN_AUDIT_SECRET_DIRECTIVE_01';
    this.signingSecret = options.signingSecret || 'SOVEREIGN_CAPABILITY_SIGNING_KEY_DIRECTIVE_01';
    this.containmentProfile = options.containmentProfile || 'enterprise';

    // 1. Core Memory Substrate & Distributed State Mesh (Pillar 1)
    this.mesh = new DistributedStateMesh({
      mode: options.meshMode || 'local',
      dbPath: this.dbPath,
      clusterPeers: options.clusterPeers || [],
      transportSend: options.transportSend
    });
    this.walStore = this.mesh.walStore;
    this.projector = new StateMachineProjector(this.walStore);

    // 2. Formally Verified Pre-Dispatch Engine & Capability Tokens (Pillar 3)
    this.capabilityFactory = new CapabilityTokenFactory(this.signingSecret);
    this.formalVerifier = new FormalPolicyVerifier({
      signingSecret: this.signingSecret,
      profile: this.containmentProfile
    });

    // 3. Guardrails & Safety
    this.evaluator = new EntropyEvaluator({
      threshold: options.loopThreshold ?? 0.88,
      windowSize: options.loopWindowSize ?? 5,
      consecutiveTurns: 3
    });
    this.rollbackManager = new RollbackManager(this.walStore);
    this.tokenGuard = new TokenBudgetGuard(this.walStore);

    // 4. Messaging Bus
    this.bus = new MessageBus(this.walStore);

    // 5. Default Archetype Nodes
    this.strategist = new StrategistNode({
      walStore: this.walStore,
      bus: this.bus,
      rollbackManager: this.rollbackManager
    });

    this.workers = new Map();
    this.registerWorker('worker-code', 'code_emission');
    this.registerWorker('worker-scrape', 'log_scraping');
    this.registerWorker('worker-api', 'api_integration');

    this.auditor = new AuditorNode({
      walStore: this.walStore,
      bus: this.bus,
      auditSecret: this.auditSecret
    });

    // 6. Standardized Interop: MCP Server & A2A Gateway (Pillar 2)
    this.mcpServer = new SarembokMcpServer({ kernel: this });
    this.a2aGateway = new A2AGateway({ sharedSecret: this.signingSecret });

    // 7. Centralized API Schema Registry & eBPF Telemetry (Pillar 4)
    this.schemaRegistry = new SchemaRegistry();
    this.ebpfTracer = new EbpfTrafficTracer({ registry: this.schemaRegistry });
  }

  /**
   * Register a new worker node in the fabric
   * @param {string} workerId
   * @param {string} specialty
   * @param {number} [timeoutMs=5000]
   */
  registerWorker(workerId, specialty, timeoutMs = 5000) {
    const worker = new WorkerNode({
      agentId: workerId,
      specialty,
      walStore: this.walStore,
      bus: this.bus,
      timeoutMs
    });
    this.workers.set(workerId, worker);
    return worker;
  }

  /**
   * Initialize a new execution session
   * @param {string} sessionId
   * @param {number} [hardCap=100000]
   */
  initializeSession(sessionId, hardCap = 100000) {
    return this.mesh.createSession(sessionId, hardCap);
  }

  /**
   * Execute a full flywheel turn:
   * 1. Pre-dispatch formal verification & capability token proof check
   * 2. Token budget verification before dispatch
   * 3. Task decomposition by Strategist
   * 4. Delegation to Worker
   * 5. Proactive sliding-window entropy loop detection
   * 6. Audit verification and signature generation
   * 7. Strict token budget deduction
   * 
   * @param {Object} params
   * @param {string} params.sessionId
   * @param {string} params.prompt
   * @param {string} [params.workerId='worker-code']
   * @param {number} [params.estimatedTokens=150]
   * @param {Object} [params.boundaryParameters]
   * @param {Object} [params.capabilityToken]
   * @param {string} [params.actionType]
   * @param {Object} [params.resourceTarget]
   */
  async executeFlywheelTurn({
    sessionId,
    prompt,
    workerId = 'worker-code',
    estimatedTokens = 150,
    boundaryParameters = { maxChars: 50000 },
    capabilityToken = null,
    actionType = null,
    resourceTarget = {}
  }) {
    // Phase 0 / Pillar 3: Pre-Dispatch Formal Policy Verification
    if (capabilityToken || actionType) {
      const targetAction = actionType || CapabilityType.SHELL_EXEC;
      const presentedToken = capabilityToken || this.capabilityFactory.mintToken({
        agentId: workerId,
        capabilities: [targetAction]
      });

      const formalProof = this.formalVerifier.verifyAction({
        agentId: workerId,
        actionType: targetAction,
        target: resourceTarget,
        token: presentedToken
      });

      if (!formalProof.verified) {
        return {
          status: 'FORMAL_POLICY_REJECTED',
          reason: formalProof.reason,
          violatedInvariant: formalProof.violatedInvariant,
          sessionId,
          workerId
        };
      }
    }

    // Phase C: Strict token budget verification before dispatch
    this.tokenGuard.recordAndVerify(sessionId, estimatedTokens);

    const session = this.walStore.getSession(sessionId);
    if (session && session.global_status === 'AWAITING_WORKLOAD') {
      this.walStore.updateSessionStatus(sessionId, 'RUNNING');
    }

    // Phase B: Strategist decomposes task
    const taskPlan = this.strategist.decomposeTask(prompt);
    const subtask = {
      id: `task_${Date.now()}`,
      action: 'execute_primitive',
      prompt,
      plan: taskPlan
    };

    // Strategist delegates subtask to Worker
    const workerResult = await this.strategist.delegateToWorker({
      sessionId,
      workerId,
      subtask,
      boundaryParameters
    });

    if (workerResult.status === 'YIELDED_TO_OPERATOR') {
      return {
        status: 'YIELDED',
        reason: workerResult.reason,
        workerId,
        sessionId
      };
    }

    // Phase B / Pillar 2: Proactive Sliding-Window Semantic Loop Mitigation
    const recentTurns = this.walStore.getRecentTransactions(sessionId, 5, true, workerId);
    const loopEval = this.evaluator.evaluateTurns(recentTurns);

    if (loopEval.loopDetected) {
      // Trigger instant mitigation: Freeze thread, Rollback WAL tx, Inject directive
      const mitigation = this.rollbackManager.mitigateLoop({
        sessionId,
        agentId: loopEval.agentId || workerId,
        uncommittedTxId: workerResult.txId,
        reason: loopEval.reason
      });

      return {
        status: 'LOOP_INTERCEPTED',
        mitigation,
        evaluation: loopEval,
        sessionId
      };
    }

    // Phase C: Auditor Deterministic Verification
    const auditVerdict = await this.strategist.requestAudit({
      sessionId,
      auditorId: this.auditor.agentId,
      workerId,
      workerOutput: workerResult.result,
      boundaryParameters
    });

    // Enforce structural isolation
    this.auditor.assertVerificationSignature(
      sessionId,
      workerId,
      workerResult.result,
      boundaryParameters,
      auditVerdict.validationHash
    );

    return {
      status: 'SUCCESS',
      sessionId,
      workerResult,
      auditVerdict,
      snapshotHash: this.walStore.getLatestTransaction(sessionId)?.validation_hash || auditVerdict.validationHash
    };
  }

  /**
   * Reconstitute complete state from WAL on-demand
   * @param {string} sessionId
   */
  reconstituteState(sessionId) {
    return this.projector.reconstituteState(sessionId);
  }

  /**
   * Close kernel, storage, and mesh
   */
  close() {
    if (this.mesh) {
      this.mesh.close();
    } else if (this.walStore) {
      this.walStore.close();
    }
  }
}
