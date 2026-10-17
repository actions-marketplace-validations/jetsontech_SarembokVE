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

const SAREMBOK_HOST = process.env.SAREMBOK_HOST || 'https://sarembok.com';

function printBanner() {
    console.log('\x1b[36m%s\x1b[0m', '=======================================================');
    console.log('\x1b[1m\x1b[36m   SAREMBOK VE · AUTONOMOUS SYSTEMS VERIFICATION\x1b[0m');
    console.log('\x1b[36m%s\x1b[0m', '=======================================================');
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: { 'User-Agent': 'SarembokCLI/1.0 (Node.js)' } }, (res) => {
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

    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--out' || args[i] === '-o') {
            outFile = args[++i];
        } else if (args[i] === '--format' || args[i] === '-f') {
            format = args[++i];
        }
    }

    console.log(`\x1b[33m⚡ Dispatched Playwright Chromium verification to cluster: ${target}...\x1b[0m`);
    const t0 = Date.now();

    try {
        const endpoint = `${SAREMBOK_HOST}/api/spec?target=${encodeURIComponent(target)}`;
        const result = await fetchJson(endpoint);
        const duration = Date.now() - t0;

        console.log(`\x1b[32m✔ Verification Complete in ${duration}ms (Cluster Latency: ${result.latencyMs || 'N/A'}ms)\x1b[0m`);
        console.log(`\x1b[36m  Automation Engine:\x1b[0m ${result.engine || 'Chromium'} (${result.automation || 'Playwright'})`);
        console.log(`\x1b[36m  Truth Verification:\x1b[0m ${result.verified ? 'PASSED (100% Deterministic)' : 'UNVERIFIED'}`);

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

    console.log(`\x1b[33m🛡️ [CI/CD GATE] Auditing target contract: ${target}...\x1b[0m`);
    try {
        const endpoint = `${SAREMBOK_HOST}/api/spec?target=${encodeURIComponent(target)}`;
        const result = await fetchJson(endpoint);

        if (!result.verified) {
            console.error(`\x1b[31m✖ GATE BLOCKED: Specification verification failed for ${target}!\x1b[0m`);
            process.exit(1);
        }

        console.log(`\x1b[32m✔ GATE PASSED: Target API verified in ${result.latencyMs || 0}ms. Zero contract regressions.\x1b[0m`);
        process.exit(0);
    } catch (err) {
        console.error(`\x1b[31m✖ GATE ERROR: ${err.message}\x1b[0m`);
        process.exit(1);
    }
}

async function handleHealth() {
    try {
        const data = await fetchJson(`${SAREMBOK_HOST}/session`);
        console.log(`\x1b[32m✔ Sarembok Cluster Online: ${SAREMBOK_HOST}\x1b[0m`);
        console.log(`\x1b[36m  Active Session Token:\x1b[0m ${(data.sessionToken || '').slice(0, 12)}...`);
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
  sarembok audit <url>       (Fails CI build with exit code 1 if broken)
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
