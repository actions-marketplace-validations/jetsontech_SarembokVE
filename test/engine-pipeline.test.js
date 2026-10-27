import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';

import { ShannonEntropyEvaluator } from '../Runtime/EntropyDefense.js';
import { VoiceOrchestrationFabric } from '../fabric/voiceOrchestrator.js';
import { ContainerProvisioner } from '../Tools/Provisioner.js';

test('ShannonEntropyEvaluator calculates mathematical entropy correctly', () => {
  const evaluator = new ShannonEntropyEvaluator('./sarembok.config.json');
  assert.strictEqual(evaluator.threshold, 0.88);
  assert.strictEqual(evaluator.windowSize, 10);
  assert.strictEqual(evaluator.actionOnHalt, 'rollback');

  // Max entropy for uniform distribution of 2 states: - 2 * (0.5 * log2(0.5)) = 1.0
  const maxEntropy = evaluator.calculateEntropy(['state_a', 'state_b']);
  assert.strictEqual(Math.round(maxEntropy * 100) / 100, 1.0);

  // Minimum entropy for repetitive state: - 1.0 * log2(1.0) = 0.0
  const minEntropy = evaluator.calculateEntropy(['state_a', 'state_a', 'state_a']);
  assert.strictEqual(minEntropy, 0.0);
  evaluator.close();
});

test('ShannonEntropyEvaluator triggers halt on repetitive loop degradation', async () => {
  const testDb = 'test_entropy_eval.db';
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  const evaluator = new ShannonEntropyEvaluator();
  evaluator.dbPath = testDb;
  evaluator.close();
  evaluator.db = new (await import('better-sqlite3')).default(testDb);
  evaluator.initEngine();

  // Push identical repeated states to trigger entropy degradation halt
  evaluator.evaluateState('worker_test', 'identical_hash');
  evaluator.evaluateState('worker_test', 'identical_hash');
  evaluator.evaluateState('worker_test', 'identical_hash');
  evaluator.evaluateState('worker_test', 'identical_hash');
  const result = evaluator.evaluateState('worker_test', 'identical_hash');

  assert.strictEqual(result.halt, true);
  assert.strictEqual(result.action, 'rollback');
  assert.ok(result.entropy <= (1 - 0.88));

  evaluator.close();
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});

test('VoiceOrchestrationFabric handles WebSocket events and telemetry polling', async () => {
  const testPort = 9055;
  const fabric = new VoiceOrchestrationFabric(testPort);
  await fabric.start();

  const ws = new WebSocket(`ws://localhost:${testPort}`);

  const connected = await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  // Test METAHUMAN_READY
  const readyResponse = await new Promise((resolve) => {
    ws.on('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
    ws.send(JSON.stringify({ event: 'METAHUMAN_READY' }));
  });

  assert.strictEqual(readyResponse.status, 'CONNECTED');
  assert.strictEqual(readyResponse.stream_mode, 'HighFidelity_PCM');

  // Test POLL_COGNITIVE_ENTROPY
  const telemetryResponse = await new Promise((resolve) => {
    ws.removeAllListeners('message');
    ws.on('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
    ws.send(JSON.stringify({ event: 'POLL_COGNITIVE_ENTROPY' }));
  });

  assert.strictEqual(telemetryResponse.event, 'STATE_TELEMETRY_UPDATE');
  assert.ok(telemetryResponse.payload);

  ws.close();
  await fabric.close();
});

test('ContainerProvisioner validates container parameters and engine auto-detection', () => {
  const provisioner = new ContainerProvisioner();
  assert.strictEqual(provisioner.imageName, 'sarembok-chromium-worker:latest');
  assert.ok(provisioner.evaluator);
  provisioner.evaluator.close();
});
