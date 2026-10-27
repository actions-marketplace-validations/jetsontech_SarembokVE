import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

import { SemanticCache } from '../Runtime/SemanticCache.js';
import { ModelFallbackRouter } from '../Runtime/ModelFallbackRouter.js';
import { AuditExporter } from '../Runtime/AuditExporter.js';
import { SarembokEval } from '../Runtime/SarembokEval.js';
import { generateHtmlAuditReport } from '../Tools/AuditReportGenerator.js';

test('SemanticCache caches prompt results and calculates savings', () => {
  const testDb = 'test_sem_cache.db';
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  const cache = new SemanticCache({ dbPath: testDb });

  const prompt = 'Synthesize OpenAPI 3.1 endpoints for Stripe webhooks';
  const responseData = { endpoints: ['/v1/webhook'], methods: ['POST'] };

  // Initial miss
  assert.strictEqual(cache.get(prompt), null);

  // Set cache
  cache.set(prompt, responseData, 500);

  // Hit cache
  const hit = cache.get(prompt);
  assert.ok(hit);
  assert.strictEqual(hit.cached, true);
  assert.deepStrictEqual(hit.data, responseData);

  const stats = cache.getStats();
  assert.strictEqual(stats.total_cached_entries, 1);
  assert.strictEqual(stats.total_tokens_saved, 1000);

  cache.close();
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});

test('ModelFallbackRouter degrades gracefully across tiers', async () => {
  const testDb = 'test_router.db';
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  const router = new ModelFallbackRouter({ dbPath: testDb });

  let callCount = 0;
  const result = await router.executeWithFallback(async (model) => {
    callCount++;
    if (model === 'gemini-3.1-flash') {
      throw new Error('429 Rate limit exceeded');
    }
    return { data: `Response from ${model}` };
  });

  assert.strictEqual(result.tier, 'SECONDARY');
  assert.strictEqual(result.modelUsed, 'gemini-2.5-flash');
  assert.strictEqual(callCount, 2);

  router.close();
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});

test('AuditExporter exports tamper-proof audit trails with cryptographic seal', () => {
  const testDb = 'test_exporter.db';
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  const exporter = new AuditExporter({ dbPath: testDb });
  const jsonExport = JSON.parse(exporter.exportJSON(10));

  assert.strictEqual(jsonExport.sarembok_compliance_standard, 'SOC2-Type-II / ISO-27001 Agent Audit Protocol');
  assert.ok(jsonExport.cryptographic_sha256_seal);

  const csvExport = exporter.exportCSV(10);
  assert.ok(csvExport.includes('id,timestamp,agent_id,action_type'));

  exporter.close();
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});

test('SarembokEval executes complete regression suite with 100/100 composite score', async () => {
  const suite = new SarembokEval();
  const res = await suite.runSuite();

  assert.strictEqual(res.suite, 'Sarembok-Eval v1.0');
  assert.strictEqual(res.overall_status, 'NOMINAL_GREEN');
  assert.strictEqual(res.composite_score, '100/100');
  assert.strictEqual(res.benchmarks.length, 5);
});

test('AuditReportGenerator produces standalone HTML report with embedded visualizer', () => {
  const html = generateHtmlAuditReport({
    targetUrl: 'https://api.staging.internal',
    breaking: ['GET /users: removed or retyped id:string'],
    additive: ['POST /orders: new endpoint'],
    entropy: 0.24
  });

  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('CRITICAL CONTRACT DRIFT DETECTED'));
  assert.ok(html.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(html.includes('GET /users: removed or retyped id:string'));
});
