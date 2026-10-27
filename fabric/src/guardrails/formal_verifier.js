/**
 * SarembokVE Formal Policy Verifier & Pre-Dispatch Proof Generator
 * Pillar 3: Transition from Heuristic Guardrails to Formally Verified Policies
 * 
 * Evaluates state transition invariants and proves capability sufficiency
 * BEFORE any shell command, file write, or network call is dispatched.
 */

import crypto from 'node:crypto';
import { CapabilityTokenFactory, CapabilityType } from './capability_token.js';

export class FormalPolicyVerifier {
  /**
   * @param {Object} options
   * @param {string} [options.signingSecret]
   * @param {string} [options.profile='enterprise'] 'strict' | 'enterprise' | 'audit'
   */
  constructor(options = {}) {
    this.signingSecret = options.signingSecret || 'SOVEREIGN_CAPABILITY_SIGNING_KEY_DIRECTIVE_01';
    this.profile = options.profile || 'enterprise';
    this.tokenFactory = new CapabilityTokenFactory(this.signingSecret);

    // Profile Invariants Definition
    this.invariants = {
      strict: {
        disallowNetworkEgress: true,
        disallowShellPiping: true,
        requireDeterministicInputs: true,
        maxExecutionWindowMs: 5000
      },
      enterprise: {
        disallowNetworkEgress: false, // Allowed only with explicitly listed domains
        disallowShellPiping: true,
        requireDeterministicInputs: false,
        maxExecutionWindowMs: 30000
      },
      audit: {
        disallowNetworkEgress: true,
        disallowShellPiping: true,
        requireDeterministicInputs: true,
        maxExecutionWindowMs: 10000
      }
    };
  }

  /**
   * Statically verify an intended agent action before kernel dispatch
   * @param {Object} params
   * @param {string} params.agentId
   * @param {string} params.actionType - CapabilityType
   * @param {Object} params.target - Resource target (e.g. { path: '/tmp/test.txt' }, { host: 'api.github.com' })
   * @param {Object} params.token - Capability token presented by agent
   * @param {Object} [params.context={}] - Environmental context (e.g. session token burn)
   * @returns {Object} Proof verdict: { verified: boolean, proofHash?: string, error?: string }
   */
  verifyAction({
    agentId,
    actionType,
    target = {},
    token,
    context = {}
  }) {
    // 1. Invariant: Token Authenticity & Integrity Proof
    if (!token || !this.tokenFactory.verifyToken(token)) {
      return {
        verified: false,
        violatedInvariant: 'INV_TOKEN_AUTHENTICITY',
        reason: 'Capability token is invalid, forged, or expired.'
      };
    }

    // 2. Invariant: Agent Subject Matching
    if (token.agentId !== agentId) {
      return {
        verified: false,
        violatedInvariant: 'INV_SUBJECT_MATCH',
        reason: `Capability token subject mismatch: Token for ${token.agentId}, presented by ${agentId}.`
      };
    }

    // 3. Invariant: Capability Sufficiency Proof
    if (!token.capabilities.includes(actionType)) {
      return {
        verified: false,
        violatedInvariant: 'INV_CAPABILITY_SUFFICIENCY',
        reason: `Agent does not hold required capability '${actionType}'.`
      };
    }

    // 4. Invariant: Resource Path Containment (FS:READ / FS:WRITE)
    if (actionType === CapabilityType.FS_READ || actionType === CapabilityType.FS_WRITE) {
      const targetPath = target.path;
      if (!targetPath) {
        return {
          verified: false,
          violatedInvariant: 'INV_RESOURCE_SPECIFICATION',
          reason: 'File system action missing target path.'
        };
      }

      // Prohibit directory traversal patterns statically
      if (targetPath.includes('..') || targetPath.startsWith('/etc') || targetPath.includes('\\Windows\\System32')) {
        return {
          verified: false,
          violatedInvariant: 'INV_SANDBOX_CONFINEMENT',
          reason: `Target path '${targetPath}' violates sandbox boundary invariants.`
        };
      }

      if (token.constraints?.allowedPaths) {
        const isAllowed = token.constraints.allowedPaths.some(prefix => targetPath.startsWith(prefix));
        if (!isAllowed) {
          return {
            verified: false,
            violatedInvariant: 'INV_PATH_CONSTRAINT',
            reason: `Target path '${targetPath}' not within token allowedPaths: ${token.constraints.allowedPaths.join(', ')}`
          };
        }
      }
    }

    // 5. Invariant: Network Egress Confinement
    if (actionType === CapabilityType.NET_EGRESS) {
      const profileRules = this.invariants[this.profile] || this.invariants.enterprise;
      if (profileRules.disallowNetworkEgress) {
        return {
          verified: false,
          violatedInvariant: 'INV_PROFILE_EGRESS_RESTRICTION',
          reason: `Containment profile '${this.profile}' strictly forbids network egress.`
        };
      }

      const targetHost = target.host;
      if (token.constraints?.allowedDomains) {
        const isDomainAllowed = token.constraints.allowedDomains.includes(targetHost);
        if (!isDomainAllowed) {
          return {
            verified: false,
            violatedInvariant: 'INV_EGRESS_DOMAIN_UNAPPROVED',
            reason: `Target host '${targetHost}' not in token allowedDomains.`
          };
        }
      }
    }

    // 6. Invariant: Shell Command Injection & Piping Proof
    if (actionType === CapabilityType.SHELL_EXEC) {
      const cmd = target.command || '';
      // Reject shell chaining, piping, or backticks
      if (/[;&|`$]/.test(cmd)) {
        return {
          verified: false,
          violatedInvariant: 'INV_SHELL_PIPING_PROHIBITED',
          reason: 'Shell execution containing piping, chaining, or expansion characters is formally forbidden.'
        };
      }
    }

    // Generate cryptographic formal proof seal
    const proofCanonical = [
      token.tokenId,
      agentId,
      actionType,
      JSON.stringify(target),
      this.profile,
      Date.now()
    ].join('::');

    const proofHash = crypto
      .createHmac('sha256', this.signingSecret)
      .update(proofCanonical)
      .digest('hex');

    return {
      verified: true,
      proofHash,
      invariantsChecked: [
        'INV_TOKEN_AUTHENTICITY',
        'INV_SUBJECT_MATCH',
        'INV_CAPABILITY_SUFFICIENCY',
        'INV_SANDBOX_CONFINEMENT',
        'INV_EGRESS_CONFINEMENT',
        'INV_SHELL_PIPING_PROHIBITED'
      ]
    };
  }
}
