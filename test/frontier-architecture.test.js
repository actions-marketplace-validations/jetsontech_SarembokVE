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
 * Test Suite: SarembokVE Frontier Architecture (Pillars 1 - 4)
 * Validates:
 * 1. Distributed Micro-Kernel Architecture & Raft Consensus
 * 2. Standardized Agent Protocols (MCP JSON-RPC & Signed A2A Envelopes)
 * 3. Formally Verified Pre-Dispatch Policies & Capability Tokens
 * 4. Cloud-Native API Schema Registry & Real-Time eBPF Telemetry
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RaftNode,
  RaftRole,
  DistributedStateMesh,
  SarembokMcpServer,
  A2AGateway,
  CapabilityTokenFactory,
  CapabilityType,
  FormalPolicyVerifier,
  SchemaRegistry,
  EbpfTrafficTracer,
  FabricKernel
} from '../fabric/src/index.js';

test('Pillar 1: Raft Consensus Cluster - Leader Election & Quorum Commit', async () => {
  // Create an in-memory 3-node cluster
  const nodes = new Map();
  const nodeIds = ['raft-node-1', 'raft-node-2', 'raft-node-3'];

  const transportSend = (fromId, toId, msg) => {
    const target = nodes.get(toId);
    if (target) {
      // Simulate asynchronous network delivery
      setImmediate(() => target.handleMessage(fromId, msg));
    }
  };

  for (const id of nodeIds) {
    const peers = nodeIds.filter(p => p !== id);
    const node = new RaftNode({
      nodeId: id,
      peers,
      heartbeatInterval: 20,
      minElectionTimeout: 60,
      maxElectionTimeout: 120,
      transportSend: (toId, msg) => transportSend(id, toId, msg)
    });
    nodes.set(id, node);
  }

  // Start all nodes
  for (const node of nodes.values()) {
    node.start();
  }

  // Wait for a leader to be elected
  const leader = await new Promise((resolve) => {
    const checkLeader = setInterval(() => {
      for (const node of nodes.values()) {
        if (node.role === RaftRole.LEADER) {
          clearInterval(checkLeader);
          resolve(node);
          return;
        }
      }
    }, 15);
  });

  assert.ok(leader, 'Leader must be elected');
  assert.equal(leader.role, RaftRole.LEADER);
  assert.equal(leader.getQuorumSize(), 2);

  // Propose a command to the leader and verify quorum commitment
  const proposalResult = await leader.propose({
    action: 'DISPATCH_AGENT_TASK',
    taskId: 'task-distributed-001',
    payload: { query: 'Analyze multi-region cluster status' }
  });

  assert.equal(proposalResult.status, 'COMMITTED');
  assert.equal(proposalResult.entry.command.taskId, 'task-distributed-001');

  // Stop cluster nodes
  for (const node of nodes.values()) {
    node.stop();
  }
});

test('Pillar 1: DistributedStateMesh abstracts local WAL and consensus state', async () => {
  const mesh = new DistributedStateMesh({
    mode: 'local',
    dbPath: ':memory:'
  });

  const session = await mesh.createSession('sess_mesh_001', 50000);
  assert.equal(session.session_id, 'sess_mesh_001');

  const status = mesh.getClusterStatus();
  assert.equal(status.mode, 'local');
  assert.equal(typeof status.nodeId, 'string');

  mesh.close();
});

test('Pillar 2: Model Context Protocol (MCP) Server - JSON-RPC 2.0 Spec', async () => {
  const kernel = new FabricKernel({ dbPath: ':memory:' });
  const mcpServer = kernel.mcpServer;

  // 1. Initialize Handshake
  const initResponse = await mcpServer.handleJsonRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {}
  });

  assert.equal(initResponse.jsonrpc, '2.0');
  assert.equal(initResponse.id, 1);
  assert.equal(initResponse.result.protocolVersion, '2024-11-05');
  assert.ok(['sarembok-ve-mcp', 'sarembok-mcp-server'].includes(initResponse.result.serverInfo.name));

  // 2. Tools List Discovery
  const toolsResponse = await mcpServer.handleJsonRpc({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  });

  const toolNames = toolsResponse.result.tools.map(t => t.name);
  assert.ok(toolNames.includes('sarembok_execute_turn'));
  assert.ok(toolNames.includes('sarembok_reconstitute_state'));
  assert.ok(toolNames.includes('sarembok_audit_verify'));

  // 3. Resources List Discovery
  const resResponse = await mcpServer.handleJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'resources/list'
  });

  assert.equal(resResponse.result.resources[0].uri, 'sarembok://system/health');

  // 4. Resources Read
  const readResponse = await mcpServer.handleJsonRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'resources/read',
    params: { uri: 'sarembok://system/health' }
  });

  const healthData = JSON.parse(readResponse.result.contents[0].text);
  assert.equal(healthData.status, 'ONLINE');
  assert.equal(healthData.kernelBound, true);

  kernel.close();
});

test('Pillar 2: Agent-to-Agent (A2A) Federation Gateway - Cryptographic Attestation', async () => {
  const gateway = new A2AGateway({
    clusterId: 'cluster-us-east',
    sharedSecret: 'FEDERATION_SECRET_KEY_99'
  });

  gateway.registerAgent('worker-analyst', {
    capabilities: ['data_synthesis'],
    endpoint: 'internal'
  });

  // Create signed envelope
  const envelope = gateway.createEnvelope({
    sourceAgentId: 'strategist-prime',
    targetAgentId: 'worker-analyst',
    action: 'SYNTHESIZE_REPORT',
    payload: { dataset: 'telemetry_q3' }
  });

  assert.ok(envelope.signature, 'Envelope must contain HMAC signature');
  assert.equal(gateway.verifyEnvelope(envelope), true, 'Valid envelope must pass verification');

  // Dispatch through local routing
  let dispatched = false;
  const dispatchResult = await gateway.routeEnvelope(envelope, async (env) => {
    dispatched = true;
    return { status: 'DISPATCH_ACK', action: env.action };
  });

  assert.equal(dispatched, true);
  assert.equal(dispatchResult.status, 'DISPATCH_ACK');

  // Verify tamper detection
  const tampered = { ...envelope, payload: { dataset: 'malicious_injection' } };
  assert.equal(gateway.verifyEnvelope(tampered), false, 'Tampered payload must fail signature verification');
});

test('Pillar 3: Pre-Dispatch Formal Policy Verifier & Capability Tokens', () => {
  const factory = new CapabilityTokenFactory('SOVEREIGN_KEY_VERIFIER');
  const verifier = new FormalPolicyVerifier({
    signingSecret: 'SOVEREIGN_KEY_VERIFIER',
    profile: 'strict'
  });

  // 1. Mint capability token for worker with FS:READ on /tmp/sandbox
  const validToken = factory.mintToken({
    agentId: 'worker-code',
    capabilities: [CapabilityType.FS_READ],
    constraints: { allowedPaths: ['/tmp/sandbox'] }
  });

  assert.equal(factory.verifyToken(validToken), true);

  // 2. Formally prove valid read inside sandbox
  const proof = verifier.verifyAction({
    agentId: 'worker-code',
    actionType: CapabilityType.FS_READ,
    target: { path: '/tmp/sandbox/main.js' },
    token: validToken
  });

  assert.equal(proof.verified, true);
  assert.ok(proof.proofHash, 'Must generate formal proof hash');

  // 3. Formally reject unauthorized capability (FS:WRITE when only holding FS:READ)
  const writeProof = verifier.verifyAction({
    agentId: 'worker-code',
    actionType: CapabilityType.FS_WRITE,
    target: { path: '/tmp/sandbox/main.js' },
    token: validToken
  });

  assert.equal(writeProof.verified, false);
  assert.equal(writeProof.violatedInvariant, 'INV_CAPABILITY_SUFFICIENCY');

  // 4. Formally reject directory traversal escape attempt
  const traversalProof = verifier.verifyAction({
    agentId: 'worker-code',
    actionType: CapabilityType.FS_READ,
    target: { path: '/tmp/sandbox/../../etc/passwd' },
    token: validToken
  });

  assert.equal(traversalProof.verified, false);
  assert.equal(traversalProof.violatedInvariant, 'INV_SANDBOX_CONFINEMENT');

  // 5. Formally reject shell command injection / piping
  const shellToken = factory.mintToken({
    agentId: 'worker-code',
    capabilities: [CapabilityType.SHELL_EXEC]
  });

  const injectionProof = verifier.verifyAction({
    agentId: 'worker-code',
    actionType: CapabilityType.SHELL_EXEC,
    target: { command: 'node script.js; rm -rf /' },
    token: shellToken
  });

  assert.equal(injectionProof.verified, false);
  assert.equal(injectionProof.violatedInvariant, 'INV_SHELL_PIPING_PROHIBITED');
});

test('Pillar 4: Cloud-Native API Schema Registry & eBPF Continuous Telemetry', () => {
  const registry = new SchemaRegistry();
  const tracer = new EbpfTrafficTracer({
    registry,
    serviceName: 'payments-microservice'
  });

  tracer.startTrace();

  // Ingest live wire packets (emulating live eBPF stream)
  tracer.ingestWirePacket({
    method: 'GET',
    url: '/api/v1/payments/1094',
    statusCode: 200
  });

  tracer.ingestWirePacket({
    method: 'POST',
    url: '/api/v1/payments',
    statusCode: 201
  });

  // Synthesize schema directly from wire traffic
  const contract = tracer.publishDiscoveredContract('1.0.0-ebpf');
  assert.equal(contract.openapi, '3.1.0');
  assert.ok(contract.paths['/api/v1/payments/{id}'].get);
  assert.ok(contract.paths['/api/v1/payments'].post);

  // Verify registration in registry
  const latest = registry.getLatestSchema('payments-microservice');
  assert.equal(latest.version, '1.0.0-ebpf');

  // Register an updated schema with breaking changes (removed GET /api/v1/payments/{id})
  let breakingEventEmitted = false;
  registry.on('breakingChangeDetected', (event) => {
    breakingEventEmitted = true;
    assert.equal(event.serviceName, 'payments-microservice');
    assert.ok(event.breakingChanges.length > 0);
  });

  const updatedSchema = {
    openapi: '3.1.0',
    info: { title: 'payments-microservice', version: '2.0.0' },
    paths: {
      '/api/v1/payments': {
        post: { responses: { '201': { description: 'Created' } } }
      }
    }
  };

  const regRecord = registry.registerSchema('payments-microservice', updatedSchema, { version: '2.0.0' });
  assert.equal(regRecord.drift.isBreaking, true);
  assert.equal(breakingEventEmitted, true);
  assert.ok(regRecord.drift.breakingChanges[0].includes('Endpoint removed'));

  tracer.stopTrace();
});

test('FabricKernel End-to-End: Flywheel with Formal Policy Pre-Dispatch', async () => {
  const kernel = new FabricKernel({ dbPath: ':memory:' });
  await kernel.initializeSession('sess_frontier_e2e', 100000);

  // Execute flywheel turn with valid capability token
  const validToken = kernel.capabilityFactory.mintToken({
    agentId: 'worker-code',
    capabilities: [CapabilityType.SHELL_EXEC]
  });

  const result = await kernel.executeFlywheelTurn({
    sessionId: 'sess_frontier_e2e',
    prompt: 'Synthesize distributed micro-kernel telemetry report',
    workerId: 'worker-code',
    capabilityToken: validToken,
    actionType: CapabilityType.SHELL_EXEC,
    resourceTarget: { command: 'node report.js' }
  });

  assert.equal(result.status, 'SUCCESS');
  assert.ok(result.auditVerdict);
  assert.ok(result.snapshotHash);

  // Execute flywheel turn with invalid/forged capability token (should be formally rejected pre-dispatch)
  const rejectedResult = await kernel.executeFlywheelTurn({
    sessionId: 'sess_frontier_e2e',
    prompt: 'Attempt unauthorized escape',
    workerId: 'worker-code',
    capabilityToken: { ...validToken, signature: 'BAD_FORGED_SIGNATURE' },
    actionType: CapabilityType.SHELL_EXEC,
    resourceTarget: { command: 'node script.js' }
  });

  assert.equal(rejectedResult.status, 'FORMAL_POLICY_REJECTED');
  assert.equal(rejectedResult.violatedInvariant, 'INV_TOKEN_AUTHENTICITY');

  kernel.close();
});
