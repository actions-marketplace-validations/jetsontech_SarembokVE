/**
 * SarembokVE Cryptographic Hardening, Merkle WAL & Stdio MCP Server Tests
 * Step 6 Verification Suite
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityTokenFactory, CapabilityType } from '../fabric/src/guardrails/capability_token.js';
import { FormalPolicyVerifier } from '../fabric/src/guardrails/formal_verifier.js';
import { WalStore } from '../fabric/src/memory/wal_store.js';
import { RaftNode } from '../fabric/src/consensus/raft_consensus.js';
import { SarembokMcpServer, MCP_VERSION } from '../fabric/src/protocols/mcp_server.js';
import { OpenShellSandbox } from '../Runtime/OpenShellSandbox.js';

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
