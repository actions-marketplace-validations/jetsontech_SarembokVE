/**
 * SarembokVE Unified Client SDK - v3.0.0
 * 
 * Exposes:
 * - Direct & MCP Tool invocations: openshell_verify, contract_spec, entropy_evaluate, wal_verify
 * - HMAC-SHA256 Macaroon capability token minting, attenuation, and verification
 * - WebSocket JSON-RPC 2.0 communication for platform RPC facets
 */

import { McpServer } from '../fabric/src/protocols/mcp_server.js';
import { CapabilityTokenFactory, CapabilityType } from '../fabric/src/guardrails/capability_token.js';

export { CapabilityTokenFactory, CapabilityType };

export class SarembokClient {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.host="127.0.0.1"]
   * @param {number} [options.port=9000]
   * @param {string} [options.signingSecret]
   */
  constructor(options = {}) {
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 9000;
    this.url = `ws://${this.host}:${this.port}`;
    this.signingSecret = options.signingSecret || process.env.SAREMBOK_CAPABILITY_SECRET || 'SOVEREIGN_CAPABILITY_SIGNING_KEY_DIRECTIVE_01';
    this.tokenFactory = new CapabilityTokenFactory(this.signingSecret);
    this.mcpServer = new McpServer();
    this.ws = null;
  }

  // ==========================================
  // MCP TOOL INVOCATIONS
  // ==========================================

  /**
   * Invoke an MCP tool directly via the embedded McpServer
   * @param {string} name - Tool name
   * @param {Object} [args={}] - Tool arguments
   * @returns {Promise<any>}
   */
  async invokeMcpTool(name, args = {}) {
    return await this.mcpServer.handleCallTool(name, args);
  }

  /**
   * Verify command against OpenShell deny-by-default rules
   * @param {Object|string} params
   * @returns {Promise<{ allowed: boolean, command: string, requiresHitl: boolean, reason: string }>}
   */
  async openshellVerify(params) {
    const args = typeof params === 'string' ? { command: params } : params;
    return await this.invokeMcpTool('openshell_verify', args);
  }

  /**
   * Retrieve formal OpenAPI 3.1 contracts and schemas
   * @param {Object} [params={}]
   * @param {string} [params.serviceName]
   * @returns {Promise<any>}
   */
  async contractSpec(params = {}) {
    return await this.invokeMcpTool('contract_spec', params);
  }

  /**
   * Evaluate Shannon entropy of agent output over sliding window
   * @param {Object} params
   * @param {string} params.output - Current agent output
   * @param {string[]} [params.history=[]] - Recent dialogue history
   * @returns {Promise<any>}
   */
  async entropyEvaluate(params) {
    return await this.invokeMcpTool('entropy_evaluate', params);
  }

  /**
   * Cryptographically verify SQLite-WAL ledger integrity and Merkle hash chain
   * @param {Object} [params={}]
   * @param {string} [params.dbPath]
   * @param {boolean} [params.verifySignatures=true]
   * @returns {Promise<any>}
   */
  async walVerify(params = {}) {
    return await this.invokeMcpTool('wal_verify', params);
  }

  // Aliases matching snake_case MCP naming
  async openshell_verify(params) { return this.openshellVerify(params); }
  async contract_spec(params) { return this.contractSpec(params); }
  async entropy_evaluate(params) { return this.entropyEvaluate(params); }
  async wal_verify(params) { return this.walVerify(params); }

  // ==========================================
  // MACAROON CAPABILITY TOKEN HELPERS
  // ==========================================

  /**
   * Mint a new unforgeable HMAC-SHA256 Macaroon capability token
   * @param {Object} params
   * @param {string} params.agentId - Agent ID recipient
   * @param {string[]} [params.capabilities=[]] - CapabilityType permissions
   * @param {string[]} [params.caveats=[]] - First-party caveats
   * @param {number} [params.ttlMs=60000] - Time-to-live in ms
   * @returns {Object} Minted token object
   */
  mintToken(params) {
    return this.tokenFactory.mintToken(params);
  }

  /**
   * Attenuate an existing Macaroon token by appending a first-party caveat and chaining HMAC
   * @param {Object} token - Token to attenuate
   * @param {string} caveat - New first-party caveat (e.g. 'pathPrefix=/workspace')
   * @returns {Object} Attenuated token
   */
  attenuateToken(token, caveat) {
    return this.tokenFactory.attenuate(token, caveat);
  }

  /**
   * Verify HMAC-SHA256 signature chain and evaluate caveats against execution context
   * @param {Object|string} token - Token object, JSON string, or Base64 string
   * @param {Object} [context={}] - Verification context
   * @returns {boolean} True if token is valid and satisfies all caveats
   */
  verifyToken(token, context = {}) {
    return this.tokenFactory.verify(token, context);
  }

  // ==========================================
  // WEBSOCKET PLATFORM RPC FACETS (Optional)
  // ==========================================

  async connect() {
    if (typeof WebSocket === 'undefined') {
      return false;
    }
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve(true);
      this.ws.onerror = (err) => reject(err);
    });
  }

  async call(method, params = {}) {
    if (!this.ws || this.ws.readyState !== 1) {
      await this.connect();
    }
    return new Promise((resolve) => {
      const id = `sdk-${method.toLowerCase()}-${Date.now()}`;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === id) {
          this.ws?.removeEventListener('message', handler);
          resolve(data);
        }
      };
      this.ws?.addEventListener('message', handler);
      this.ws?.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default SarembokClient;
