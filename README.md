# mcp-gitlab-mr-automation

A Model Context Protocol (MCP) server that provides automated mechanisms to interact with GitLab Merge Requests directly from your workflow.

## Tools
- `get_file_contents`: Fetch file content by path and branch
- `list_repository_tree`: List files/folders in the repository
- `create_automated_mr`: Create a new automated Merge Request
- `update_mr`: Update an existing Merge Request by its internal ID (iid)
- `search_projects`: Search for a project inside the GitLab instance
- `create_branch`: Create a new branch in the GitLab repository
- `push_files`: Create a commit with multiple file actions and push it to a branch via GitLab API
- `git_push_local`: Execute a literal git push command from the local machine
- `generate_mr_content`: Generate a title and description for a Merge Request based on commits between branches
- `get_mr_comments`: Fetch all comments (discussions) of a Merge Request, including inline comments with file path and line number

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
