#!/usr/bin/env node

/**
 * SarembokVE Unified Cross-Platform CLI
 * Unified AI-Native Computing Environment Control Plane
 * Replaces: start_jarvis.bat, start_voice_engine.bat, and legacy PowerShell orchestrators
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { ContainerProvisioner } from '../Tools/Provisioner.js';
import { VoiceOrchestrationFabric } from '../fabric/voiceOrchestrator.js';
import { OpenShellSandbox } from '../Runtime/OpenShellSandbox.js';
import { HITLTrigger } from '../Runtime/HITLTrigger.js';
import { SemanticCache } from '../Runtime/SemanticCache.js';
import { AuditExporter } from '../Runtime/AuditExporter.js';
import { SarembokEval } from '../Runtime/SarembokEval.js';
import { ModelFallbackRouter } from '../Runtime/ModelFallbackRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const command = args[0];

const commands = {
  engine: {
    desc: 'Manage underlying Argon, Container, and Digital-Human Substrate processes',
    subcommands: {
      start: 'Initialize the main orchestration server and state engines',
      voice: 'Activate high-fidelity voice synthesis orchestrators (Port 9001)',
      provision: 'Provision an ephemeral, capability-dropped Chromium sandbox container'
    }
  },
  openshell: {
    desc: 'NVIDIA OpenShell Zero-Trust Security Control Plane & Sandbox Boundaries',
    subcommands: {
      status: 'Display active containment profile, security parameters, and Secret Zero status',
      profile: 'Inspect or switch pre-baked containment profiles (strict, enterprise, audit, developer)',
      verify: 'Verify a command or action against deny-by-default rules and HITL gates',
      run: 'Execute a command inside the OpenShell sandbox with Secret Zero credential injection'
    }
  },
  eval: {
    desc: 'Run internal Sarembok-Eval automated agentic regression & benchmark suite'
  },
  cache: {
    desc: 'Inspect or flush the Semantic Reasoning Cache layer (Phase 1 token saver)'
  },
  router: {
    desc: 'View active model degradation routes and circuit breaker failover status'
  },
  pending: {
    desc: 'List pending Human-In-The-Loop (HITL) authorization requests awaiting sign-off'
  },
  approve: {
    desc: 'Approve a pending HITL authorization request (e.g. sarembok approve hitl-xxxx)'
  },
  reject: {
    desc: 'Reject a pending HITL authorization request (e.g. sarembok reject hitl-xxxx [reason])'
  },
  spec: {
    desc: 'Extract OpenAPI 3.1 & TypeScript specifications from a live target web app'
  },
  audit: {
    desc: 'Run a drift-detection gate against your committed contract baseline (or export logs)'
  },
  health: {
    desc: 'Query status of local runtime and engine layers'
  }
};

function printHelp() {
  console.log(`\x1b[1m\x1b[35mSarembokVE CLI\x1b[0m - AI-Native Computing Environment Control Plane\n`);
  console.log(`\x1b[1mUsage:\x1b[0m sarembok <command> [options]\n`);
  console.log(`\x1b[1mEngine & Compute Commands:\x1b[0m`);
  console.log(`  \x1b[32mengine start\x1b[0m             ${commands.engine.subcommands.start}`);
  console.log(`  \x1b[32mengine voice\x1b[0m             ${commands.engine.subcommands.voice}`);
  console.log(`  \x1b[32mengine provision [url]\x1b[0m   ${commands.engine.subcommands.provision}\n`);

  console.log(`\x1b[1mNVIDIA OpenShell Zero-Trust Security:\x1b[0m`);
  console.log(`  \x1b[36mopenshell status\x1b[0m         ${commands.openshell.subcommands.status}`);
  console.log(`  \x1b[36mopenshell profile [name]\x1b[0m ${commands.openshell.subcommands.profile}`);
  console.log(`  \x1b[36mopenshell verify <cmd>\x1b[0m   ${commands.openshell.subcommands.verify}`);
  console.log(`  \x1b[36mopenshell run <cmd>\x1b[0m      ${commands.openshell.subcommands.run}\n`);

  console.log(`\x1b[1mHuman-In-The-Loop (HITL) Governance:\x1b[0m`);
  console.log(`  \x1b[33mpending\x1b[0m                  ${commands.pending.desc}`);
  console.log(`  \x1b[33mapprove <id>\x1b[0m             ${commands.approve.desc}`);
  console.log(`  \x1b[33mreject <id> [reason]\x1b[0m     ${commands.reject.desc}\n`);

  console.log(`\x1b[1mCognitive Core & Optimization:\x1b[0m`);
  console.log(`  \x1b[35meval\x1b[0m                     ${commands.eval.desc}`);
  console.log(`  \x1b[35mcache [stats|clear]\x1b[0m      ${commands.cache.desc}`);
  console.log(`  \x1b[35mrouter\x1b[0m                   ${commands.router.desc}\n`);

  console.log(`\x1b[1mVerification & API Contract Audits:\x1b[0m`);
  console.log(`  \x1b[32mspec <url>\x1b[0m               ${commands.spec.desc}`);
  console.log(`  \x1b[32maudit <url>\x1b[0m              ${commands.audit.desc}`);
  console.log(`  \x1b[32maudit export [--format]\x1b[0m  Export compliant tamper-proof audit trail (JSON/CSV)`);
  console.log(`  \x1b[32mhealth\x1b[0m                   ${commands.health.desc}\n`);
}

if (!command || args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

function runProcess(cmd, procArgs, options = {}) {
  const child = spawn(cmd, procArgs, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
    shell: false
  });

  child.on('close', (code) => {
    if (code !== 0) {
      process.exit(code || 1);
    }
  });

  return child;
}

switch (command) {
  case 'engine': {
    const sub = args[1];
    if (sub === 'start') {
      console.log('\x1b[34m[Sarembok Core]\x1b[0m Booting backend Python substrate and state ledgers...');
      const backendServer = path.join(ROOT_DIR, 'backend', 'server.py');
      runProcess('python', [backendServer]);
    } else if (sub === 'voice') {
      console.log('\x1b[34m[Sarembok Voice]\x1b[0m Initializing native real-time WebSockets voice architecture...');
      const port = Number(process.env.SAREMBOK_VOICE_PORT || 9001);
      const voiceEngine = new VoiceOrchestrationFabric(port);
      voiceEngine.start();
    } else if (sub === 'provision') {
      const targetUrl = args[2] || 'https://httpbin.org';
      console.log(`\x1b[34m[Sarembok Core]\x1b[0m Spawning verification test hook container for: ${targetUrl}`);
      const provisioner = new ContainerProvisioner();
      provisioner.provisionIsolatedWorker(targetUrl, Date.now()).then(res => {
        console.log(`\x1b[32m✔ Environment isolated cleanly:\x1b[0m Node Identifier: ${res.containerId}`);
      }).catch(err => {
        console.error(`\x1b[31m✕ Provisioning Refused:\x1b[0m ${err.message}`);
        process.exit(1);
      });
    } else {
      console.error('\x1b[31mError:\x1b[0m Invalid engine subcommand. Use "start", "voice", or "provision".');
      process.exit(1);
    }
    break;
  }

  case 'openshell': {
    const sub = args[1] || 'status';
    const sandbox = new OpenShellSandbox();

    if (sub === 'status') {
      const status = sandbox.getStatus();
      console.log(`\x1b[1m\x1b[36m🛡️  NVIDIA OpenShell Security Control Plane Status\x1b[0m\n`);
      console.log(`  Engine:               ${status.openshell_engine}`);
      console.log(`  Active Profile:       \x1b[32m${status.active_profile}\x1b[0m`);
      console.log(`  Read-Only Root:       ${status.read_only_root ? '✔ Enforced' : '✕ Disabled'}`);
      console.log(`  Secret Zero Tokens:   ${status.secret_zero_registered_tokens} credentials masked`);
      console.log(`  Pending HITL Gates:   ${status.pending_hitl_approvals} actions awaiting approval`);
      console.log(`  Deny Command Rules:   ${status.deny_patterns_count} mathematical signatures`);
      console.log(`  Allowed Domains:      ${status.allowed_domains.join(', ')}\n`);
      sandbox.close();
    } else if (sub === 'profile') {
      const targetProfile = args[2];
      const profilesPath = path.resolve(ROOT_DIR, 'Config', 'openshell.profiles.json');
      if (fs.existsSync(profilesPath)) {
        const raw = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
        if (targetProfile) {
          if (!raw.profiles[targetProfile]) {
            console.error(`\x1b[31mError:\x1b[0m Unknown profile '${targetProfile}'. Available: ${Object.keys(raw.profiles).join(', ')}`);
            process.exit(1);
          }
          raw.active_profile = targetProfile;
          fs.writeFileSync(profilesPath, JSON.stringify(raw, null, 2), 'utf8');
          console.log(`\x1b[32m✔ OpenShell profile switched to:\x1b[0m ${targetProfile}`);
        } else {
          console.log(`\x1b[1mAvailable Containment Profiles:\x1b[0m`);
          for (const [name, prof] of Object.entries(raw.profiles)) {
            const isCur = name === raw.active_profile ? ' \x1b[32m(active)\x1b[0m' : '';
            console.log(`  • \x1b[1m${name}\x1b[0m${isCur}: ${prof.description}`);
          }
        }
      }
      sandbox.close();
    } else if (sub === 'verify') {
      const targetCmd = args.slice(2).join(' ');
      if (!targetCmd) {
        console.error('\x1b[31mError:\x1b[0m Command argument required for verification.');
        process.exit(1);
      }
      try {
        sandbox.supervisor.validateCommand(targetCmd, 'cli_verifier');
        const requiresHitl = sandbox.supervisor.hitl.isApprovalRequired('command', targetCmd);
        if (requiresHitl) {
          console.log(`\x1b[33m⚠ Command triggers Human-In-The-Loop (HITL) authorization requirement.\x1b[0m`);
        } else {
          console.log(`\x1b[32m✔ Policy Check Passed:\x1b[0m Command '${targetCmd}' conforms to OpenShell deny-by-default rules.`);
        }
      } catch (err) {
        console.error(`\x1b[31m✕ Policy Violation:\x1b[0m ${err.message}`);
        process.exit(1);
      }
      sandbox.close();
    } else if (sub === 'run') {
      const targetCmd = args.slice(2).join(' ');
      if (!targetCmd) {
        console.error('\x1b[31mError:\x1b[0m Command argument required for execution.');
        process.exit(1);
      }
      sandbox.runCommand(targetCmd, { agentId: 'cli_runner' }).then(res => {
        if (res.stdout) console.log(res.stdout);
        if (res.stderr) console.error(res.stderr);
        process.exit(res.exitCode);
      }).catch(err => {
        console.error(`\x1b[31m✕ Execution Refused by OpenShell:\x1b[0m ${err.message}`);
        process.exit(1);
      });
    } else {
      console.error('\x1b[31mError:\x1b[0m Unknown openshell subcommand. Use "status", "profile", "verify", or "run".');
      process.exit(1);
    }
    break;
  }

  case 'eval': {
    const suite = new SarembokEval();
    suite.runSuite().then(res => {
      console.log(`\x1b[1mSuite Results: ${res.suite} &middot; Status: \x1b[32m${res.overall_status}\x1b[0m\x1b[0m`);
      console.log(`Composite Score: \x1b[1m\x1b[36m${res.composite_score}\x1b[0m | Duration: ${res.duration_total_ms}ms\n`);
      for (const b of res.benchmarks) {
        const color = b.status === 'PASSED' ? '\x1b[32m✔' : '\x1b[31m✕';
        console.log(`  ${color} [${b.status}]\x1b[0m \x1b[1m${b.benchmark}\x1b[0m (${b.duration_ms}ms)`);
        console.log(`     ${b.metric}`);
      }
    });
    break;
  }

  case 'cache': {
    const sub = args[1] || 'stats';
    const cache = new SemanticCache();
    if (sub === 'clear') {
      cache.clear();
      console.log(`\x1b[32m✔ Semantic reasoning cache cleared.\x1b[0m`);
    } else {
      const stats = cache.getStats();
      console.log(`\x1b[1m\x1b[35mSemantic Reasoning Cache Statistics (Phase 1):\x1b[0m`);
      console.log(`  Cached Reasoning Entries:  ${stats.total_cached_entries}`);
      console.log(`  Total Cache Hits:          ${stats.total_cache_hits}`);
      console.log(`  Estimated Tokens Saved:    \x1b[32m${stats.total_tokens_saved.toLocaleString()}\x1b[0m tokens`);
      console.log(`  Estimated Cost Reduction:  \x1b[36m${stats.estimated_savings_usd}\x1b[0m`);
    }
    cache.close();
    break;
  }

  case 'router': {
    const router = new ModelFallbackRouter();
    const route = router.getActiveRoute();
    console.log(`\x1b[1m\x1b[34mModel Fallback & Graceful Degradation Router:\x1b[0m`);
    console.log(`  Active Route:          \x1b[32m${route.active_model}\x1b[0m`);
    console.log(`  Primary Frontier:      ${route.primary}`);
    console.log(`  Secondary Fast Tier:   ${route.secondary}`);
    console.log(`  Local Sovereign Tier:  ${route.local_sovereign}`);
    console.log(`  Tripped Circuit Count: ${JSON.stringify(route.failure_states)}`);
    router.close();
    break;
  }

  case 'pending': {
    const hitl = new HITLTrigger();
    const list = hitl.listPending();
    if (list.length === 0) {
      console.log(`\x1b[32m✔ No pending HITL authorization requests.\x1b[0m All systems nominal.`);
    } else {
      console.log(`\x1b[1m\x1b[33mPending Human-In-The-Loop (HITL) Authorizations:\x1b[0m\n`);
      for (const item of list) {
        console.log(`  • ID: \x1b[1m\x1b[36m${item.id}\x1b[0m | Action: \x1b[33m${item.actionType}\x1b[0m | Agent: ${item.agentId}`);
        console.log(`    Target: ${item.commandOrTarget}`);
        console.log(`    Created: ${item.createdAt}\n`);
      }
    }
    hitl.close();
    break;
  }

  case 'approve': {
    const id = args[1];
    if (!id) {
      console.error('\x1b[31mError:\x1b[0m Approval request ID required (e.g. sarembok approve hitl-xxxx)');
      process.exit(1);
    }
    const hitl = new HITLTrigger();
    try {
      hitl.approve(id, process.env.USER || 'operator');
      console.log(`\x1b[32m✔ Request '${id}' approved successfully.\x1b[0m Execution permitted.`);
    } catch (err) {
      console.error(`\x1b[31m✕ Approval Failed:\x1b[0m ${err.message}`);
      process.exit(1);
    }
    hitl.close();
    break;
  }

  case 'reject': {
    const id = args[1];
    const reason = args.slice(2).join(' ') || 'Rejected by operator via CLI';
    if (!id) {
      console.error('\x1b[31mError:\x1b[0m Approval request ID required (e.g. sarembok reject hitl-xxxx [reason])');
      process.exit(1);
    }
    const hitl = new HITLTrigger();
    try {
      hitl.reject(id, process.env.USER || 'operator', reason);
      console.log(`\x1b[32m✔ Request '${id}' rejected.\x1b[0m Execution permanently blocked.`);
    } catch (err) {
      console.error(`\x1b[31m✕ Rejection Failed:\x1b[0m ${err.message}`);
      process.exit(1);
    }
    hitl.close();
    break;
  }

  case 'spec': {
    const url = args[1];
    if (!url) {
      console.error('\x1b[31mError:\x1b[0m Target URL is required for spec extraction.');
      process.exit(1);
    }
    const forwardArgs = args.slice(1);
    runProcess('node', [path.join(ROOT_DIR, 'bin', 'sarembok.js'), 'spec', ...forwardArgs]);
    break;
  }

  case 'audit': {
    const sub = args[1];
    if (sub === 'export') {
      const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'json';
      const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : `./audit_trail_export.${format}`;
      const exporter = new AuditExporter();
      const res = exporter.writeToFile(out, format);
      exporter.close();
      console.log(`\x1b[32m✔ Audit trail exported successfully:\x1b[0m ${res.path} (${res.records} tamper-proof records)`);
      break;
    }

    const url = args[1];
    if (!url) {
      console.error('\x1b[31mError:\x1b[0m Target URL is required for compliance audit (or use "audit export").');
      process.exit(1);
    }
    const forwardArgs = args.slice(1);
    runProcess('node', [path.join(ROOT_DIR, 'bin', 'sarembok.js'), 'audit', ...forwardArgs]);
    break;
  }

  case 'health': {
    const host = process.env.SAREMBOK_HOST || 'https://sarembok.com';
    runProcess('node', [path.join(ROOT_DIR, 'bin', 'sarembok.js'), 'health'], {
      env: { SAREMBOK_HOST: host }
    });
    break;
  }

  default:
    console.error(`\x1b[31mUnknown command:\x1b[0m ${command}`);
    printHelp();
    process.exit(1);
}
