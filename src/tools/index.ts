import { z } from 'zod';
import {
    getFileContents,
    listRepositoryTree,
    createAutomatedMr,
    searchProjects,
    createBranch,
    pushFiles,
    gitPushLocal,
    generateMrContent
} from '../api/gitlab.js';
import { loadConfig } from '../utils/config.js';

export const TOOLS = {
    get_file_contents: {
        name: 'get_file_contents',
        description: 'Fetch file content by path and branch',
        schema: z.object({
            cwd: z.string().describe('The current working directory of the project'),
            path: z.string().describe('The file path within the repository'),
            branch: z.string().describe('The branch or ref to fetch the file from')
        }),
        handler: async (args: any) => {
            const data = await getFileContents(args.cwd, args.path, args.branch);
            return {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
            };
        }
    },

    list_repository_tree: {
        name: 'list_repository_tree',
        description: 'List files/folders in the repository',
        schema: z.object({
            cwd: z.string().describe('The current working directory of the project'),
            path: z.string().optional().describe('The path inside the repository. Used to get content of subdirectories'),
            branch: z.string().optional().describe('The name of a repository branch or tag or if not given the default branch'),
            recursive: z.boolean().optional().describe('Boolean value used to get a recursive tree (false by default)')
        }),
        handler: async (args: any) => {
            const data = await listRepositoryTree(args.cwd, args.path, args.branch, args.recursive);
            return {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
            };
        }
    },

    create_automated_mr: {
        name: 'create_automated_mr',
        description: 'Create a new automated Merge Request',
        schema: z.object({
            cwd: z.string().describe('The current working directory of the project'),
            title: z.string().describe('The title of the merge request'),
            description: z.string().describe('The description of the merge request'),
            source_branch: z.string().describe('The source branch'),
            target_branch: z.string().describe('The target branch'),
            assignee: z.string().optional().describe('Assignee username starting with @ (e.g. @janedoe)'),
            reviewer: z.string().optional().describe('Reviewer username starting with @ (e.g. @johndoe)'),
            labels: z.string().optional().describe('Labels for the MR (e.g. ~"3.9.0" ~CPAD)'),
            isDraft: z.boolean().optional().describe('Whether to prefix the MR title with Draft: (defaults to true)'),
            shouldDeleteSourceBranch: z.boolean().optional().describe('Whether to delete the source branch when merged (defaults to true)'),
            shouldSquash: z.boolean().optional().describe('Whether to squash commits when merged (defaults to true)')
        }),
        handler: async (args: any) => {
            const config = loadConfig();

            const assignee = args.assignee !== undefined ? args.assignee : config.default_assignee;
            const reviewer = args.reviewer !== undefined ? args.reviewer : config.default_reviewer;
            const labels = args.labels !== undefined ? args.labels : config.default_labels;

            const isDraft = args.isDraft !== undefined
                ? args.isDraft
                : (config.is_draft !== undefined ? config.is_draft : true);

            const shouldDeleteSourceBranch = args.shouldDeleteSourceBranch !== undefined
                ? args.shouldDeleteSourceBranch
                : (config.should_delete_source_branch !== undefined ? config.should_delete_source_branch : true);

            const shouldSquash = args.shouldSquash !== undefined
                ? args.shouldSquash
                : (config.should_squash !== undefined ? config.should_squash : true);

            const data = await createAutomatedMr(
                args.cwd,
                args.title,
                args.description,
                args.source_branch,
                args.target_branch,
                assignee,
                reviewer,
                labels,
                isDraft,
                shouldDeleteSourceBranch,
                shouldSquash
            );
            return {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
            };
        }
    },


    search_projects: {
        name: 'search_projects',
        description: 'Search within the GitLab instance',
        schema: z.object({
            cwd: z.string().describe('The current working directory of the project, used to resolve gitlab instance configuration'),
            query: z.string().describe('The search query')
        }),
        handler: async (args: any) => {
            const data = await searchProjects(args.cwd, args.query);
            return {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
            };
        }
    },

    create_branch: {
        name: 'create_branch',
        description: 'Create a new branch in the GitLab repository',
        schema: z.object({
            cwd: z.string().describe('The current working directory of the project'),
            branchName: z.string().describe('The name of the new branch to create'),
            ref: z.string().optional().describe('The base branch to branch off of (defaults to project default branch)')
        }),
        handler: async (args: any) => {
            const data = await createBranch(args.cwd, args.branchName, args.ref);
            return {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
            };
        }
    },

    push_files: {
        name: 'push_files',
        description: 'Creates a commit with multiple file actions and pushes it to a specific branch via GitLab API',
        schema: z.object({
            cwd: z.string().describe('The current working directory of the project'),
            branch: z.string().describe('The branch to commit to'),
            commitMessage: z.string().describe('The commit message'),
            actions: z.array(z.object({
                action: z.enum(['create', 'update', 'delete', 'move']),
                filePath: z.string().describe('The file path (e.g. src/file.txt)'),
                content: z.string().optional().describe('The file content. Required for create and update actions.'),
                previousPath: z.string().optional().describe('The original file path. Required for move action.')
            })).describe('Array of commit actions')
        }),
        handler: async (args: any) => {
            const data = await pushFiles(args.cwd, args.branch, args.commitMessage, args.actions);
            return {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
            };
        }
    },

    git_push_local: {
        name: 'git_push_local',
        description: 'Executes a literal git push command from the local machine',
        schema: z.object({
            cwd: z.string().describe('The directory to execute the command'),
            remote: z.string().optional().describe('The remote to push to, defaults to "origin"'),
            branch: z.string().optional().describe('The branch to push')
        }),
        handler: async (args: any) => {
            const data = gitPushLocal(args.cwd, args.remote, args.branch);
            return {
                content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
            };
        }
    },

    generate_mr_content: {
        name: 'generate_mr_content',
        description: 'Generates a title and description for a Merge Request based on commits between branches',
        schema: z.object({
            cwd: z.string().describe('The current working directory of the project'),
            target_branch: z.string().describe('The target branch to merge into'),
            source_branch: z.string().optional().describe('The source branch. Defaults to current branch if not provided.')
        }),
        handler: async (args: any) => {
            const data = await generateMrContent(args.cwd, args.target_branch, args.source_branch);
            return {
                content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }]
            };
        }
    }
};
