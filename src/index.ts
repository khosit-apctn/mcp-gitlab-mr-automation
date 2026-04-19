#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS } from "./tools/index.js";

class GitLabMRServer {
  private server: McpServer;

  constructor() {
    this.server = new McpServer({
      name: "mcp-gitlab-mr-automation",
      version: "1.0.0",
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    Object.values(TOOLS).forEach((tool: any) => {
      this.server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.schema.shape,
        },
        async (args: any) => {
          try {
            return await tool.handler(args);
          } catch (error: any) {
            // Enhanced error logging and response
            console.error(`[ERROR] Tool ${tool.name} failed:`, error);

            let errorMessage = `Error executing ${tool.name}: ${error.message}`;

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
        }
      );
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
