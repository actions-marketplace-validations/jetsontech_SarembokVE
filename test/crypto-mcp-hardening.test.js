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
 * SarembokVE Cryptographic Hardening, Merkle WAL & Stdio MCP Server Tests
 * Step 6 Verification Suite
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CapabilityTokenFactory, CapabilityType } from '../fabric/src/guardrails/capability_token.js';
import { FormalPolicyVerifier } from '../fabric/src/guardrails/formal_verifier.js';
import { WalStore } from '../fabric/src/memory/wal_store.js';
import { RaftNode } from '../fabric/src/consensus/raft_consensus.js';
import { SarembokMcpServer, MCP_VERSION } from '../fabric/src/protocols/mcp_server.js';
import { OpenShellSandbox } from '../Runtime/OpenShellSandbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Cryptographic Hardening: Nested HMAC-SHA256 Macaroon Token Chaining & Tamper Detection', () => {
  const rootSecret = 'SOVEREIGN_ROOT_SECRET_TEST_9981';
  const factory = new CapabilityTokenFactory(rootSecret);

  // 1. Mint valid capability token with caveats
  const token = factory.mintToken({
    agentId: 'worker-agent-01',
    capabilities: [CapabilityType.FS_READ, CapabilityType.SHELL_EXEC],
    constraints: { allowedPaths: ['/workspace/project'] },
    ttlMs: 60000
  });

  assert.ok(token.tokenId.startsWith('cap-'));
  assert.ok(token.signature, 'Must have chained signature');
  assert.ok(token.caveats.length > 0, 'Must have first-party caveats');

  // Verify valid token passes
  const isValid = factory.verifyToken(token, {
    agentId: 'worker-agent-01',
    action: CapabilityType.FS_READ,
    path: '/workspace/project/main.js'
  });
  assert.equal(isValid, true, 'Valid macaroon token must pass verification');

  // 2. Tamper Detection: Modify a caveat without recomputing HMAC chain
  const tamperedCaveatToken = JSON.parse(JSON.stringify(token));
  tamperedCaveatToken.caveats[0] = 'agent=malicious-attacker';
  const isTamperedCaveatValid = factory.verifyToken(tamperedCaveatToken);
  assert.equal(isTamperedCaveatValid, false, 'Tampered caveat must fail timingSafeEqual verification');

  // 3. Tamper Detection: Modify signature
  const tamperedSigToken = JSON.parse(JSON.stringify(token));
  const badChar = tamperedSigToken.signature[0] === 'a' ? 'b' : 'a';
  tamperedSigToken.signature = badChar + tamperedSigToken.signature.slice(1);
  const isTamperedSigValid = factory.verifyToken(tamperedSigToken);
  assert.equal(isTamperedSigValid, false, 'Tampered signature must fail timingSafeEqual verification');

  // 4. Macaroon Attenuation: Chain an extra first-party caveat
  const attenuated = factory.attenuate(token, 'pathPrefix=/workspace/project/src');
  assert.equal(attenuated.caveats.length, token.caveats.length + 1);
  assert.notEqual(attenuated.signature, token.signature, 'Signature must be re-chained');

  // Attenuated token satisfies /workspace/project/src
  assert.equal(
    factory.verifyToken(attenuated, { path: '/workspace/project/src/index.js' }),
    true
  );

  // Attenuated token fails path outside the new caveat boundary
  assert.equal(
    factory.verifyToken(attenuated, { path: '/workspace/project/other/file.js' }),
    false
  );
});

test('Deterministic AST Invariant Verifier: Injection & Privilege Escalation Blocking', () => {
  const verifier = new FormalPolicyVerifier({ profile: 'enterprise' });
  const factory = new CapabilityTokenFactory();
  const token = factory.mintToken({
    agentId: 'worker-exec',
    capabilities: [CapabilityType.SHELL_EXEC]
  });

  // Valid single command
  const validProof = verifier.verifyAction({
    agentId: 'worker-exec',
    actionType: CapabilityType.SHELL_EXEC,
    target: { command: 'npm test' },
    token
  });
  assert.equal(validProof.verified, true);
  assert.ok(validProof.proofHash);

  // Block shell chaining metacharacters
  const injectionProof = verifier.verifyAction({
    agentId: 'worker-exec',
    actionType: CapabilityType.SHELL_EXEC,
    target: { command: 'echo hello | sh' },
    token
  });
  assert.equal(injectionProof.verified, false);
  assert.equal(injectionProof.violatedInvariant, 'INV_SHELL_PIPING_PROHIBITED');

  // Block privilege escalation
  const sudoProof = verifier.verifyAction({
    agentId: 'worker-exec',
    actionType: CapabilityType.SHELL_EXEC,
    target: { command: 'sudo apt-get update' },
    token
  });
  assert.equal(sudoProof.verified, false);
  assert.equal(sudoProof.violatedInvariant, 'INV_PRIVILEGE_ESCALATION_PROHIBITED');
});

test('Merkle WAL Ledger Integrity: verifyIntegrity() & Cryptographic Tamper Detection', () => {
  const wal = new WalStore(':memory:');
  const session = wal.initializeSession();

  // Commit valid micro-steps forming Merkle chain
  wal.commitMicroStep('task-1', session.session_id, 'SYSTEM', { action: 'INIT' });
  wal.commitMicroStep('task-2', session.session_id, 'SYSTEM', { action: 'FETCH' });
  wal.commitMicroStep('task-3', session.session_id, 'SYSTEM', { action: 'APPLY' });

  // verifyIntegrity() on clean chain
  const cleanResult = wal.verifyIntegrity(session.session_id);
  assert.equal(cleanResult.verified, true);
  assert.equal(cleanResult.entriesCount, 3);
  assert.ok(cleanResult.headHash);

  // Tamper with SQLite transaction_log entry payload directly
  wal.db.prepare("UPDATE transaction_log SET payload = '{\"action\":\"MALICIOUS_TAMPER\"}' WHERE task_id = 'task-2'").run();

  // verifyIntegrity() must throw cryptographic tamper error
  assert.throws(
    () => wal.verifyIntegrity(session.session_id),
    /Cryptographic tamper detected in WAL ledger/
  );

  wal.close();
});

test('Raft Log Merkle Hash Chain: verifyIntegrity() & Tamper Detection', async () => {
  const raft = new RaftNode({ nodeId: 'node-leader-1' });
  raft.start();
  raft.role = 'LEADER'; // Force leader for proposal test

  await raft.propose({ type: 'SET_KEY', key: 'name', value: 'sarembok' });
  await raft.propose({ type: 'SET_KEY', key: 'version', value: '3.0.0' });
  await raft.propose({ type: 'SET_KEY', key: 'status', value: 'active' });

  assert.equal(raft.log.length, 3);
  assert.ok(raft.log[0].entryHash);
  assert.equal(raft.log[1].prevHash, raft.log[0].entryHash);
  assert.equal(raft.log[2].prevHash, raft.log[1].entryHash);

  // Clean log verification passes
  const integrity = raft.verifyIntegrity();
  assert.equal(integrity.verified, true);
  assert.equal(integrity.entriesCount, 3);

  // Tamper with Raft log entry
  raft.log[1].command = { type: 'SET_KEY', key: 'version', value: 'HACKED' };

  assert.throws(
    () => raft.verifyIntegrity(),
    /Cryptographic tamper detected in Raft log/
  );

  raft.stop();
});

test('MCP JSON-RPC 2.0 Server: initialize, tools/list, tools/call & notifications', async () => {
  const mcp = new SarembokMcpServer();

  // 1. initialize request
  const initResp = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 101,
    method: 'initialize',
    params: {}
  });

  assert.equal(initResp.jsonrpc, '2.0');
  assert.equal(initResp.id, 101);
  assert.equal(initResp.result.protocolVersion, '2024-11-05');
  assert.equal(initResp.result.serverInfo.name, 'sarembok-ve-mcp');
  assert.equal(initResp.result.serverInfo.version, '3.0.0');

  // 2. notifications/initialized (notification -> no response)
  const notifResp = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  });
  assert.equal(notifResp, null);

  // 3. tools/list
  const toolsResp = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 102,
    method: 'tools/list'
  });

  const toolNames = toolsResp.result.tools.map(t => t.name);
  assert.ok(toolNames.includes('openshell_verify'));
  assert.ok(toolNames.includes('openshell_status'));
  assert.ok(toolNames.includes('contract_spec'));
  assert.ok(toolNames.includes('entropy_evaluate'));
  assert.ok(toolNames.includes('wal_verify'));

  // 4. tools/call: openshell_verify
  const verifyCall = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 103,
    method: 'tools/call',
    params: {
      name: 'openshell_verify',
      arguments: { command: 'node -v' }
    }
  });

  assert.equal(verifyCall.id, 103);
  assert.ok(verifyCall.result.content[0].text);
  const verifyData = JSON.parse(verifyCall.result.content[0].text);
  assert.equal(verifyData.allowed, true);

  // 5. tools/call: openshell_verify with forbidden command
  const forbiddenCall = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 104,
    method: 'tools/call',
    params: {
      name: 'openshell_verify',
      arguments: { command: 'rm -rf /' }
    }
  });
  const forbiddenData = JSON.parse(forbiddenCall.result.content[0].text);
  assert.equal(forbiddenData.allowed, false);

  // 6. tools/call: entropy_evaluate
  const entropyCall = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 105,
    method: 'tools/call',
    params: {
      name: 'entropy_evaluate',
      arguments: { output: 'diverse agent response tokens' }
    }
  });
  const entropyData = JSON.parse(entropyCall.result.content[0].text);
  assert.ok(entropyData.entropyScore >= 0);
  assert.equal(entropyData.loopDetected, false);

  // 7. tools/call: wal_verify
  const walCall = await mcp.handleJsonRpc({
    jsonrpc: '2.0',
    id: 106,
    method: 'tools/call',
    params: {
      name: 'wal_verify',
      arguments: {}
    }
  });
  const walData = JSON.parse(walCall.result.content[0].text);
  assert.equal(walData.status, 'VERIFIED');
});

test('OpenShell Sandbox: Secret Zero Stream Redaction & Working Directory Jailing', async () => {
  const sandbox = new OpenShellSandbox();

  // Register a sensitive test secret
  const testSecret = 'SUPER_SECRET_TOKEN_XYZ_987654';
  sandbox.supervisor.secretZero.registerSecret('TEST_API_KEY', testSecret);

  // Run a command that prints the injected secret
  const res = await sandbox.runCommand(`node -e "console.log('Secret is: ' + process.argv[1])" "{{SECRET:TEST_API_KEY}}"`);

  // Plaintext secret must NEVER be visible in stdout
  assert.ok(!res.stdout.includes(testSecret), 'Plaintext secret must not leak to stdout');
  assert.ok(res.stdout.includes('[REDACTED:SECRET_ZERO]'), 'Secret must be transformed to [REDACTED:SECRET_ZERO]');

  // Test directory jailing boundary escape rejection
  await assert.rejects(
    async () => {
      await sandbox.runCommand('node -v', { cwd: '../../' });
    },
    /escapes jailed workspace root/
  );

  sandbox.close();
});

test('Raft HTTP RPC Network Transport: Multi-Node Localhost Peer Replication & Merkle Hash Parity', async () => {
  const leader = new RaftNode({ nodeId: 'leader-node' });
  const follower = new RaftNode({ nodeId: 'follower-node' });

  const leaderPort = await leader.startRpcServer(0);
  const followerPort = await follower.startRpcServer(0);

  try {
    assert.ok(leaderPort > 0, 'Leader RPC server must bind to ephemeral port');
    assert.ok(followerPort > 0, 'Follower RPC server must bind to ephemeral port');

    // Designate leader with term 1
    leader.role = 'LEADER';
    leader.currentTerm = 1;
    follower.currentTerm = 1;

    // Propose an entry on leader
    const proposalRes = await leader.propose({
      type: 'STATE_TRANSITION',
      payload: { cluster_event: 'node_join', version: '3.0.0' }
    });

    const entry = proposalRes.entry || proposalRes;
    assert.ok(entry.entryHash, 'Leader entry must have SHA-256 Merkle hash');

    // Replicate entry to follower over HTTP RPC
    const followerUrl = `http://127.0.0.1:${followerPort}`;
    const result = await leader.replicateToPeer(followerUrl, entry);

    assert.equal(result.success, true, 'Follower must accept append-entries over HTTP RPC');
    assert.equal(result.matchIndex, 1);

    // Verify both nodes have identical log length and identical SHA-256 Merkle hashes
    assert.equal(leader.log.length, 1);
    assert.equal(follower.log.length, 1);
    assert.equal(leader.getLastLogHash(), follower.getLastLogHash(), 'SHA-256 Merkle log hashes must match identically');

    // Verify cryptographic integrity on both nodes
    assert.equal(leader.verifyIntegrity().verified, true);
    assert.equal(follower.verifyIntegrity().verified, true);
  } finally {
    await leader.stopRpcServer();
    await follower.stopRpcServer();
  }
});

test('OpenShell Macaroon CLI Enforcement: Token Mint & Execution Verification / Rejection', async () => {
  const rootDir = path.resolve(__dirname, '..');
  const cliPath = path.join(rootDir, 'bin', 'sarembok-cli.js');

  const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

  // 1. Mint valid capability token via CLI
  const mintOutput = execSync(`node "${cliPath}" token mint --scope execute --ttl 60`, {
    encoding: 'utf8',
    cwd: rootDir
  });

  const cleanMint = stripAnsi(mintOutput);
  assert.ok(cleanMint.includes('Minted Sovereign Capability Macaroon Token'));
  const b64Match = cleanMint.match(/Base64 Encoded Token:\s*\n+([A-Za-z0-9+/=]+)/);
  assert.ok(b64Match, 'Must output base64 token');
  const validTokenB64 = b64Match[1].trim();

  // 2. Execute command with valid token -> Must succeed
  const runOutput = execSync(`node "${cliPath}" openshell run "echo macaroon_verified_success" --token "${validTokenB64}"`, {
    encoding: 'utf8',
    cwd: rootDir
  });
  assert.ok(runOutput.includes('macaroon_verified_success'), 'Command must execute when token is valid');

  // 3. Tampered token -> Must reject with exit code 1
  assert.throws(
    () => {
      execSync(`node "${cliPath}" openshell run "echo should_fail" --token "tampered_invalid_token_xyz"`, {
        encoding: 'utf8',
        cwd: rootDir,
        stdio: 'pipe'
      });
    },
    (err) => {
      return err.status !== 0;
    }
  );

  // 4. Expired token -> Must reject with exit code 1
  const expiredOutput = execSync(`node "${cliPath}" token mint --scope execute --ttl -10`, {
    encoding: 'utf8',
    cwd: rootDir
  });
  const cleanExpired = stripAnsi(expiredOutput);
  const expiredB64Match = cleanExpired.match(/Base64 Encoded Token:\s*\n+([A-Za-z0-9+/=]+)/);
  assert.ok(expiredB64Match, 'Must output expired base64 token');
  const expiredTokenB64 = expiredB64Match[1].trim();

  assert.throws(
    () => {
      execSync(`node "${cliPath}" openshell run "echo should_fail_expired" --token "${expiredTokenB64}"`, {
        encoding: 'utf8',
        cwd: rootDir,
        stdio: 'pipe'
      });
    },
    (err) => {
      return err.status !== 0;
    }
  );
});

