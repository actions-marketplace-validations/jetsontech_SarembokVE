/**
 * SarembokVE Unforgeable Capability Token System
 * Pillar 3: Transition from Heuristic Guardrails to Formally Verified Policies
 * 
 * Provides cryptographically-signed, tamper-evident capability tokens granting
 * granular, least-privilege permissions to autonomous agents.
 */

import crypto from 'node:crypto';

export const CapabilityType = {
  FS_READ: 'FS:READ',
  FS_WRITE: 'FS:WRITE',
  NET_INGRESS: 'NET:INGRESS',
  NET_EGRESS: 'NET:EGRESS',
  SHELL_EXEC: 'SHELL:EXEC',
  STATE_MUTATE: 'STATE:MUTATE',
  AGENT_DELEGATE: 'AGENT:DELEGATE'
};

export class CapabilityTokenFactory {
  /**
   * @param {string} signingSecret - Sovereign secret key used to sign capability tokens
   */
  constructor(signingSecret = 'SOVEREIGN_CAPABILITY_SIGNING_KEY_DIRECTIVE_01') {
    this.signingSecret = signingSecret;
  }

  /**
   * Mint a new unforgeable capability token
   * @param {Object} params
   * @param {string} params.agentId - Recipient agent ID
   * @param {string[]} params.capabilities - Array of CapabilityType strings
   * @param {Object} [params.constraints={}] - Specific path, domain, or command constraints
   * @param {number} [params.ttlMs=60000] - Time-to-live in milliseconds
   * @returns {Object} Signed capability token
   */
  mintToken({
    agentId,
    capabilities = [],
    constraints = {},
    ttlMs = 60000
  }) {
    const payload = {
      tokenId: `cap-${crypto.randomUUID()}`,
      agentId,
      capabilities,
      constraints, // e.g. { allowedPaths: ['/tmp/sandbox'], allowedDomains: ['api.github.com'] }
      issuedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      nonce: crypto.randomBytes(8).toString('hex')
    };

    const signature = this.signToken(payload);
    return {
      ...payload,
      signature
    };
  }

  /**
   * Compute HMAC SHA-256 signature for token
   * @param {Object} payload 
   */
  signToken(payload) {
    const canonical = [
      payload.tokenId,
      payload.agentId,
      payload.capabilities.sort().join(','),
      JSON.stringify(payload.constraints),
      payload.issuedAt,
      payload.expiresAt,
      payload.nonce
    ].join('|');

    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(canonical)
      .digest('hex');
  }

  /**
   * Verify token authenticity and validity
   * @param {Object} token 
   * @returns {boolean} True if authentic and not expired
   */
  verifyToken(token) {
    if (!token || !token.signature) return false;

    // Check expiration
    if (Date.now() > token.expiresAt) {
      return false;
    }

    const expected = this.signToken(token);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(token.signature, 'hex'),
        Buffer.from(expected, 'hex')
      );
    } catch {
      return false;
    }
  }
}
