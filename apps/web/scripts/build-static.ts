import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';
import { buildSync } from 'esbuild';
import { getIndexHtml } from '../src/index.js';
import { readReleaseMetadata, type ReleaseMetadata } from '@miraichi/shared';
import { sha256FileTree } from '../../../scripts/release/release-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const WEB_DIR = path.join(ROOT_DIR, 'apps/web');
const DIST_DIR = path.join(WEB_DIR, 'dist');

const SOURCE_ROOTS = [
  'apps/web/src',
  'packages/ui/src',
  'packages/shared/src',
  'packages/config/src',
  'packages/agent-protocol/src'
];

const PUBLIC_DIR = path.join(WEB_DIR, 'public');

function ensureDirectory(directoryPath: string) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function removeDirectory(directoryPath: string) {
  fs.rmSync(directoryPath, { force: true, recursive: true });
}

function copyDirectory(sourceDirectory: string, targetDirectory: string) {
  if (!fs.existsSync(sourceDirectory)) {
    return;
  }

  ensureDirectory(targetDirectory);

  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetFileName = entry.name.endsWith('.ts')
      ? entry.name.replace(/\.ts$/, '.js')
      : entry.name;
    const targetPath = path.join(targetDirectory, targetFileName);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      ensureDirectory(path.dirname(targetPath));
      if (sourcePath.endsWith('.ts')) {
        fs.writeFileSync(targetPath, transpileTypeScriptFile(sourcePath));
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }
}

function shouldSkipSourceFile(sourcePath: string) {
  return (
    sourcePath.endsWith('.test.js') ||
    sourcePath.endsWith('.test.ts') ||
    sourcePath.endsWith('.typecheck.ts') ||
    sourcePath.endsWith(path.normalize('apps/web/src/index.ts'))
  );
}

function exportSourceTree(sourceRoot: string) {
  const absoluteSourceRoot = path.join(ROOT_DIR, sourceRoot);

  if (!fs.existsSync(absoluteSourceRoot)) {
    return;
  }

  const pendingDirectories = [absoluteSourceRoot];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

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
        fs.writeFileSync(outputPath, transpileTypeScriptFile(sourcePath));
      } else {
        fs.copyFileSync(sourcePath, outputPath);
      }
    }
  }
}

removeDirectory(DIST_DIR);
ensureDirectory(DIST_DIR);
fs.writeFileSync(path.join(DIST_DIR, 'index.html'), getIndexHtml(''));
copyDirectory(PUBLIC_DIR, DIST_DIR);

for (const sourceRoot of SOURCE_ROOTS) {
  exportSourceTree(sourceRoot);
}

// Keep legacy module URLs for already-open older installations during the update.
// New launches need only these two cached entries, with no network import waterfall.
buildSync({
  absWorkingDir: ROOT_DIR,
  entryPoints: ['apps/web/src/auth-bootstrap.ts', 'apps/web/src/pwa/register-service-worker.ts'],
  outbase: ROOT_DIR,
  outdir: DIST_DIR,
  bundle: true,
  splitting: false,
  format: 'esm',
  platform: 'browser',
  target: ['es2022', 'safari16.4'],
  minify: true
});

const releaseMetadata: ReleaseMetadata = process.env.MIRAICHI_RELEASE_ENVIRONMENT
  ? readReleaseMetadata(process.env)
  : {
      environment: 'local',
      gitSha: '0'.repeat(40),
      artifactVersion: 'local-build',
      compatibilityVersion: 'owner-v1'
    };
const webHash = await sha256FileTree(DIST_DIR, { exclude: ['release.json'] });
const serviceWorkerPath = path.join(DIST_DIR, 'service-worker.js');
const serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
if (!serviceWorker.includes('__MIRAICHI_WEB_HASH__')) {
  throw new Error('Service worker cache placeholder is missing');
}
fs.writeFileSync(serviceWorkerPath, serviceWorker.replaceAll('__MIRAICHI_WEB_HASH__', webHash));
fs.writeFileSync(path.join(DIST_DIR, 'release.json'), `${JSON.stringify(releaseMetadata, null, 2)}\n`);

console.log(`[Web Static Build] Wrote Cloudflare Worker Static Assets artifact ${webHash} to ${DIST_DIR}`);

function transpileTypeScriptFile(sourcePath: string) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      isolatedModules: true,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  });

  return transpiled.outputText;
}
