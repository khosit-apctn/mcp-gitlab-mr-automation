import { execSync } from 'child_process';

export interface GitProjectInfo {
  baseUrl: string;
  projectPath: string;
}

/**
 * Extracts GitLab URL and Project path from the `cwd`'s git origin remote.
 * Supports both HTTPS and SSH URLs.
 */
export function getGitProjectInfo(cwd: string): GitProjectInfo {
  try {
    const output = execSync('git remote get-url origin', { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();

    // Example outputs:
    // SSH: git@gitlab.com:group/repo.git
    // HTTPS: https://gitlab.com/group/repo.git
    
    let baseUrl = '';
    let projectPath = '';
    
    if (output.startsWith('http://') || output.startsWith('https://')) {
      const url = new URL(output);
      baseUrl = `${url.protocol}//${url.host}`;
      projectPath = url.pathname.replace(/^\//, '').replace(/\.git$/, '');
    } else if (output.startsWith('git@') || output.includes('git@')) {
      // ssh format typically git@host:path/to/repo.git
      // it could also be ssh://git@host/path/to/repo.git
      if (output.startsWith('ssh://')) {
        const urlParams = output.substring(6); // git@host/path..
        const parts = urlParams.split('/');
        const hostPart = parts[0].split('@').pop() || '';
        baseUrl = `https://${hostPart}`;
        projectPath = parts.slice(1).join('/').replace(/\.git$/, '');
      } else {
        const match = output.match(/.*@([^:]+):(.*)\.git$/) || output.match(/.*@([^:]+):(.*)$/);
        if (match) {
          baseUrl = `https://${match[1]}`;
          projectPath = match[2];
        } else {
          throw new Error(`Failed to parse SSH origin URL: ${output}`);
        }
      }
    } else {
      throw new Error(`Unsupported git remote URL format: ${output}`);
    }

    return { baseUrl, projectPath };
  } catch (error: any) {
    throw new Error(`Failed to extract git project info from cwd "${cwd}". Are you sure it's a valid git repository? ${error.message}`);
  }
}
