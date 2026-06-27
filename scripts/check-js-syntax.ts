import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const IGNORED_DIRS = new Set([
  '.git',
  '.pnpm',
  'coverage',
  'dist',
  'build',
  'node_modules'
]);

async function collectJavaScriptFiles(dirPath, files: string[] = []) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await collectJavaScriptFiles(fullPath, files);
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const targetDir = path.resolve(process.argv[2] || '.');
  const files = await collectJavaScriptFiles(targetDir);
  let failed = false;

  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
      encoding: 'utf8'
    });

    if (result.status !== 0) {
      failed = true;
      console.error(result.stderr || result.stdout);
    }
  }

  if (failed) {
    console.error(`[JS Syntax Check] FAILED for ${targetDir}`);
    process.exit(1);
  }

  console.log(`[JS Syntax Check] PASSED (${files.length} files checked).`);
}

main().catch((error) => {
  console.error(`[JS Syntax Check] ${error.message}`);
  process.exit(1);
});
