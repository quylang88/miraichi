import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';
import { getIndexHtml } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const WEB_DIR = path.join(ROOT_DIR, 'apps/web');
const DIST_DIR = path.join(WEB_DIR, 'dist');

const SOURCE_ROOTS = [
  'apps/web/src',
  'packages/ui/src',
  'packages/shared/src'
];

const PUBLIC_DIR = path.join(WEB_DIR, 'public');

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function removeDirectory(directoryPath) {
  fs.rmSync(directoryPath, { force: true, recursive: true });
}

function copyDirectory(sourceDirectory, targetDirectory) {
  if (!fs.existsSync(sourceDirectory)) {
    return;
  }

  ensureDirectory(targetDirectory);

  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      ensureDirectory(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function shouldSkipSourceFile(sourcePath) {
  return (
    sourcePath.endsWith('.test.js') ||
    sourcePath.endsWith('.test.ts') ||
    sourcePath.endsWith('.typecheck.ts') ||
    sourcePath.endsWith(path.normalize('apps/web/src/index.js'))
  );
}

function exportSourceTree(sourceRoot) {
  const absoluteSourceRoot = path.join(ROOT_DIR, sourceRoot);

  if (!fs.existsSync(absoluteSourceRoot)) {
    return;
  }

  const pendingDirectories = [absoluteSourceRoot];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const sourcePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        pendingDirectories.push(sourcePath);
        continue;
      }

      if (!entry.isFile() || shouldSkipSourceFile(sourcePath)) {
        continue;
      }

      const relativePath = path.relative(ROOT_DIR, sourcePath);
      const outputRelativePath = relativePath.replace(/\.ts$/, '.js');
      const outputPath = path.join(DIST_DIR, outputRelativePath);
      ensureDirectory(path.dirname(outputPath));

      if (sourcePath.endsWith('.ts')) {
        const source = fs.readFileSync(sourcePath, 'utf8');
        const transpiled = ts.transpileModule(source, {
          compilerOptions: {
            isolatedModules: true,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022
          }
        });
        fs.writeFileSync(outputPath, transpiled.outputText);
      } else {
        fs.copyFileSync(sourcePath, outputPath);
      }
    }
  }
}

removeDirectory(DIST_DIR);
ensureDirectory(DIST_DIR);
fs.writeFileSync(path.join(DIST_DIR, 'index.html'), getIndexHtml());
copyDirectory(PUBLIC_DIR, DIST_DIR);

for (const sourceRoot of SOURCE_ROOTS) {
  exportSourceTree(sourceRoot);
}

console.log(`[Web Static Build] Wrote Cloudflare Pages artifact to ${DIST_DIR}`);
