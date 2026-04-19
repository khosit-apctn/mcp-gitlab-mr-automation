#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS } from "./tools/index.js";
import { zodToJsonSchema } from 'zod-to-json-schema';

class GitLabMRServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: "mcp-gitlab-mr-automation",
      version: "1.0.0",
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Object.values(TOOLS).map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(tool.schema as any)
        }))
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const tool = Object.values(TOOLS).find(t => t.name === toolName);

      if (!tool) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${toolName}`
        );
      }

      try {
        const parsedArgs = tool.schema.parse(request.params.arguments);
        return await tool.handler(parsedArgs);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments for tool ${toolName}: ${error.message}`
          );
        }

        // Enhanced error logging and response
        console.error(`[ERROR] Tool ${toolName} failed:`, error);

        let errorMessage = `Error executing ${toolName}: ${error.message}`;

        // Include additional error details if available
        if (error.cause) {
          errorMessage += `\nCause: ${JSON.stringify(error.cause)}`;
        }
        if (error.response) {
          errorMessage += `\nHTTP Response: ${JSON.stringify({
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          })}`;
        }
        if (error.description) {
          errorMessage += `\nDescription: ${error.description}`;
        }
        if (error.stack) {
          errorMessage += `\nStack: ${error.stack}`;
        }

        return {
          content: [{
            type: "text",
            text: errorMessage
          }],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new GitLabMRServer();
server.run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
