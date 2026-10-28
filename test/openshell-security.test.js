// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

import { OpenShellSupervisor, OpenShellPolicyViolationError, OpenShellHITLRequiredError } from '../Runtime/OpenShellSupervisor.js';
import { SecretZeroGateway } from '../Runtime/SecretZeroGateway.js';
import { HITLTrigger } from '../Runtime/HITLTrigger.js';
import { OpenShellSandbox } from '../Runtime/OpenShellSandbox.js';

test('SecretZeroGateway injects credentials and redacts them from responses', () => {
  const gateway = new SecretZeroGateway();
  gateway.registerSecret('TEST_PROD_API_KEY', 'sk_live_998877665544332211');
  gateway.registerSecret('DB_PASSWORD', 'super_secret_db_pass_123');

  // Agent formulates command with placeholder
  const agentCommand = 'curl -H "Authorization: Bearer {{SECRET:TEST_PROD_API_KEY}}" https://api.stripe.com';
  const injected = gateway.inject(agentCommand);
  assert.ok(injected.includes('sk_live_998877665544332211'));
  assert.ok(!injected.includes('{{SECRET:'));

  // Gateway sanitizes raw output containing secret
  const rawResponse = 'Response received from server with key sk_live_998877665544332211 and status 200';
  const sanitized = gateway.sanitize(rawResponse);
  assert.ok(!sanitized.includes('sk_live_998877665544332211'));
  assert.ok(sanitized.includes('[SECRET_REDACTED_BY_OPENSHELL]:TEST_PROD_API_KEY'));

  // Leak inspector
  const checkClean = gateway.inspectForLeaks('Normal clean prompt for agent');
  assert.strictEqual(checkClean.leaked, false);

  const checkLeaked = gateway.inspectForLeaks('Leaked key sk_live_998877665544332211 in prompt');
  assert.strictEqual(checkLeaked.leaked, true);
  assert.deepStrictEqual(checkLeaked.exposedKeys, ['TEST_PROD_API_KEY']);
});

test('HITLTrigger manages authorization request lifecycle in SQLite-WAL', () => {
  const testDb = 'test_hitl.db';
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  const hitl = new HITLTrigger({ dbPath: testDb });

  // 1. Identify approval required
  assert.strictEqual(hitl.isApprovalRequired('production_db_write'), true);
  assert.strictEqual(hitl.isApprovalRequired('financial_transaction'), true);
  assert.strictEqual(hitl.isApprovalRequired('read_metrics'), false);

  // 2. Request approval
  const reqId = hitl.requestApproval({
    agentId: 'worker_node_1',
    actionType: 'production_db_write',
    commandOrTarget: 'UPDATE users SET tier = "enterprise"',
    details: { reason: 'contract upgrade' }
  });

  assert.ok(reqId.startsWith('hitl-'));

  const pendingList = hitl.listPending();
  assert.strictEqual(pendingList.length, 1);
  assert.strictEqual(pendingList[0].id, reqId);
  assert.strictEqual(pendingList[0].status, 'PENDING');

  // 3. Approve request
  hitl.approve(reqId, 'operator_admin');
  const statusAfterApprove = hitl.getStatus(reqId);
  assert.strictEqual(statusAfterApprove.status, 'APPROVED');
  assert.strictEqual(statusAfterApprove.decidedBy, 'operator_admin');

  hitl.close();
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});

test('OpenShellSupervisor enforces deny-by-default rules', async () => {
  const testDb = 'test_openshell_sup.db';
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  const supervisor = new OpenShellSupervisor({ dbPath: testDb, profile: 'strict' });

  // 1. Deny command pattern
  assert.throws(() => {
    supervisor.validateCommand('rm -rf /var/data', 'untrusted_worker');
  }, OpenShellPolicyViolationError);

  assert.throws(() => {
    supervisor.validateCommand('DROP TABLE audit_trail', 'untrusted_worker');
  }, OpenShellPolicyViolationError);

  // 2. Deny sensitive filesystem paths
  assert.throws(() => {
    supervisor.validateFileSystem('/root/.ssh/id_rsa', 'read', 'untrusted_worker');
  }, OpenShellPolicyViolationError);

  assert.throws(() => {
    supervisor.validateFileSystem('/app/.env', 'read', 'untrusted_worker');
  }, OpenShellPolicyViolationError);

  // 3. Deny network egress not in whitelist
  assert.throws(() => {
    supervisor.validateNetwork('https://malicious-exfiltration-c2.com/data', 443, 'untrusted_worker');
  }, OpenShellPolicyViolationError);

  // 4. Deny egress to prohibited ports
  assert.throws(() => {
    supervisor.validateNetwork('https://sarembok.com', 22, 'untrusted_worker');
  }, OpenShellPolicyViolationError);

  // 5. Allow nominal whitelisted network and command
  assert.doesNotThrow(() => {
    supervisor.validateCommand('git status', 'worker');
    supervisor.validateNetwork('https://api.github.com/repos', 443, 'worker');
    supervisor.validateFileSystem('./generated/output.json', 'write', 'worker');
  });

  supervisor.close();
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});

test('OpenShellSandbox executes command with Secret Zero injection and audit log', async () => {
  const testDb = 'test_sandbox_exec.db';
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  const sandbox = new OpenShellSandbox({ dbPath: testDb });
  sandbox.supervisor.secretZero.registerSecret('TEST_ECHO_TOKEN', 'token_super_secret_777');

  // Command references placeholder {{SECRET:TEST_ECHO_TOKEN}}
  const res = await sandbox.runCommand('node -e "console.log(\'GREETING=\' + process.argv[1])" "{{SECRET:TEST_ECHO_TOKEN}}"');
  
  // The actual process executed with the secret injected, but sanitized in returned response!
  assert.ok(res.stdout.includes('[SECRET_REDACTED_BY_OPENSHELL]:TEST_ECHO_TOKEN'));
  assert.ok(!res.stdout.includes('token_super_secret_777'));

  // Verify security audit events logged to SQLite-WAL
  const logs = sandbox.supervisor.getRecentSecurityLogs(5);
  assert.ok(logs.length >= 1);
  assert.strictEqual(logs[0].policy_decision, 'ALLOW');

  sandbox.close();
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});
