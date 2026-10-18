#!/usr/bin/env node

/**
 * SarembokVE Official CLI
 * 1-Command Autonomous Systems Verification & CI/CD Contract Auditor
 * 
 * Usage:
 *   npx sarembok spec <target_url> [--out <file>] [--format <openapi|typescript>]
 *   npx sarembok audit <target_url>
 *   npx sarembok health
 *   npx sarembok worker
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { fingerprint, diff } = require('./contract-diff');

const SAREMBOK_HOST = process.env.SAREMBOK_HOST || 'https://sarembok.com';

function printBanner() {
    console.log('\x1b[36m%s\x1b[0m', '=======================================================');
    console.log('\x1b[1m\x1b[36m   SAREMBOK VE · AUTONOMOUS SYSTEMS VERIFICATION\x1b[0m');
    console.log('\x1b[36m%s\x1b[0m', '=======================================================');
}

function fetchJson(url, postData = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (url.startsWith('https') ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: postData ? 'POST' : 'GET',
            headers: {
                'User-Agent': 'SarembokCLI/1.0 (Node.js)',
                ...(postData ? { 'Content-Type': 'application/json' } : {}),
                ...extraHeaders
            }
        };
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        client.get(url, { headers: { 'User-Agent': 'SarembokCLI/1.0 (Node.js)' } }, (res) => {
            if (res.statusCode >= 400) {
                return reject(new Error(`HTTP ${res.statusCode} on download`));
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

async function handleSpec(args) {
    const target = args[0];
    if (!target) {
        console.error('\x1b[31mError: Target URL required. Example: npx sarembok spec https://httpbin.org\x1b[0m');
        process.exit(1);
    }

    let outFile = null;
    let format = 'openapi';
    let headers = {};

    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--out' || args[i] === '-o') {
            outFile = args[++i];
        } else if (args[i] === '--format' || args[i] === '-f') {
            format = args[++i];
        } else if (args[i] === '--header' || args[i] === '-H') {
            const h = args[++i] || '';
            const idx = h.indexOf(':');
            if (idx > -1) {
                headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
            }
        } else if (args[i] === '--token' || args[i] === '--auth') {
            const tok = args[++i] || '';
            headers['Authorization'] = tok.startsWith('Bearer ') ? tok : `Bearer ${tok}`;
        }
    }

    console.log(`\x1b[33m⚡ Dispatched Playwright Chromium verification to cluster: ${target}...\x1b[0m`);
    if (Object.keys(headers).length > 0) {
        console.log(`\x1b[36m  Injected Headers:\x1b[0m ${Object.keys(headers).join(', ')}`);
    }
    const t0 = Date.now();

    try {
        let endpoint = `${SAREMBOK_HOST}/api/spec?target=${encodeURIComponent(target)}`;
        if (headers['Authorization']) {
            endpoint += `&token=${encodeURIComponent(headers['Authorization'])}`;
        }
        for (const [k, v] of Object.entries(headers)) {
            if (k.toLowerCase() !== 'authorization') {
                endpoint += `&header=${encodeURIComponent(k + ':' + v)}`;
            }
        }
        const result = await fetchJson(endpoint);
        const duration = Date.now() - t0;

        console.log(`\x1b[32m✔ Verification Complete in ${duration}ms (Cluster Latency: ${result.latencyMs || 'N/A'}ms)\x1b[0m`);
        console.log(`\x1b[36m  Automation Engine:\x1b[0m ${result.engine || 'Chromium'} (${result.automation || 'Playwright'})`);
        console.log(`\x1b[36m  Extraction:\x1b[0m ${result.verified ? 'OK' : 'FAILED'}${result.cached ? ' (served from cache; use `audit` for a fresh run)' : ''}`);

        if (outFile) {
            const exportUrl = `${SAREMBOK_HOST}/api/spec/export?target=${encodeURIComponent(target)}&format=${format}`;
            await downloadFile(exportUrl, outFile);
            console.log(`\x1b[32m✔ Exported ${format.toUpperCase()} contract to: ${outFile}\x1b[0m`);
        } else {
            console.log('\n\x1b[1mTypeScript Contract Interface:\x1b[0m\n');
            console.log(result.typeScriptContracts || '// No contracts generated');
        }
    } catch (err) {
        console.error(`\x1b[31m✖ Specification failed: ${err.message}\x1b[0m`);
        process.exit(1);
    }
}

async function handleAudit(args) {
    const target = args[0];
    if (!target) {
        console.error('\x1b[31mError: Target URL required. Example: npx sarembok audit https://api.staging.internal\x1b[0m');
        process.exit(1);
    }

    let headers = {};
    let baselinePath = path.join('.sarembok', 'baseline.json');
    let updateBaseline = false;
    let failOnDrift = true;
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--header' || args[i] === '-H') {
            const h = args[++i] || '';
            const idx = h.indexOf(':');
            if (idx > -1) {
                headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
            }
        } else if (args[i] === '--token' || args[i] === '--auth') {
            const tok = args[++i] || '';
            headers['Authorization'] = tok.startsWith('Bearer ') ? tok : `Bearer ${tok}`;
        } else if (args[i] === '--baseline') {
            baselinePath = args[++i];
        } else if (args[i] === '--update-baseline') {
            updateBaseline = true;
        } else if (args[i] === '--no-fail') {
            failOnDrift = false;
        }
    }

    console.log(`\x1b[33m[AUDIT] Extracting live contract (fresh, uncached): ${target}\x1b[0m`);
    try {
        // fresh=1 bypasses the server's 30-minute spec cache: a drift gate must never read stale data.
        let endpoint = `${SAREMBOK_HOST}/api/spec?target=${encodeURIComponent(target)}&fresh=1`;
        if (headers['Authorization']) {
            endpoint += `&token=${encodeURIComponent(headers['Authorization'])}`;
        }
        for (const [k, v] of Object.entries(headers)) {
            if (k.toLowerCase() !== 'authorization') {
                endpoint += `&header=${encodeURIComponent(k + ':' + v)}`;
            }
        }
        const result = await fetchJson(endpoint);

        if (!result.verified) {
            console.error(`\x1b[31m✖ EXTRACTION FAILED for ${target}. Nothing to compare.\x1b[0m`);
            process.exit(1);
        }
        if (result.cached) {
            console.error('\x1b[31m✖ Server returned a cached result for a fresh request (server too old). Refusing to gate on stale data.\x1b[0m');
            process.exit(1);
        }

        const current = fingerprint(result.openApiSpec);
        const opCount = Object.keys(current).length;

        if (updateBaseline || !fs.existsSync(baselinePath)) {
            fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
            fs.writeFileSync(baselinePath, JSON.stringify({ target, createdAt: new Date().toISOString(), contract: current }, null, 2));
            console.log(`\x1b[32m✔ Baseline ${updateBaseline ? 'updated' : 'created'} at ${baselinePath} (${opCount} operations).\x1b[0m`);
            console.log('  Commit this file. Future runs fail on breaking changes against it.');
            process.exit(0);
        }

        const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
        const { breaking, additive } = diff(baseline.contract, current);

        additive.forEach(a => console.log(`\x1b[36m  + ${a}\x1b[0m`));
        breaking.forEach(b => console.log(`\x1b[31m  - ${b}\x1b[0m`));

        if (breaking.length) {
            console.error(`\x1b[31m✖ ${breaking.length} breaking change(s) vs baseline (${opCount} operations now).\x1b[0m`);
            process.exit(failOnDrift ? 1 : 0);
        }
        console.log(`\x1b[32m✔ No breaking changes vs baseline (${opCount} operations, ${additive.length} additive).\x1b[0m`);
        process.exit(0);
    } catch (err) {
        console.error(`\x1b[31m✖ AUDIT ERROR: ${err.message}\x1b[0m`);
        process.exit(1);
    }
}

async function handleHealth() {
    try {
        const data = await fetchJson(`${SAREMBOK_HOST}/session`);
        console.log(`\x1b[32m✔ Sarembok Cluster Online: ${SAREMBOK_HOST}\x1b[0m`);
        console.log(`\x1b[36m  Available Scopes:\x1b[0m ${(data.scope || []).length} methods enabled`);
    } catch (err) {
        console.error(`\x1b[31m✖ Cluster unreachable: ${err.message}\x1b[0m`);
        process.exit(1);
    }
}

function handleWorker() {
    console.log('\x1b[36m%s\x1b[0m', 'Sovereign GPU Compute Mesh - 1-Click Launch');
    console.log('To donate or run dedicated GPU compute on Google Colab or RunPod:');
    console.log('\n\x1b[33m  curl -sSL https://sarembok.com/Deployment/cloud/colab_worker.py | python - --server wss://sarembok.com/worker/ws\x1b[0m\n');
    console.log('Or open in Colab: https://github.com/jetsontech/SarembokVE/blob/main/Deployment/cloud/sarembok_gpu_worker.ipynb');
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    printBanner();

    switch (command.toLowerCase()) {
        case 'spec':
            await handleSpec(args.slice(1));
            break;
        case 'audit':
            await handleAudit(args.slice(1));
            break;
        case 'health':
            await handleHealth();
            break;
        case 'worker':
            handleWorker();
            break;
        default:
            console.log(`Commands:
  sarembok spec <url> [--out <path>] [--format openapi|typescript]
  sarembok audit <url> [--baseline <file>] [--update-baseline] [--no-fail]
                             (Diffs the live contract against a committed baseline;
                              exit 1 on breaking changes. First run creates the baseline.)
  sarembok health            (Checks cluster latency & session broker)
  sarembok worker            (Prints sovereign GPU worker launcher)
            `);
            break;
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
