/**
 * Shared test utilities for accessing MCP server internals.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface RegisteredTool {
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<unknown>;
}

interface RegisteredPrompt {
  callback: (args: Record<string, string>, extra: unknown) => Promise<unknown>;
}

interface RegisteredResource {
  name: string;
  readCallback: (uri: URL) => Promise<unknown>;
}

interface RegisteredResourceTemplate {
  readCallback: (uri: URL, params: Record<string, string>) => Promise<unknown>;
}

type ServerInternals = {
  _registeredTools: Record<string, RegisteredTool>;
  _registeredPrompts: Record<string, RegisteredPrompt>;
  _registeredResources: Record<string, RegisteredResource>;
  _registeredResourceTemplates: Record<string, RegisteredResourceTemplate>;
};

function internals(server: McpServer): ServerInternals {
  return server as unknown as ServerInternals;
}

export async function callTool(server: McpServer, toolName: string, args: Record<string, unknown> = {}) {
  const tool = internals(server)._registeredTools[toolName];
  if (!tool) throw new Error(`Tool ${toolName} not registered`);
  return tool.handler(args, {});
}

export async function callPrompt(server: McpServer, promptName: string, args: Record<string, string> = {}) {
  const prompt = internals(server)._registeredPrompts[promptName];
  if (!prompt) throw new Error(`Prompt ${promptName} not registered`);
  return prompt.callback(args, {});
}

export async function readResource(server: McpServer, uri: string) {
  const resource = internals(server)._registeredResources[uri];
  if (!resource) throw new Error(`Resource ${uri} not registered`);
  return resource.readCallback(new URL(uri));
}

export async function readResourceTemplate(server: McpServer, name: string, uri: string, params: Record<string, string>) {
  const template = internals(server)._registeredResourceTemplates[name];
  if (!template) throw new Error(`Resource template ${name} not registered`);
  return template.readCallback(new URL(uri), params);
}

export function hasRegisteredTool(server: McpServer, name: string): boolean {
  return name in internals(server)._registeredTools;
}

export function getRegisteredToolNames(server: McpServer): string[] {
  return Object.keys(internals(server)._registeredTools);
}

export function hasRegisteredResource(server: McpServer, uri: string): boolean {
  return uri in internals(server)._registeredResources;
}

export function hasRegisteredResourceTemplate(server: McpServer, name: string): boolean {
  return name in internals(server)._registeredResourceTemplates;
}

export function hasRegisteredPrompt(server: McpServer, name: string): boolean {
  return name in internals(server)._registeredPrompts;
}
