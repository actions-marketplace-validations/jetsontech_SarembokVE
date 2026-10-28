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
 * SarembokVE Centralized Cloud-Native API Schema Registry
 * Pillar 4: Scale the CI/CD Contract Layer into a Distributed API Registry
 * 
 * Provides:
 * - Versioned schema storage for distributed microservices
 * - Real-time breaking change / drift detection
 * - Continuous webhook & wire-level schema ingestion
 */

import { EventEmitter } from 'node:events';

export class SchemaRegistry extends EventEmitter {
  constructor() {
    super();
    // Map<serviceName, Array<{ version: string, schema: Object, registeredAt: number, source: string }>>
    this.services = new Map();
  }

  /**
   * Register or update a service API schema
   * @param {string} serviceName 
   * @param {Object} schema - OpenAPI 3.1 or JSON Schema contract
   * @param {Object} [metadata={}]
   */
  registerSchema(serviceName, schema, metadata = {}) {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, []);
    }

    const versions = this.services.get(serviceName);
    const versionNumber = metadata.version || `v${versions.length + 1}.0.0`;

    // Check drift against previous baseline version
    let drift = null;
    if (versions.length > 0) {
      const baseline = versions[versions.length - 1].schema;
      drift = this.diffSchemas(baseline, schema);
    }

    const record = {
      serviceName,
      version: versionNumber,
      schema,
      drift,
      source: metadata.source || 'ebpf_stream',
      registeredAt: Date.now()
    };

    versions.push(record);

    this.emit('schemaRegistered', record);

    if (drift && drift.isBreaking) {
      this.emit('breakingChangeDetected', {
        serviceName,
        version: versionNumber,
        breakingChanges: drift.breakingChanges
      });
    }

    return record;
  }

  /**
   * Retrieve latest schema for a service
   * @param {string} serviceName 
   */
  getLatestSchema(serviceName) {
    const versions = this.services.get(serviceName);
    if (!versions || versions.length === 0) return null;
    return versions[versions.length - 1];
  }

  /**
   * Compare two API schemas and identify breaking changes vs additive changes
   * @param {Object} oldSchema 
   * @param {Object} newSchema 
   */
  diffSchemas(oldSchema, newSchema) {
    const breakingChanges = [];
    const additiveChanges = [];

    const oldPaths = oldSchema.paths || {};
    const newPaths = newSchema.paths || {};

    // 1. Check for removed endpoints (Breaking)
    for (const [pathStr, oldMethods] of Object.entries(oldPaths)) {
      if (!newPaths[pathStr]) {
        breakingChanges.push(`Endpoint removed: ${pathStr}`);
        continue;
      }

      const newMethods = newPaths[pathStr];
      for (const [method, oldOp] of Object.entries(oldMethods)) {
        if (!newMethods[method]) {
          breakingChanges.push(`HTTP method '${method.toUpperCase()}' removed from ${pathStr}`);
          continue;
        }

        // Compare response schemas
        const oldResponses = oldOp.responses || {};
        const newResponses = newMethods[method].responses || {};

        for (const statusCode of Object.keys(oldResponses)) {
          if (!newResponses[statusCode]) {
            breakingChanges.push(`Response status '${statusCode}' removed from ${method.toUpperCase()} ${pathStr}`);
          }
        }
      }
    }

    // 2. Check for added endpoints (Additive)
    for (const [pathStr, newMethods] of Object.entries(newPaths)) {
      if (!oldPaths[pathStr]) {
        additiveChanges.push(`New endpoint discovered: ${pathStr}`);
      }
    }

    return {
      isBreaking: breakingChanges.length > 0,
      breakingChanges,
      additiveChanges,
      isIdentical: breakingChanges.length === 0 && additiveChanges.length === 0
    };
  }

  /**
   * List all registered services and their current versions
   */
  listServices() {
    const summary = [];
    for (const [name, versions] of this.services.entries()) {
      const latest = versions[versions.length - 1];
      summary.push({
        serviceName: name,
        versionCount: versions.length,
        currentVersion: latest.version,
        lastUpdated: new Date(latest.registeredAt).toISOString(),
        hasBreakingDrift: latest.drift?.isBreaking || false
      });
    }
    return summary;
  }
}
