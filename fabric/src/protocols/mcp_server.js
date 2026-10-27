/**
 * SarembokVE Model Context Protocol (MCP) Standard Server
 * Spec-Compliant MCP JSON-RPC 2.0 Server over stdio and programmatic dispatch
 * Protocol Version: 2024-11-05 | Server: sarembok-ve-mcp v3.0.0
 * 
 * Exposes Sarembok's sovereign capabilities (OpenShell verification, contract spec,
 * entropy evaluation, WAL Merkle verification, memory query, state reconstitution,
 * and task execution) to external models and IDEs (Cursor, Claude Desktop, Antigravity).
 */

import { EventEmitter } from 'node:events';
import readline from 'node:readline';
import { OpenShellSandbox } from '../../../Runtime/OpenShellSandbox.js';
import { SchemaRegistry } from '../registry/schema_registry.js';
import { EntropyEvaluator } from '../guardrails/entropy_evaluator.js';
import { WalStore } from '../memory/wal_store.js';

export const MCP_VERSION = '2024-11-05';

export class SarembokMcpServer extends EventEmitter {
  /**
   * @param {Object} options
   * @param {import('../runtime/fabric_kernel.js').FabricKernel} [options.kernel]
   * @param {string} [options.serverName='sarembok-ve-mcp']
   * @param {string} [options.version='3.0.0']
   */
  constructor(options = {}) {
    super();
    this.kernel = options.kernel || null;
    this.serverName = options.serverName || 'sarembok-ve-mcp';
    this.version = options.version || '3.0.0';

    this.tools = new Map();
    this.resources = new Map();

    this.registerStandardTools();
    this.registerStandardResources();
  }

  /**
   * Register Sarembok standard MCP tools
   */
  registerStandardTools() {
    // 1. openshell_verify
    this.registerTool({
      name: 'openshell_verify',
      description: 'Statically verify an OS command against OpenShell deny-by-default policies (13 deterministic AST & regex signatures, path boundary).',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to verify' },
          agentId: { type: 'string', description: 'Agent identifier', default: 'mcp-agent' }
        },
        required: ['command']
      },
      handler: async (args) => {
        let sandbox = null;
        try {
          sandbox = new OpenShellSandbox();
          sandbox.supervisor.validateCommand(args.command, args.agentId || 'mcp-agent');
          const requiresHitl = sandbox.supervisor.hitl.isApprovalRequired('command', args.command);
          return {
            allowed: true,
            command: args.command,
            requiresHitl,
            reason: 'Command conforms to OpenShell deterministic policy signatures'
          };
        } catch (err) {
          return {
            allowed: false,
            command: args.command,
            reason: err.message,
            violation: err.name || 'OpenShellPolicyViolationError'
          };
        } finally {
          if (sandbox) sandbox.close();
        }
      }
    });

    // 2. openshell_status
    this.registerTool({
      name: 'openshell_status',
      description: 'Inspect OpenShell-Compatible Zero-Trust Supervisor v1.0 security runtime and active policy profile.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        let sandbox = null;
        try {
          sandbox = new OpenShellSandbox();
          return sandbox.getStatus();
        } finally {
          if (sandbox) sandbox.close();
        }
      }
    });

    // 3. contract_spec
    this.registerTool({
      name: 'contract_spec',
      description: 'Retrieve formal OpenAPI 3.1 contracts and schemas registered in the sovereign registry.',
      inputSchema: {
        type: 'object',
        properties: {
          serviceName: { type: 'string', description: 'Target microservice name (optional)' }
        }
      },
      handler: async (args) => {
        const registry = this.kernel?.registry || new SchemaRegistry();
        const spec = registry.generateOpenApiSpec(args.serviceName || 'default-service');
        return spec;
      }
    });

    // 4. entropy_evaluate
    this.registerTool({
      name: 'entropy_evaluate',
      description: 'Evaluate Shannon entropy of agent output over sliding execution window to prevent recursive hallucination loops.',
      inputSchema: {
        type: 'object',
        properties: {
          output: { type: 'string', description: 'Current agent output string' },
          history: { type: 'array', items: { type: 'string' }, description: 'Recent output history' }
        },
        required: ['output']
      },
      handler: async (args) => {
        const text = args.output || '';
        const history = Array.isArray(args.history) ? args.history : [];
        const fullDialogue = [...history, text];

        // Evaluate loop risk
        const loopResult = EntropyEvaluator.evaluateLoop(fullDialogue);

        // Compute Shannon token entropy of output
        const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
        const freqs = {};
        for (const t of tokens) freqs[t] = (freqs[t] || 0) + 1;
        const len = tokens.length || 1;
        let entropy = 0;
        for (const k in freqs) {
          const p = freqs[k] / len;
          entropy -= p * Math.log2(p);
        }

        return {
          entropyScore: Number(entropy.toFixed(4)),
          similarityScore: loopResult.score || 0.0,
          loopDetected: loopResult.triggerRollback || false,
          threshold: 0.88,
          status: loopResult.triggerRollback ? 'HALT_RECOMMENDED' : 'NOMINAL'
        };
      }
    });

    // 5. wal_verify
    this.registerTool({
      name: 'wal_verify',
      description: 'Verify SHA-256 Merkle hash chain integrity of the SQLite-WAL transactional ledger from genesis.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Target session ID (optional)' }
        }
      },
      handler: async (args) => {
        const walStore = this.kernel?.walStore || new WalStore();
        try {
          const result = walStore.verifyIntegrity(args.sessionId || null);
          return {
            status: 'VERIFIED',
            ...result
          };
        } catch (err) {
          return {
            status: 'TAMPER_DETECTED',
            error: err.message
          };
        }
      }
    });

    // Standard engine tools
    this.registerTool({
      name: 'sarembok_execute_turn',
      description: 'Execute a full autonomous flywheel turn through the Sarembok Strategist, Worker, and Auditor nodes.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Active session identifier' },
          prompt: { type: 'string', description: 'Task instruction or prompt to execute' },
          workerId: { type: 'string', enum: ['worker-code', 'worker-scrape', 'worker-api'], default: 'worker-code' },
          estimatedTokens: { type: 'number', default: 150 }
        },
        required: ['sessionId', 'prompt']
      },
      handler: async (args) => {
        if (!this.kernel) throw new Error('Kernel not bound to MCP server');
        return await this.kernel.executeFlywheelTurn(args);
      }
    });

    this.registerTool({
      name: 'sarembok_reconstitute_state',
      description: 'Rebuild complete state machine from the append-only SQLite-WAL transaction log for a given session without holding RAM state.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session identifier to project state for' }
        },
        required: ['sessionId']
      },
      handler: async (args) => {
        if (!this.kernel) throw new Error('Kernel not bound to MCP server');
        return this.kernel.reconstituteState(args.sessionId);
      }
    });

    this.registerTool({
      name: 'sarembok_audit_verify',
      description: 'Verify cryptographic SHA-256 seal and structural isolation signature of an execution output against the sovereign audit secret.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          workerId: { type: 'string' },
          output: { type: 'string' },
          validationHash: { type: 'string' }
        },
        required: ['sessionId', 'workerId', 'output', 'validationHash']
      },
      handler: async (args) => {
        if (!this.kernel || !this.kernel.auditor) throw new Error('Auditor node not available');
        const isValid = this.kernel.auditor.assertVerificationSignature(
          args.sessionId,
          args.workerId,
          args.output,
          {},
          args.validationHash
        );
        return { verified: isValid, validationHash: args.validationHash };
      }
    });
  }

  /**
   * Register standard MCP resources
   */
  registerStandardResources() {
    this.registerResource({
      uri: 'sarembok://system/health',
      name: 'Sarembok Runtime Health',
      mimeType: 'application/json',
      handler: async () => {
        return {
          status: 'ONLINE',
          kernelBound: !!this.kernel,
          activeWorkers: this.kernel ? Array.from(this.kernel.workers.keys()) : [],
          timestamp: new Date().toISOString()
        };
      }
    });
  }

  /**
   * Register a new tool
   */
  registerTool(toolDef) {
    this.tools.set(toolDef.name, toolDef);
  }

  /**
   * Register a new resource
   */
  registerResource(resourceDef) {
    this.resources.set(resourceDef.uri, resourceDef);
  }

  /**
   * Start line-delimited JSON-RPC 2.0 stdio server on process.stdin / process.stdout
   */
  startStdio() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const req = JSON.parse(trimmed);

        // Handle notifications (no response per JSON-RPC 2.0 spec)
        if (
          req.method === 'notifications/initialized' ||
          req.method === 'initialized' ||
          (req.method && req.id === undefined && req.id === null)
        ) {
          this.emit('initialized');
          return;
        }

        const resp = await this.handleJsonRpc(req);
        if (resp && req.id !== undefined && req.id !== null) {
          process.stdout.write(JSON.stringify(resp) + '\n');
        }
      } catch (err) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: `Parse error: ${err.message}` }
          }) + '\n'
        );
      }
    });

    return rl;
  }

  /**
   * Handle incoming JSON-RPC 2.0 MCP request
   * @param {Object} request
   * @returns {Promise<Object>} JSON-RPC 2.0 response
   */
  async handleJsonRpc(request) {
    if (!request || request.jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id: request?.id ?? null,
        error: { code: -32600, message: 'Invalid Request: Must be JSON-RPC 2.0' }
      };
    }

    try {
      switch (request.method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: MCP_VERSION,
              capabilities: {
                tools: {},
                resources: {}
              },
              serverInfo: {
                name: 'sarembok-ve-mcp',
                version: '3.0.0'
              }
            }
          };

        case 'notifications/initialized':
        case 'initialized':
          this.emit('initialized');
          return null;

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: Array.from(this.tools.values()).map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema
              }))
            }
          };

        case 'tools/call': {
          const { name, arguments: toolArgs } = request.params || {};
          const tool = this.tools.get(name);
          if (!tool) {
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32601, message: `Tool not found: ${name}` }
            };
          }

          const output = await tool.handler(toolArgs || {});
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof output === 'string' ? output : JSON.stringify(output, null, 2)
                }
              ]
            }
          };
        }

        case 'resources/list':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              resources: Array.from(this.resources.values()).map(r => ({
                uri: r.uri,
                name: r.name,
                mimeType: r.mimeType
              }))
            }
          };

        case 'resources/read': {
          const { uri } = request.params || {};
          const resource = this.resources.get(uri);
          if (!resource) {
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32602, message: `Resource not found: ${uri}` }
            };
          }

          const data = await resource.handler();
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: resource.mimeType,
                  text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
                }
              ]
            }
          };
        }

        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: `Method not found: ${request.method}` }
          };
      }
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32000, message: err.message, data: err.stack }
      };
    }
  }
}
