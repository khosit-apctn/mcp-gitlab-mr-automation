import { Gitlab } from '@gitbeaker/rest';
import { getGitProjectInfo } from '../utils/git.js';
import { execSync } from 'child_process';

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
      const formattedAssignee = assignee.includes('@') ? assignee : `@${assignee}`;
      finalDescription += `/assign ${formattedAssignee}\n`;
    }
    if (reviewer) {
      const formattedReviewer = reviewer.includes('@') ? reviewer : `@${reviewer}`;
      finalDescription += `/assign_reviewer ${formattedReviewer}\n`;
    }
    if (labels) {
      finalDescription += `/label ${labels}\n`;
    }
  }

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
}

export async function getMrDetails(cwd: string, mrIid: number) {
  const { client, projectPath } = getGitLabContext(cwd);
  if (!projectPath) throw new Error('Could not determine project path from git repository.');

  const mr = await client.MergeRequests.show(projectPath, mrIid);
  const changes = await client.MergeRequests.showChanges(projectPath, mrIid);

  return { mr, changes };
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

