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
 * SarembokVE Agent-to-Agent (A2A) Federation Gateway
 * Pillar 2: Standardize Agent Interoperability Protocols
 * 
 * Implements an open, cryptographically-attested A2A messaging standard.
 * Enables Sarembok agent nodes to securely exchange subtasks, capability proofs,
 * and state synchronizations with external multi-agent systems and clusters.
 */

import crypto from 'node:crypto';

export class A2AGateway {
  /**
   * @param {Object} options
   * @param {string} options.clusterId
   * @param {string} options.sharedSecret
   */
  constructor(options = {}) {
    this.clusterId = options.clusterId || 'sarembok-cluster-prime';
    this.sharedSecret = options.sharedSecret || 'A2A_FEDERATION_SECRET_DEFAULT';
    this.registeredAgents = new Map();
  }

  /**
   * Register a local or remote agent node with its declared capabilities
   * @param {string} agentId 
   * @param {Object} metadata 
   */
  registerAgent(agentId, metadata = {}) {
    this.registeredAgents.set(agentId, {
      agentId,
      capabilities: metadata.capabilities || [],
      clusterId: metadata.clusterId || this.clusterId,
      endpoint: metadata.endpoint || 'internal',
      registeredAt: Date.now()
    });
  }

  /**
   * Pack an A2A message envelope and attach a cryptographic signature
   * @param {Object} params
   * @returns {Object} Signed A2A envelope
   */
  createEnvelope({
    sourceAgentId,
    targetAgentId,
    action,
    payload,
    capabilityProof = null
  }) {
    const envelope = {
      specVersion: '1.0.0-a2a',
      id: `a2a-${crypto.randomUUID()}`,
      clusterId: this.clusterId,
      sourceAgentId,
      targetAgentId,
      action,
      payload,
      capabilityProof,
      timestamp: Date.now()
    };

    envelope.signature = this.signEnvelope(envelope);
    return envelope;
  }

  /**
   * Compute HMAC SHA-256 signature for envelope tamper-evidence
   * @param {Object} envelope 
   */
  signEnvelope(envelope) {
    const canonicalString = [
      envelope.specVersion,
      envelope.id,
      envelope.clusterId,
      envelope.sourceAgentId,
      envelope.targetAgentId,
      envelope.action,
      JSON.stringify(envelope.payload),
      envelope.timestamp
    ].join('::');

    return crypto
      .createHmac('sha256', this.sharedSecret)
      .update(canonicalString)
      .digest('hex');
  }

  /**
   * Verify an incoming A2A envelope's cryptographic signature
   * @param {Object} envelope 
   * @returns {boolean} True if authentic and untampered
   */
  verifyEnvelope(envelope) {
    if (!envelope || !envelope.signature) return false;

    const expectedSig = this.signEnvelope(envelope);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(envelope.signature, 'hex'),
        Buffer.from(expectedSig, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Route an A2A envelope to destination agent
   * @param {Object} envelope 
   * @param {Function} [localDispatcher] 
   */
  async routeEnvelope(envelope, localDispatcher) {
    if (!this.verifyEnvelope(envelope)) {
      throw new Error(`[A2AGateway] Signature verification failed for envelope ${envelope?.id}`);
    }

    const target = this.registeredAgents.get(envelope.targetAgentId);
    if (!target) {
      throw new Error(`[A2AGateway] Unknown target agent: ${envelope.targetAgentId}`);
    }

    if (target.endpoint === 'internal' && typeof localDispatcher === 'function') {
      return await localDispatcher(envelope);
    }

    return {
      status: 'FORWARDED',
      targetEndpoint: target.endpoint,
      envelopeId: envelope.id
    };
  }
}
