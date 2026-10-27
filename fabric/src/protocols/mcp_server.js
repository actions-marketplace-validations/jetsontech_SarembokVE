/**
 * SarembokVE Model Context Protocol (MCP) Standard Server
 * Pillar 2: Standardize Agent Interoperability Protocols
 * 
 * Implements the open Model Context Protocol (MCP) JSON-RPC 2.0 specification.
 * Exposes Sarembok's sovereign capabilities (memory query, state reconstitution,
 * audit verification, and task execution) to external third-party models and agent swarms.
 */

import { EventEmitter } from 'node:events';

export const MCP_VERSION = '2024-11-05';

export class SarembokMcpServer extends EventEmitter {
  /**
   * @param {Object} options
   * @param {import('../runtime/fabric_kernel.js').FabricKernel} options.kernel
   * @param {string} [options.serverName='sarembok-mcp-server']
   * @param {string} [options.version='1.0.0']
   */
  constructor(options = {}) {
    super();
    this.kernel = options.kernel;
    this.serverName = options.serverName || 'sarembok-mcp-server';
    this.version = options.version || '1.0.0';

    this.tools = new Map();
    this.resources = new Map();

    this.registerStandardTools();
    this.registerStandardResources();
  }

  /**
   * Register Sarembok standard MCP tools
   */
  registerStandardTools() {
    this.registerTool({
      name: 'sarembok_execute_turn',
      description: 'Execute a full autonomous flywheel turn through the Sarembok Strategist, Worker, and Auditor nodes with Shannon loop prevention and audit seals.',
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
                name: this.serverName,
                version: this.version
              }
            }
          };

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
