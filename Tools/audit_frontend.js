// ============================================================================
// Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
//
// This source code is licensed under the Business Source License 1.1 (BSL).
// Commercial use, deployment in production environments, or redistribution 
// for profit is strictly prohibited without a valid commercial license.
//
// For commercial inquiries, licensing, or partnerships, contact the Licensor.
// ============================================================================

const fs = require('fs');

const html = fs.readFileSync('frontend/index.html', 'utf8');

// 1. Extract all script contents
const scriptSrcRegex = /<script\b[^>]*\bsrc=["']([^"']+)["']/gi;
let srcMatch;
const externalScripts = [];
while ((srcMatch = scriptSrcRegex.exec(html)) !== null) {
  externalScripts.push(srcMatch[1]);
}
console.log('External script tags:', externalScripts);

const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let allJs = '';
let sMatch;
while ((sMatch = scriptRegex.exec(html)) !== null) {
  allJs += '\n' + sMatch[1];
}

// Also read local external scripts
externalScripts.forEach(src => {
  const cleanPath = src.split('?')[0].replace(/^\//, '');
  const localFile = 'frontend/' + cleanPath;
  if (fs.existsSync(localFile)) {
    console.log('Including external script:', localFile);
    allJs += '\n' + fs.readFileSync(localFile, 'utf8');
  }
});

// 2. Find all inline event handlers (onclick, onchange, etc.)
const handlerRegex = /\b(on[a-z]+)=["']([^"']+)["']/gi;
let match;
const handlers = [];
while ((match = handlerRegex.exec(html)) !== null) {
  handlers.push({ event: match[1], code: match[2] });
}
console.log('Total inline event handlers found:', handlers.length);

const calledFns = new Set();
handlers.forEach(h => {
  if (h.code.includes('toggleSarembokLiveMode')) {
    console.log('Found handler with toggleSarembokLiveMode:', h);
  }
  ['add', 'if', 'getElementById', 'writeText'].forEach(fn => {
    if (new RegExp('\\b' + fn + '\\s*\\(').test(h.code)) {
      console.log(`Handler with ${fn}: [${h.event}="${h.code}"]`);
    }
  });
  const fns = h.code.match(/([a-zA-Z0-9_$]+)\s*\(/g);
  if (fns) {
    fns.forEach(f => calledFns.add(f.replace('(', '').trim()));
  }
});

const builtins = new Set([
  'alert', 'confirm', 'prompt', 'preventDefault', 'stopPropagation',
  'click', 'focus', 'blur', 'select', 'submit', 'reset', 'toString',
  'parseInt', 'parseFloat', 'Boolean', 'String', 'Number', 'Date',
  'Math', 'JSON', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'
]);

const missingFns = [];
calledFns.forEach(fn => {
  if (builtins.has(fn)) return;
  const re = new RegExp(`(\\bfunction\\s+${fn}\\b|\\b${fn}\\s*=|\\bwindow\\.${fn}\\b)`);
  if (!re.test(allJs)) {
    missingFns.push(fn);
  }
});
console.log('Missing/undefined inline handler functions:', missingFns);

// 3. Find all document.getElementById('...') in JS and verify if ID exists in HTML
const getElemRegex = /document\.getElementById\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const idsInJs = new Set();
while ((match = getElemRegex.exec(allJs)) !== null) {
  idsInJs.add(match[1]);
}
console.log('Unique getElementById IDs in JS:', idsInJs.size);

const missingIds = [];
idsInJs.forEach(id => {
  // Check if id="..." exists in html
  const idRe = new RegExp(`id=["']${id}["']`, 'i');
  if (!idRe.test(html)) {
    missingIds.push(id);
  }
});
console.log('IDs queried via getElementById but MISSING from HTML:', missingIds);

missingIds.filter(id => !id.includes('${')).forEach(id => {
  const getRe = new RegExp(`document\\.getElementById\\s*\\(\\s*['"]${id}['"]\\s*\\)\\.([a-zA-Z0-9_$]+)`, 'g');
  let m;
  while ((m = getRe.exec(allJs)) !== null) {
    console.log(`POTENTIAL NULL DEREFERENCE: document.getElementById('${id}').${m[1]}`);
  }
});

// 4. Find all querySelector / querySelectorAll with ID or class
const qsRegex = /document\.querySelector(?:All)?\s*\(\s*['"`]#([a-zA-Z0-9_-]+)['"`]\s*\)/g;
const qsIds = new Set();
while ((match = qsRegex.exec(allJs)) !== null) {
  qsIds.add(match[1]);
}
const missingQsIds = [];
qsIds.forEach(id => {
  const idRe = new RegExp(`id=["']${id}["']`, 'i');
  if (!idRe.test(html)) {
    missingQsIds.push(id);
  }
});
console.log('IDs queried via querySelector(#id) but MISSING from HTML:', missingQsIds);

// 5. Check fetch() URLs in JS
const fetchRegex = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
const fetchUrls = new Set();
while ((match = fetchRegex.exec(allJs)) !== null) {
  fetchUrls.add(match[1]);
}
// 7. Check sendRPC calls vs BROWSER_ALLOWED_METHODS
const serverPy = fs.readFileSync('Deployment/cloud/server.py', 'utf8');
const setMatch = serverPy.match(/BROWSER_ALLOWED_METHODS\s*=\s*\{([\s\S]*?)\}/);
const allowed = new Set();
if (setMatch) {
  const lines = setMatch[1].split('\n');
  lines.forEach(l => {
    const m = l.match(/"([^"]+)"/);
    if (m) allowed.add(m[1]);
  });
}

const rpcCalls = new Set();
const rpcRegex = /sendRPC\s*\(\s*['"]([^'"]+)['"]/g;
while ((match = rpcRegex.exec(allJs)) !== null) {
  rpcCalls.add(match[1]);
}
console.log('Total unique sendRPC calls in JS:', rpcCalls.size);
const notAllowed = [];
rpcCalls.forEach(m => {
  if (!allowed.has(m)) {
    notAllowed.push(m);
  }
});
console.log('Frontend sendRPC methods NOT in server BROWSER_ALLOWED_METHODS:', notAllowed);
