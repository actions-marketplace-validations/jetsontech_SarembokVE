/**
 * SarembokVE / NVIDIA OpenShell Integration - Secret Zero Injection Gateway
 * 
 * Ensures target API keys, tokens, and corporate passwords are NEVER exposed
 * to the LLM context or agent memory.
 * 
 * Intercepts outbound requests/tool calls, substitutes real credentials outside
 * the LLM process boundary, and scrubs credentials from returned responses/logs.
 */

export class SecretZeroGateway {
  constructor(options = {}) {
    this.placeholderPrefix = options.placeholderPrefix || '{{SECRET:';
    this.placeholderSuffix = options.placeholderSuffix || '}}';
    this.redactedReplacement = '[SECRET_REDACTED_BY_OPENSHELL]';
    this.secrets = new Map();

    // Auto-discover existing secret environment variables
    this.bootstrapFromEnvironment();
  }

  /**
   * Bootstraps secrets matching common token patterns from environment
   */
  bootstrapFromEnvironment() {
    const sensitiveKeyPatterns = [
      /TOKEN/i, /KEY/i, /SECRET/i, /PASSWORD/i, /AUTH/i, /CREDENTIAL/i
    ];

    for (const [key, val] of Object.entries(process.env)) {
      if (!val || val.length < 8) continue;
      if (sensitiveKeyPatterns.some(p => p.test(key))) {
        this.registerSecret(key, val);
      }
    }
  }

  /**
   * Register a sensitive secret value outside the agent process boundary
   * @param {string} name
   * @param {string} value
   */
  registerSecret(name, value) {
    if (!name || !value) return;
    this.secrets.set(name.trim(), String(value).trim());
  }

  /**
   * Unregister a secret
   * @param {string} name
   */
  unregisterSecret(name) {
    return this.secrets.delete(name.trim());
  }

  /**
   * Get placeholder tag for an agent to use
   * @param {string} name
   */
  getPlaceholder(name) {
    return `${this.placeholderPrefix}${name}${this.placeholderSuffix}`;
  }

  /**
   * List registered secret keys (never returns values)
   * @returns {string[]}
   */
  listKeys() {
    return Array.from(this.secrets.keys());
  }

  /**
   * Intercepts outbound payload or command string and substitutes actual credentials
   * right before execution at the network or process boundary.
   * @param {string|Object} target
   * @returns {string|Object}
   */
  inject(target) {
    if (typeof target === 'string') {
      let result = target;
      for (const [key, value] of this.secrets.entries()) {
        const placeholder = `${this.placeholderPrefix}${key}${this.placeholderSuffix}`;
        const altPlaceholder = `$SECRET_${key}`;
        result = result.replaceAll(placeholder, value).replaceAll(altPlaceholder, value);
      }
      return result;
    }

    if (target && typeof target === 'object') {
      const cloned = Array.isArray(target) ? [...target] : { ...target };
      for (const k of Object.keys(cloned)) {
        if (typeof cloned[k] === 'string') {
          cloned[k] = this.inject(cloned[k]);
        } else if (typeof cloned[k] === 'object' && cloned[k] !== null) {
          cloned[k] = this.inject(cloned[k]);
        }
      }
      return cloned;
    }

    return target;
  }

  /**
   * Scans returned response body, error messages, or stdout/stderr and redacts
   * any exposed secrets before returning the payload to the agent LLM context.
   * @param {string|Object} payload
   * @returns {string|Object}
   */
  sanitize(payload) {
    if (typeof payload === 'string') {
      let result = payload;
      for (const [key, value] of this.secrets.entries()) {
        if (!value || value.length < 4) continue;
        result = result.replaceAll(value, `${this.redactedReplacement}:${key}`);
      }
      return result;
    }

    if (payload && typeof payload === 'object') {
      const cloned = Array.isArray(payload) ? [...payload] : { ...payload };
      for (const k of Object.keys(cloned)) {
        if (typeof cloned[k] === 'string') {
          cloned[k] = this.sanitize(cloned[k]);
        } else if (typeof cloned[k] === 'object' && cloned[k] !== null) {
          cloned[k] = this.sanitize(cloned[k]);
        }
      }
      return cloned;
    }

    return payload;
  }

  /**
   * Checks if an outbound message or prompt contains raw leaked secrets
   * @param {string} text
   * @returns {{ leaked: boolean, exposedKeys: string[] }}
   */
  inspectForLeaks(text) {
    if (!text || typeof text !== 'string') return { leaked: false, exposedKeys: [] };
    const exposed = [];
    for (const [key, value] of this.secrets.entries()) {
      if (value && value.length >= 8 && text.includes(value)) {
        exposed.push(key);
      }
    }
    return {
      leaked: exposed.length > 0,
      exposedKeys: exposed
    };
  }
}
