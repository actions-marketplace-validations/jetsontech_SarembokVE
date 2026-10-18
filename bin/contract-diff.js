'use strict';

/**
 * Contract drift engine.
 *
 * fingerprint(openApiSpec) -> { "GET /users": ["200.id:integer", "status:200", ...] }
 * diff(baseline, current)  -> { breaking: [...], additive: [...] }
 *
 * Breaking:  an endpoint or response field that existed in the baseline is gone
 *            or changed type (a retyped field appears as its old form missing).
 * Additive:  new endpoints / new response fields. Never fails a gate.
 */

const METHODS = /^(get|post|put|patch|delete|head|options)$/i;

function collect(schema, prefix, set, depth) {
    if (!schema || typeof schema !== 'object' || depth > 4) return;
    if (schema.properties && typeof schema.properties === 'object') {
        for (const key of Object.keys(schema.properties)) {
            const child = schema.properties[key] || {};
            set.add(`${prefix}.${key}:${child.type || 'any'}`);
            collect(child, `${prefix}.${key}`, set, depth + 1);
        }
    }
    if (schema.items) collect(schema.items, `${prefix}[]`, set, depth + 1);
}

function fingerprint(spec) {
    const out = {};
    const paths = (spec && spec.paths) || {};
    for (const p of Object.keys(paths)) {
        for (const method of Object.keys(paths[p] || {})) {
            if (!METHODS.test(method)) continue;
            const op = paths[p][method] || {};
            const set = new Set();
            const responses = op.responses || {};
            for (const code of Object.keys(responses)) {
                set.add(`status:${code}`);
                const content = (responses[code] || {}).content || {};
                for (const ct of Object.keys(content)) {
                    collect((content[ct] || {}).schema, code, set, 0);
                }
            }
            out[`${method.toUpperCase()} ${p}`] = Array.from(set).sort();
        }
    }
    return out;
}

function diff(baseline, current) {
    const breaking = [];
    const additive = [];
    const base = baseline || {};
    const cur = current || {};

    for (const key of Object.keys(base)) {
        if (!(key in cur)) {
            breaking.push(`removed endpoint: ${key}`);
            continue;
        }
        const now = new Set(cur[key]);
        for (const f of base[key]) {
            if (!now.has(f)) breaking.push(`${key}: removed or retyped ${f}`);
        }
        const was = new Set(base[key]);
        for (const f of cur[key]) {
            if (!was.has(f)) additive.push(`${key}: new ${f}`);
        }
    }
    for (const key of Object.keys(cur)) {
        if (!(key in base)) additive.push(`new endpoint: ${key}`);
    }
    return { breaking, additive };
}

module.exports = { fingerprint, diff };
