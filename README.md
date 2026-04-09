# mcp-gitlab-mr-automation

A Model Context Protocol (MCP) server that provides automated mechanisms to interact with GitLab Merge Requests directly from your workflow.

## Tools
- `get_file_contents`: Fetch file content by path and branch
- `list_repository_tree`: List files/folders in the repository
- `create_automated_mr`: Create an automated MR (uses quick actions to assign/review)
- `get_mr_details`: Fetch detail text and diffs for a given MR IID
- `search_projects`: Search for a project inside the GitLab instance

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the project:
   ```bash
   npm run build
   ```

## Configuration (Claude Desktop)

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gitlab-mr-automation": {
      "command": "node",
      "args": ["c:/Users/s99989/Develop/mcp-hub/mcp-gitlab-mr-automation/dist/index.js"],
      "env": {
        "GITLAB_TOKEN": "glpat-xxxxxxxxxxxxxx",
        "GITLAB_URL": "https://gitdop.se.scb.co.th"
      }
    }
  }
}
```

*Note: `GITLAB_URL` is optional if your commands always execute within a valid GitLab git repository, as the Server will parse your git origin configuration. `GITLAB_TOKEN` is strictly required.*
