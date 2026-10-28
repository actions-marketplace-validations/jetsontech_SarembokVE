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
 * Antigravity Gemini Fabric (V3.8-Flash-Medium) - Frontier Edition
 * Sovereign Protocol [DIRECTIVE-01]
 * 
 * Core Export Surface
 */

// Pillar 1: Distributed Micro-Kernel Consensus & Memory
export { WalStore } from './memory/wal_store.js';
export { DistributedStateMesh } from './memory/distributed_state_mesh.js';
export { StateMachineProjector } from './memory/state_machine.js';
export { RaftNode, RaftRole } from './consensus/raft_consensus.js';

// Pillar 2: Standardized Multi-Agent Protocols
export { SarembokMcpServer, MCP_VERSION } from './protocols/mcp_server.js';
export { A2AGateway } from './protocols/a2a_gateway.js';

// Pillar 3: Formally Verified Policy Engine & Capability Tokens
export { CapabilityTokenFactory, CapabilityType } from './guardrails/capability_token.js';
export { FormalPolicyVerifier } from './guardrails/formal_verifier.js';

// Pillar 4: Centralized Cloud-Native Schema Registry & eBPF Telemetry
export { SchemaRegistry } from './registry/schema_registry.js';
export { EbpfTrafficTracer } from './registry/ebpf_tracer.js';

// Core Guardrails & Safety
export { EntropyEvaluator } from './guardrails/entropy_evaluator.js';
export { RollbackManager } from './guardrails/rollback_manager.js';
export { TokenBudgetGuard, TokenCapExceededError } from './guardrails/token_budget.js';

// Agent Archetypes & Runtime Kernel
export { MessageBus } from './agents/bus.js';
export { StrategistNode } from './agents/strategist.js';
export { WorkerNode } from './agents/worker.js';
export { AuditorNode } from './agents/auditor.js';
export { WorkerSandbox } from './runtime/worker_sandbox.js';
export { FabricKernel } from './runtime/fabric_kernel.js';
export { AgentRole, AgentStatus, MessageType } from './agents/types.js';
