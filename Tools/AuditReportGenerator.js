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
 * SarembokVE - Standalone Audit HTML Report Generator with Embedded Visualizer
 * 
 * Generates an executive dark-mode HTML audit report with the native SVG visualizer
 * embedded so developers can visually see topology breaks and contract drift.
 */

import fs from 'fs';
import path from 'path';
import { generateDefaultVisualMatrix } from './Visualizer.js';

export function generateHtmlAuditReport({
  targetUrl,
  breaking = [],
  additive = [],
  entropy = 0.14,
  timestamp = new Date().toISOString()
}) {
  const driftDetected = breaking.length > 0;
  const statusColor = driftDetected ? '#f43f5e' : '#10b981';
  const statusText = driftDetected ? 'CRITICAL CONTRACT DRIFT DETECTED' : 'CONTRACT COMPLIANT (0 BREAKING CHANGES)';
  
  const embeddedSvg = generateDefaultVisualMatrix({
    driftDetected,
    entropy,
    timestamp
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SarembokVE Audit Report &middot; ${targetUrl}</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #0f172a;
      --border: #1e293b;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --danger: #f43f5e;
      --success: #10b981;
    }
    body {
      margin: 0;
      padding: 2rem;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    .badge {
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
      border: 1px solid ${statusColor};
      background: ${driftDetected ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)'};
      color: ${statusColor};
    }
    .visualizer-container {
      margin: 2rem 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-top: 2rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
    }
    h2 {
      margin-top: 0;
      font-size: 1.1rem;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    li {
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
    }
    .breaking-item { color: #fca5a5; }
    .additive-item { color: #86efac; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1 style="margin:0; font-size:1.5rem; letter-spacing:1px; color:var(--accent);">SAREMBOK VE // CI/CD AUDIT GATE</h1>
        <p style="margin:0.25rem 0 0 0; color:var(--text-muted); font-size:0.9rem;">Target: <strong>${targetUrl}</strong> &middot; Evaluated: ${timestamp}</p>
      </div>
      <div class="badge">${statusText}</div>
    </header>

    <div class="visualizer-container">
      ${embeddedSvg}
    </div>

    <div class="grid">
      <div class="card">
        <h2 style="color:var(--danger);">&#10006; Breaking Mutations (${breaking.length})</h2>
        ${breaking.length === 0 ? '<p style="color:var(--text-muted); font-size:0.9rem;">No breaking contract drift detected. Baseline integrity intact.</p>' : ''}
        <ul>
          ${breaking.map(b => `<li class="breaking-item">&#8211; ${b}</li>`).join('')}
        </ul>
      </div>

      <div class="card">
        <h2 style="color:var(--success);">&#10004; Additive Endpoints & Fields (${additive.length})</h2>
        ${additive.length === 0 ? '<p style="color:var(--text-muted); font-size:0.9rem;">No new additive endpoints detected.</p>' : ''}
        <ul>
          ${additive.map(a => `<li class="additive-item">+ ${a}</li>`).join('')}
        </ul>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function commitHtmlAuditReport(params, outPath = './public/generated/visuals/audit_report.html') {
  const html = generateHtmlAuditReport(params);
  const resolved = path.resolve(process.cwd(), outPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(resolved, html, 'utf8');
  console.log(`\x1b[32m✔ [Audit Visualizer]\x1b[0m High-fidelity HTML report generated: ${resolved}`);
  return resolved;
}
