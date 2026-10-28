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
import { fingerprint, diff } from '../bin/contract-diff.js';

const spec = (props, extra = {}) => ({
    paths: {
        '/users': {
            get: { responses: { 200: { content: { 'application/json': { schema: { type: 'object', properties: props } } } } } },
        },
        ...extra,
    },
});

test('identical specs produce no drift', () => {
    const a = fingerprint(spec({ id: { type: 'integer' } }));
    assert.deepStrictEqual(diff(a, a), { breaking: [], additive: [] });
});

test('removed response field is breaking', () => {
    const base = fingerprint(spec({ id: { type: 'integer' }, name: { type: 'string' } }));
    const cur = fingerprint(spec({ id: { type: 'integer' } }));
    const d = diff(base, cur);
    assert.strictEqual(d.breaking.length, 1);
    assert.match(d.breaking[0], /name:string/);
});

test('retyped field is breaking', () => {
    const base = fingerprint(spec({ id: { type: 'integer' } }));
    const cur = fingerprint(spec({ id: { type: 'string' } }));
    assert.strictEqual(diff(base, cur).breaking.length, 1);
});

test('removed endpoint is breaking, new endpoint is additive', () => {
    const base = fingerprint(spec({ id: { type: 'integer' } }));
    const cur = fingerprint({ paths: { '/orders': { post: { responses: { 201: {} } } } } });
    const d = diff(base, cur);
    assert.ok(d.breaking.includes('removed endpoint: GET /users'));
    assert.ok(d.additive.includes('new endpoint: POST /orders'));
});

test('added field is additive only', () => {
    const base = fingerprint(spec({ id: { type: 'integer' } }));
    const cur = fingerprint(spec({ id: { type: 'integer' }, email: { type: 'string' } }));
    const d = diff(base, cur);
    assert.strictEqual(d.breaking.length, 0);
    assert.strictEqual(d.additive.length, 1);
});

test('non-method keys (parameters, summary) are ignored', () => {
    const f = fingerprint({ paths: { '/x': { parameters: [], summary: 's', get: { responses: { 200: {} } } } } });
    assert.deepStrictEqual(Object.keys(f), ['GET /x']);
});
