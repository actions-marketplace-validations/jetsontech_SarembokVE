/**
 * SarembokVE eBPF Wire-Level API Telemetry & Continuous Schema Observer
 * Pillar 4: Scale the CI/CD Contract Layer into a Distributed API Registry
 * 
 * Simulates / interfaces with kernel-level eBPF socket tracing (e.g. sockops/tc)
 * to continuously observe HTTP/REST and gRPC microservice traffic, extracting live
 * schemas without launching resource-heavy headless browsers.
 */

import { EventEmitter } from 'node:events';

export class EbpfTrafficTracer extends EventEmitter {
  /**
   * @param {Object} options
   * @param {import('./schema_registry.js').SchemaRegistry} options.registry
   * @param {string} [options.serviceName='core-microservice']
   */
  constructor(options = {}) {
    super();
    this.registry = options.registry;
    this.serviceName = options.serviceName || 'core-microservice';
    this.observedEndpoints = new Map(); // path -> { methods: Set, responses: Set }
    this.isTracing = false;
  }

  /**
   * Start passive network wire capture
   */
  startTrace() {
    this.isTracing = true;
    this.emit('traceStarted', { serviceName: this.serviceName, timestamp: Date.now() });
  }

  /**
   * Stop passive network wire capture
   */
  stopTrace() {
    this.isTracing = false;
    this.emit('traceStopped', { serviceName: this.serviceName, timestamp: Date.now() });
  }

  /**
   * Ingest a raw socket or wire-level HTTP packet event (emulated or real eBPF stream)
   * @param {Object} packet
   * @param {string} packet.method - GET, POST, PUT, DELETE
   * @param {string} packet.url - e.g. /api/v1/users
   * @param {number} packet.statusCode - 200, 201, 400, etc.
   * @param {Object} [packet.requestBody]
   * @param {Object} [packet.responseBody]
   */
  ingestWirePacket({ method, url, statusCode, requestBody, responseBody }) {
    if (!this.isTracing) return;

    // Normalize URL to path pattern (e.g. /api/v1/users/123 -> /api/v1/users/{id})
    const normalizedPath = url.replace(/\/\d+/g, '/{id}');
    const normalizedMethod = method.toLowerCase();

    if (!this.observedEndpoints.has(normalizedPath)) {
      this.observedEndpoints.set(normalizedPath, new Map());
    }

    const pathMethods = this.observedEndpoints.get(normalizedPath);
    if (!pathMethods.has(normalizedMethod)) {
      pathMethods.set(normalizedMethod, {
        responses: new Set(),
        parameters: []
      });
    }

    const opData = pathMethods.get(normalizedMethod);
    opData.responses.add(String(statusCode));

    this.emit('packetIngested', { path: normalizedPath, method: normalizedMethod, statusCode });
  }

  /**
   * Synthesize an OpenAPI 3.1 schema document from continuously traced traffic
   * and publish it directly to the SchemaRegistry
   * @returns {Object} Generated OpenAPI 3.1 specification
   */
  publishDiscoveredContract(version = '1.0.0-ebpf') {
    const paths = {};

    for (const [pathStr, methodsMap] of this.observedEndpoints.entries()) {
      paths[pathStr] = {};
      for (const [method, data] of methodsMap.entries()) {
        const responses = {};
        for (const code of data.responses) {
          responses[code] = {
            description: `Auto-discovered via eBPF stream (Status ${code})`
          };
        }

        paths[pathStr][method] = {
          summary: `Auto-generated eBPF endpoint: ${method.toUpperCase()} ${pathStr}`,
          responses
        };
      }
    }

    const schema = {
      openapi: '3.1.0',
      info: {
        title: `${this.serviceName} Traced Contract`,
        version,
        description: 'Continuously generated from live network wire tracing via eBPF tap.'
      },
      paths
    };

    if (this.registry) {
      this.registry.registerSchema(this.serviceName, schema, {
        source: 'ebpf_kernel_probe',
        version
      });
    }

    return schema;
  }
}
