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
 * SarembokVE Unforgeable Capability Token & Macaroon Chaining System
 * Pillar 3: Deterministic Constraint & Invariant Verification
 * 
 * Provides cryptographically-signed, tamper-evident Macaroon capability tokens granting
 * granular, least-privilege permissions to autonomous agents.
 * 
 * Capability Chaining:
 * - Root signature: sig_0 = HMAC-SHA256(rootSecret, tokenIdentifier)
 * - Caveat chaining: sig_i = HMAC-SHA256(sig_{i-1}, caveat_i)
 * - Constant-time timingSafeEqual verification
 */

import crypto from 'node:crypto';
import path from 'node:path';

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
   * Mint a new unforgeable capability token using nested HMAC-SHA256 Macaroon chaining
   * @param {Object} params
   * @param {string} params.agentId - Recipient agent ID
   * @param {string[]} params.capabilities - Array of CapabilityType strings
   * @param {Object} [params.constraints={}] - Specific path, domain, or command constraints
   * @param {string[]} [params.caveats=[]] - Explicit first-party caveats
   * @param {number} [params.ttlMs=60000] - Time-to-live in milliseconds
   * @returns {Object} Signed capability token
   */
  mintToken({
    agentId,
    capabilities = [],
    constraints = {},
    caveats = [],
    ttlMs = 60000
  }) {
    const tokenId = `cap-${crypto.randomUUID()}`;
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ttlMs;
    const nonce = crypto.randomBytes(8).toString('hex');

    // Build first-party caveats from parameters
    const firstPartyCaveats = [...caveats];

    // Standard structural caveats
    firstPartyCaveats.push(`agent=${agentId}`);
    firstPartyCaveats.push(`expiresAt=${expiresAt}`);
    firstPartyCaveats.push(`nonce=${nonce}`);

    if (capabilities.length > 0) {
      firstPartyCaveats.push(`capabilities=${[...capabilities].sort().join(',')}`);
    }

    if (constraints.allowedPaths && Array.isArray(constraints.allowedPaths)) {
      firstPartyCaveats.push(`allowedPaths=${constraints.allowedPaths.join(',')}`);
    }

    if (constraints.allowedDomains && Array.isArray(constraints.allowedDomains)) {
      firstPartyCaveats.push(`allowedDomains=${constraints.allowedDomains.join(',')}`);
    }

    // Compute Macaroon nested HMAC chain
    // sig_0 = HMAC-SHA256(rootSecret, tokenId)
    const rootSignature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(tokenId)
      .digest('hex');

    // sig_i = HMAC-SHA256(sig_{i-1}, caveat_i)
    let currentSignature = rootSignature;
    for (const caveat of firstPartyCaveats) {
      currentSignature = crypto
        .createHmac('sha256', Buffer.from(currentSignature, 'hex'))
        .update(caveat)
        .digest('hex');
    }

    return {
      tokenId,
      agentId,
      capabilities,
      constraints,
      caveats: firstPartyCaveats,
      issuedAt,
      expiresAt,
      nonce,
      rootSignature,
      signature: currentSignature
    };
  }

  /**
   * Attenuate an existing Macaroon token by appending a first-party caveat and chaining HMAC
   * @param {Object} token - Existing valid capability token
   * @param {string} caveat - New first-party caveat (e.g. 'pathPrefix=/workspace')
   * @returns {Object} Attenuated token
   */
  attenuate(token, caveat) {
    if (!token || !token.signature) {
      throw new Error('Cannot attenuate invalid token');
    }

    const newCaveats = [...(token.caveats || []), caveat];
    const newSignature = crypto
      .createHmac('sha256', Buffer.from(token.signature, 'hex'))
      .update(caveat)
      .digest('hex');

    return {
      ...token,
      caveats: newCaveats,
      signature: newSignature
    };
  }

  /**
   * Compute HMAC SHA-256 signature for token (canonical compatibility)
   * @param {Object} token 
   */
  computeSignature(token) {
    if (!token || !token.tokenId) return '';
    let sig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(token.tokenId)
      .digest('hex');

    const caveats = token.caveats || [];
    for (const caveat of caveats) {
      sig = crypto
        .createHmac('sha256', Buffer.from(sig, 'hex'))
        .update(caveat)
        .digest('hex');
    }
    return sig;
  }

  // Alias for backwards compatibility
  signToken(token) {
    return this.computeSignature(token);
  }

  /**
   * Verify token authenticity and evaluate all caveats deterministically against context
   * @param {Object} token - Capability token to verify
   * @param {Object} [context={}] - Verification context (e.g. { path, host, action, agentId, cost })
   * @returns {boolean} True if authentic, unexpired, and all caveats satisfy context
   */
  verifyToken(token, context = {}) {
    if (!token || !token.signature || !token.tokenId) {
      return false;
    }

    // 1. Expiration check
    if (token.expiresAt && Date.now() > token.expiresAt) {
      return false;
    }

    // 2. Cryptographic nested HMAC-SHA256 Macaroon chain verification
    const expectedSig = this.computeSignature(token);
    try {
      const sigBuf = Buffer.from(token.signature, 'hex');
      const expBuf = Buffer.from(expectedSig, 'hex');

      if (sigBuf.length !== expBuf.length) {
        return false;
      }

      const isMacaroonValid = crypto.timingSafeEqual(sigBuf, expBuf);
      if (!isMacaroonValid) {
        return false;
      }
    } catch {
      return false;
    }

    // 3. Deterministic Caveat Evaluation against execution context
    if (context && typeof context === 'object' && token.caveats) {
      for (const caveat of token.caveats) {
        if (!this.evaluateCaveat(caveat, context, token)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Static convenience verifier
   */
  static verify(token, context = {}, secret = 'SOVEREIGN_CAPABILITY_SIGNING_KEY_DIRECTIVE_01') {
    const factory = new CapabilityTokenFactory(secret);
    return factory.verify(token, context);
  }

  /**
   * Alias for verifyToken that supports Object, JSON string, or Base64 string
   */
  verify(token, context = {}) {
    let tokenObj = token;
    if (typeof token === 'string') {
      try {
        const trimmed = token.trim();
        if (trimmed.startsWith('{')) {
          tokenObj = JSON.parse(trimmed);
        } else {
          tokenObj = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
        }
      } catch {
        return false;
      }
    }
    return this.verifyToken(tokenObj, context);
  }

  /**
   * Evaluates a single first-party caveat deterministically
   * @param {string} caveat 
   * @param {Object} context 
   * @param {Object} token 
   * @returns {boolean}
   */
  evaluateCaveat(caveat, context, token) {
    const eqIdx = caveat.indexOf('=');
    if (eqIdx === -1) return true;

    const key = caveat.slice(0, eqIdx);
    const value = caveat.slice(eqIdx + 1);

    switch (key) {
      case 'agent':
        if (context.agentId && context.agentId !== value) return false;
        break;

      case 'expiresAt': {
        const exp = Number(value);
        if (!Number.isNaN(exp) && Date.now() > exp) return false;
        break;
      }

      case 'path':
      case 'pathPrefix': {
        if (context.path) {
          const normContext = path.resolve(context.path).toLowerCase().replace(/\\/g, '/');
          const normVal = path.resolve(value).toLowerCase().replace(/\\/g, '/');
          if (!normContext.startsWith(normVal)) return false;
        }
        break;
      }

      case 'allowedPaths': {
        if (context.path) {
          const normContext = path.resolve(context.path).toLowerCase().replace(/\\/g, '/');
          const allowed = value.split(',');
          if (!allowed.some(p => normContext.startsWith(path.resolve(p).toLowerCase().replace(/\\/g, '/')))) return false;
        }
        break;
      }

      case 'allowedDomains': {
        if (context.host) {
          const allowed = value.split(',');
          if (!allowed.includes(context.host)) return false;
        }
        break;
      }

      case 'maxCost': {
        const max = Number(value);
        if (context.cost !== undefined && context.cost > max) return false;
        break;
      }

      case 'scope': {
        if (context.scope) {
          const allowedScopes = value.split(',');
          if (!allowedScopes.includes(context.scope)) return false;
        }
        break;
      }

      case 'capabilities': {
        if (context.action) {
          const allowedCaps = value.split(',');
          if (!allowedCaps.includes(context.action)) return false;
        }
        break;
      }

      case 'command': {
        if (context.command && context.command !== value && !context.command.startsWith(value)) {
          return false;
        }
        break;
      }

      default:
        // Generic key match if present in context
        if (context[key] !== undefined && String(context[key]) !== value) {
          return false;
        }
    }

    return true;
  }
}
