import sqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let commitHaltVisualAsset = null;
try {
  const visModule = await import('../Tools/Visualizer.js');
  commitHaltVisualAsset = visModule.commitHaltVisualAsset;
} catch {
  // Visualizer is optional in minimal test environments
}

export class ShannonEntropyEvaluator {
  constructor(configPath = './sarembok.config.json') {
    this.threshold = 0.88;
    this.windowSize = 10;
    this.actionOnHalt = 'rollback';
    this.dbPath = 'sarembok_memory.db';
    this.walMode = true;
    this.synchronous = 'NORMAL';

    this.loadConfig(configPath);
    this.db = new sqlite3(this.dbPath, { fileMustExist: false });
    this.initEngine();
  }

  loadConfig(configPath) {
    try {
      const resolved = path.isAbsolute(configPath)
        ? configPath
        : path.resolve(process.cwd(), configPath);

      if (fs.existsSync(resolved)) {
        const config = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
        if (config.entropy_defense) {
          if (typeof config.entropy_defense.shannon_threshold === 'number') {
            this.threshold = config.entropy_defense.shannon_threshold;
          }
          if (typeof config.entropy_defense.sliding_window_size === 'number') {
            this.windowSize = config.entropy_defense.sliding_window_size;
          }
          if (typeof config.entropy_defense.action_on_halt === 'string') {
            this.actionOnHalt = config.entropy_defense.action_on_halt;
          }
        }
        if (config.memory) {
          if (config.memory.db_path) {
            this.dbPath = config.memory.db_path;
          }
          if (typeof config.memory.wal_mode === 'boolean') {
            this.walMode = config.memory.wal_mode;
          }
          if (config.memory.synchronous) {
            this.synchronous = config.memory.synchronous;
          }
        }
      }
    } catch (err) {
      // Nominal fallback to defaults
    }
  }

  initEngine() {
    if (this.walMode) {
      this.db.pragma('journal_mode = WAL');
    }
    this.db.pragma(`synchronous = ${this.synchronous}`);
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS cognitive_traces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        agent_role TEXT,
        state_hash TEXT,
        prompt_tokens INTEGER,
        entropy_score REAL
      )
    `).run();
  }

  calculateEntropy(states) {
    if (!states || states.length === 0) return 0.0;
    const frequencies = {};
    states.forEach(s => {
      frequencies[s] = (frequencies[s] || 0) + 1;
    });
    const len = states.length;
    let entropy = 0;
    for (const key in frequencies) {
      const p = frequencies[key] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  evaluateState(agentRole, newStateHash) {
    // Write state immediately to zero-locking WAL ledger
    this.db.prepare(
      'INSERT INTO cognitive_traces (agent_role, state_hash, entropy_score) VALUES (?, ?, ?)'
    ).run(agentRole, newStateHash, 0.0);

    // Pull sliding window
    const history = this.db.prepare(
      'SELECT state_hash FROM cognitive_traces WHERE agent_role = ? ORDER BY id DESC LIMIT ?'
    ).all(agentRole, this.windowSize).map(row => row.state_hash);

    if (history.length < 3) {
      return { halt: false, entropy: 0.0 };
    }

    const entropy = this.calculateEntropy(history);

    // Update calculation back to trace log
    this.db.prepare(
      'UPDATE cognitive_traces SET entropy_score = ? WHERE id = (SELECT max(id) FROM cognitive_traces)'
    ).run(entropy);

    // Loop check boundary evaluation:
    // If state variety drops severely (entropy <= 1 - threshold), loop detected
    if (history.length >= 5 && entropy <= (1 - this.threshold)) {
      const haltEvent = {
        halt: true,
        entropy: entropy,
        action: this.actionOnHalt,
        agentRole: agentRole,
        message: `Halt triggered: Core degradation detected. State stability dropped below threshold.`
      };

      // Connect evaluated halt return path into visualizer SVG stack
      if (typeof commitHaltVisualAsset === 'function') {
        try {
          commitHaltVisualAsset(haltEvent);
        } catch {
          // Non-blocking visual generation
        }
      }

      return haltEvent;
    }

    return { halt: false, entropy: entropy };
  }

  close() {
    this.db.close();
  }
}
