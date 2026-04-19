/**
 * Extracts a Ticket ID from a given branch name.
 * Looks for common patterns like "CPAD-1234", "PROJ-12", etc.
 * 
 * @param branchName The branch name to parse (e.g. feature/CPAD-123-new-login)
 * @returns The extracted ticket ID, or 'None' if not found
 */
export function extractTicketId(branchName: string): string {
    const ticketRegex = /([A-Za-z]+-\d+)/;
    const match = branchName.match(ticketRegex);
    return match ? match[1].toUpperCase() : 'None';
}

/**
 * Infers the Conventional Commit type based on the branch prefix.
 * 
 * @param branchName The branch name to parse (e.g. feature/CPAD-123-new-login)
 * @returns The inferred type (e.g. 'feat', 'fix', etc.), or 'None' if not found
 */
export function inferCommitType(branchName: string): string {
    const branchLower = branchName.toLowerCase();
    
    // Prefix mapping to conventional commit type
    const mappings: Record<string, string> = {
        'feature/': 'feat',
        'feat/': 'feat',
        'bugfix/': 'fix',
        'bug/': 'fix',
        'fix/': 'fix',
        'hotfix/': 'fix',
        'chore/': 'chore',
        'docs/': 'docs',
        'refactor/': 'refactor',
        'test/': 'test',
        'style/': 'style',
        'perf/': 'perf',
        'ci/': 'ci'
    };

    for (const [prefix, type] of Object.entries(mappings)) {
        if (branchLower.startsWith(prefix) || branchLower.includes(`-${prefix.slice(0, -1)}-`) || branchLower.includes(`_${prefix.slice(0, -1)}_`)) {
            // Primarily check startsWith. If it starts with the prefix:
            if (branchLower.startsWith(prefix)) {
                return type;
            }
            // Some people might do user-login-feature or similar, but the exact requirement usually focuses on prefix.
            // Let's stick strictly to startsWith for now to avoid false positives (e.g., ticket PROJ-123-fix-typo -> 'fix' instead of whatever).
        }
    }

    // fallback for simpler prefixes like 'feat-xxx' without slash
    const noSlashMappings: Record<string, string> = {
        'feature-': 'feat',
        'feat-': 'feat',
        'bugfix-': 'fix',
        'bug-': 'fix',
        'fix-': 'fix',
        'hotfix-': 'fix',
        'chore-': 'chore',
        'docs-': 'docs',
        'refactor-': 'refactor',
        'test-': 'test',
        'style-': 'style',
        'perf-': 'perf',
        'ci-': 'ci'
    };

    for (const [prefix, type] of Object.entries(noSlashMappings)) {
        if (branchLower.startsWith(prefix)) {
            return type;
        }
    }

    return 'None';
}
