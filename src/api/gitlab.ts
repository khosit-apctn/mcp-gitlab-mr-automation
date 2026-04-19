import { Gitlab } from '@gitbeaker/rest';
import { getGitProjectInfo } from '../utils/git.js';
import { execSync } from 'child_process';
import { extractTicketId, inferCommitType } from '../utils/branchParser.js';

export function getGitLabContext(cwd: string) {
  let baseUrl = process.env.GITLAB_URL;
  let projectPath = '';

  try {
    const gitInfo = getGitProjectInfo(cwd);
    if (!baseUrl) {
      baseUrl = gitInfo.baseUrl;
    }
    projectPath = gitInfo.projectPath;
  } catch (error: any) {
    // Strictly fail if both git remote failed (or isn't a repo) and no GITLAB_URL is set
    if (!baseUrl) {
      throw new Error('Please set GITLAB_URL environment variable or run in a valid git repository.');
    }
  }

  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error('Please set GITLAB_TOKEN environment variable.');
  }

  const client = new Gitlab({
    host: baseUrl,
    token: token,
  });

  return { client, projectPath };
}

export async function getFileContents(cwd: string, filePath: string, branch: string) {
  const { client, projectPath } = getGitLabContext(cwd);
  if (!projectPath) throw new Error('Could not determine project path from git repository. Ensure cwd is inside a git repo.');

  const file = await client.RepositoryFiles.show(projectPath, filePath, branch);
  const content = Buffer.from(file.content, 'base64').toString('utf8');
  return { path: filePath, branch, content };
}

export async function listRepositoryTree(cwd: string, path?: string, branch?: string, recursive: boolean = false) {
  const { client, projectPath } = getGitLabContext(cwd);
  if (!projectPath) throw new Error('Could not determine project path from git repository. Ensure cwd is inside a git repo.');

  const options: Record<string, any> = { perPage: 100 };
  if (path) options.path = path;
  if (branch) options.ref = branch;
  if (recursive) options.recursive = true;

  const tree = await client.Repositories.allRepositoryTrees(projectPath, options);
  return tree;
}

export async function createAutomatedMr(
  cwd: string,
  title: string,
  description: string,
  sourceBranch: string,
  targetBranch: string,
  assignee?: string,
  reviewer?: string,
  labels?: string,
  isDraft: boolean = true,
  shouldDeleteSourceBranch: boolean = true,
  shouldSquash: boolean = true
) {
  const { client, projectPath } = getGitLabContext(cwd);
  if (!projectPath) throw new Error('Could not determine project path from git repository.');

  let finalTitle = title;
  if (isDraft && !finalTitle.toLowerCase().startsWith('draft:')) {
    finalTitle = `Draft: ${finalTitle}`;
  }

  let finalDescription = description;
  if (assignee || reviewer || labels) {
    finalDescription += '\n\n';
    if (assignee) {
      const formattedAssignee = assignee.split(/\s+/).filter(a => a).map(a => a.startsWith('@') ? a : `@${a}`).join(' ');
      finalDescription += `/assign ${formattedAssignee}\n`;
    }
    if (reviewer) {
      const formattedReviewer = reviewer.split(/\s+/).filter(a => a).map(a => a.startsWith('@') ? a : `@${a}`).join(' ');
      finalDescription += `/assign_reviewer ${formattedReviewer}\n`;
    }
    if (labels) {
      finalDescription += `/label ${labels}\n`;
    }
  }

  try {
    const mr = await client.MergeRequests.create(
      projectPath,
      sourceBranch,
      targetBranch,
      finalTitle,
      {
        description: finalDescription,
        removeSourceBranch: shouldDeleteSourceBranch,
        squash: shouldSquash,
      }
    );
    return mr;
  } catch (error: any) {
    // Enhanced error message with more context
    const errorDetails = {
      message: error.message,
      projectPath,
      sourceBranch,
      targetBranch,
      cause: error.cause,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : undefined
    };

    console.error('[createAutomatedMr] Failed to create MR:', errorDetails);

    throw new Error(
      `Failed to create MR: ${error.message}\n` +
      `Project: ${projectPath}\n` +
      `Source: ${sourceBranch} -> Target: ${targetBranch}\n` +
      `Response: ${JSON.stringify(errorDetails.response || 'No response data')}`
    );
  }
}


export async function searchProjects(cwd: string, query: string) {
  const { client } = getGitLabContext(cwd);

  const projects = await client.Projects.all({ search: query, perPage: 100 });
  return projects;
}

export async function createBranch(cwd: string, branchName: string, ref?: string) {
  const { client, projectPath } = getGitLabContext(cwd);

  let targetRef = ref;
  if (!targetRef) {
    const project = await client.Projects.show(projectPath);
    targetRef = project.default_branch as string;
  }

  return await client.Branches.create(projectPath, branchName, targetRef);
}

export async function pushFiles(
  cwd: string,
  branch: string,
  commitMessage: string,
  actions: any[]
) {
  const { client, projectPath } = getGitLabContext(cwd);
  // Map our internal snake/camel cases to GitBeaker's exact structure if necessary
  const gitbeakerActions = actions.map(a => ({
    action: a.action,
    filePath: a.filePath,
    content: a.content,
    previousPath: a.previousPath
  }));

  return await client.Commits.create(
    projectPath,
    branch,
    commitMessage,
    gitbeakerActions
  );
}

export function gitPushLocal(cwd: string, remote: string = 'origin', branch?: string) {
  try {
    const command = branch ? `git push ${remote} ${branch}` : `git push ${remote}`;
    const output = execSync(command, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { output: output.trim() || 'Pushed successfully.' };
  } catch (error: any) {
    throw new Error(`Git push failed: ${error.message}\nOutput: ${error.stdout || error.stderr}`);
  }
}

export async function generateMrContent(cwd: string, targetBranch: string, sourceBranch?: string) {
  let actualSourceBranch = sourceBranch;
  if (!actualSourceBranch) {
    try {
      actualSourceBranch = execSync('git branch --show-current', { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch (e: any) {
      throw new Error(`Failed to get current branch: ${e.message}`);
    }
    if (!actualSourceBranch) {
      throw new Error('Could not determine current branch. Please specify source_branch.');
    }
  }

  const ticketId = extractTicketId(actualSourceBranch);
  const inferredType = inferCommitType(actualSourceBranch);

  // Exclude noise files
  const exclusions = [
    ':(exclude)package-lock.json',
    ':(exclude)yarn.lock',
    ':(exclude)pnpm-lock.yaml',
    ':(exclude)*.svg',
    ':(exclude)*.png',
    ':(exclude)*.min.js',
    ':(exclude)*.min.css',
    ':(exclude)dist/*',
    ':(exclude)build/*',
    ':(exclude)*.map',
    ':(exclude)coverage/*',
    ':(exclude).env*',
    ':(exclude).vscode/*',
    ':(exclude).idea/*'
  ];

  let rawDiff = '';
  try {
    const diffCmd = `git diff ${targetBranch}...${actualSourceBranch} -- . ${exclusions.map(ex => `"${ex}"`).join(' ')}`;
    rawDiff = execSync(diffCmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch (e: any) {
    throw new Error(`Failed to generate git diff: ${e.message}`);
  }

  let diffLines = rawDiff.split('\n');
  if (diffLines.length > 10000) {
    diffLines = diffLines.slice(0, 10000);
    diffLines.push('\n[Diff Truncated due to size limit]');
  }

  const diffStr = diffLines.join('\n');

  const prompt = `<system_instruction>
You are an expert Code Reviewer. Analyze the provided code diff and generate a Merge Request Title and Description using the exact Markdown format below. Do not deviate from this structure.

[Required Title Format]
{Inferred Type}: [{Ticket ID}] {A concise English summary of the changes}
*(Note: If Ticket ID is missing, omit the brackets)*

[Required Description Format]
### 📝 Overview
{Provide a high-level summary of what was achieved and why}

### 🛠 Key Changes
{Bullet points of the main technical changes based on the diff}

### 📦 Modules Affected
{List of files, components, or services modified}

### ⚠️ Impact / Risk Level
{Assess the risk as Low, Medium, or High, and briefly explain why based on the scope of changes}

### 🧪 How to Test (Suggestions)
{Provide 2-3 brief steps or areas to focus on during QA based on the diff}

---
✨ Generated by AI
</system_instruction>

<branch_context>
Source Branch: ${actualSourceBranch}
Extracted Ticket ID: ${ticketId}
Inferred Type: ${inferredType}
</branch_context>

<code_diff>
${diffStr}
</code_diff>`;

  return prompt;
}

