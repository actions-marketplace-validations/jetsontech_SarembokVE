import { WebSocketServer } from 'ws';
import sqlite3 from 'better-sqlite3';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

export class VoiceOrchestrationFabric {
  constructor(port = 9001, dbPath = 'sarembok_memory.db') {
    this.port = port;
    this.db = new sqlite3(dbPath, { fileMustExist: false });
    this.server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'Sarembok Voice Substrate Online', port: this.port }));
    });
    this.wss = new WebSocketServer({ server: this.server });
    this.initFabric();
  }

  initFabric() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
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

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      console.log(`\x1b[35m[Voice Fabric]\x1b[0m High-Fidelity Client Connected from: ${clientIp}`);

      ws.on('message', async (message) => {
        try {
          const packet = JSON.parse(message.toString());
          switch (packet.event) {
            case 'METAHUMAN_READY':
              ws.send(JSON.stringify({
                status: 'CONNECTED',
                system: 'SarembokOS Engine 3.8',
                stream_mode: 'HighFidelity_PCM'
              }));
              break;
            case 'AUDIO_STREAM_CHUNK':
              // Route direct buffer payload data safely to target voice analyzer algorithms
              ws.send(JSON.stringify({
                event: 'AUDIO_CHUNK_ACK',
                received_bytes: packet.chunk ? packet.chunk.length : 0
              }));
              break;
            case 'POLL_COGNITIVE_ENTROPY': {
              // Direct non-blocking extraction out of the shared WAL memory space
              const latestTrace = this.db.prepare(`
                SELECT agent_role, state_hash, entropy_score, timestamp
                FROM cognitive_traces
                ORDER BY id DESC LIMIT 1
              `).get();
              ws.send(JSON.stringify({
                event: 'STATE_TELEMETRY_UPDATE',
                payload: latestTrace || { status: 'IDLE', entropy_score: 1.0 }
              }));
              break;
            }
            default:
              ws.send(JSON.stringify({ error: 'UNSUPPORTED_FABRIC_OPCODE' }));
          }
        } catch (err) {
          ws.send(JSON.stringify({ status: 'PARSING_EXCEPTION', details: err.message }));
        }
      });

      ws.on('close', () => {
        console.log(`\x1b[35m[Voice Fabric]\x1b[0m High-fidelity digital-human rendering session detached.`);
      });
    });
  }

  start(host = '127.0.0.1') {
    return new Promise((resolve) => {
      this.server.listen(this.port, host, () => {
        console.log(`\x1b[1m\x1b[35m[Sarembok Voice Substrate]\x1b[0m Gateway online. Listening on port ${this.port}`);
        resolve(this.port);
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          this.db.close();
          resolve();
        });
      });
    });
  }
}

// Global execution wrapper hook
const isMain = process.argv[1] && (
  process.argv[1].endsWith('voiceOrchestrator.js') ||
  process.argv[1] === fileURLToPath(import.meta.url)
);

if (isMain) {
  const fabric = new VoiceOrchestrationFabric();
  fabric.start();
}
