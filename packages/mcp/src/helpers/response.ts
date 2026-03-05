/**
 * Response helpers — serialize domain results to MCP tool result format.
 *
 * Returns plain objects matching the SDK's expected CallToolResult shape
 * (with index signature compatibility).
 */

export function toCallToolResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function toErrorResult(error: {
  message: string;
  code?: string;
  remediation?: string;
  retryable?: boolean;
}) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(error, null, 2) }],
    isError: true as const,
  };
}
