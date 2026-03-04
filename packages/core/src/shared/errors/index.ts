/**
 * Structured error types for the ido4 domain layer.
 *
 * Every error carries context (what happened, why) and remediation (what to do next).
 * MCP layer maps these to JSON-RPC error responses.
 */

export class Ido4Error extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;
  readonly remediation?: string;
  readonly retryable: boolean;

  constructor(options: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
    remediation?: string;
    retryable?: boolean;
    cause?: Error;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'Ido4Error';
    this.code = options.code;
    this.context = options.context ?? {};
    this.remediation = options.remediation;
    this.retryable = options.retryable ?? false;
  }
}

export class ValidationError extends Ido4Error {
  constructor(options: {
    message: string;
    context?: Record<string, unknown>;
    remediation?: string;
  }) {
    super({ ...options, code: 'VALIDATION_ERROR', retryable: false });
    this.name = 'ValidationError';
  }
}

export class BusinessRuleError extends Ido4Error {
  constructor(options: {
    message: string;
    rule: string;
    context?: Record<string, unknown>;
    remediation?: string;
  }) {
    super({
      ...options,
      code: 'BUSINESS_RULE_VIOLATION',
      context: { ...options.context, rule: options.rule },
      retryable: false,
    });
    this.name = 'BusinessRuleError';
  }
}

export class GitHubAPIError extends Ido4Error {
  readonly statusCode?: number;

  constructor(options: {
    message: string;
    statusCode?: number;
    context?: Record<string, unknown>;
    remediation?: string;
    retryable?: boolean;
    cause?: Error;
  }) {
    super({
      ...options,
      code: 'GITHUB_API_ERROR',
      retryable: options.retryable ?? (options.statusCode ? options.statusCode >= 500 : false),
    });
    this.name = 'GitHubAPIError';
    this.statusCode = options.statusCode;
  }
}

export class RateLimitError extends GitHubAPIError {
  readonly resetAt: Date;

  constructor(options: {
    message: string;
    resetAt: Date;
    context?: Record<string, unknown>;
  }) {
    super({
      ...options,
      statusCode: 429,
      retryable: true,
      remediation: `Rate limited. Resets at ${options.resetAt.toISOString()}.`,
    });
    this.name = 'RateLimitError';
    this.resetAt = options.resetAt;
  }
}

export class ConfigurationError extends Ido4Error {
  constructor(options: {
    message: string;
    configFile?: string;
    context?: Record<string, unknown>;
    remediation?: string;
  }) {
    super({
      ...options,
      code: 'CONFIGURATION_ERROR',
      context: { ...options.context, configFile: options.configFile },
      retryable: false,
    });
    this.name = 'ConfigurationError';
  }
}

export class NotFoundError extends Ido4Error {
  constructor(options: {
    message: string;
    resource: string;
    identifier: string | number;
    remediation?: string;
  }) {
    super({
      ...options,
      code: 'NOT_FOUND',
      context: { resource: options.resource, identifier: options.identifier },
      retryable: false,
    });
    this.name = 'NotFoundError';
  }
}
