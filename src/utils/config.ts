import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
// Since this file ends up in dist/utils/config.js, the root is two levels up
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');
const CONFIG_PATH = join(ROOT_DIR, 'config.json');

export interface McpConfig {
  default_assignee?: string;
  default_reviewer?: string;
  default_labels?: string;
  is_draft?: boolean;
  should_delete_source_branch?: boolean;
  should_squash?: boolean;
}

export function loadConfig(): McpConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Failed to load config.json:', error);
  }
  return {};
}
