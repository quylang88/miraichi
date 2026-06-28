import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

type ViolationType = 'tracked-js-source' | 'explicit-any' | 'ts-suppression';

export type TypeSafetyViolation = {
  type: ViolationType;
  file: string;
  line: number;
  message: string;
};

const SOURCE_ROOTS = ['apps', 'packages', 'scripts'];
const IGNORED_DIRS = new Set(['.git', '.pnpm', 'node_modules', 'dist', 'build', 'coverage', '.venv']);
// Self-exclusion: these files contain forbidden patterns as string/regex literals by design.
const EXCLUDED_FILES = new Set([
  'scripts/type-safety-audit.ts',
  'scripts/type-safety-audit.test.ts',
  // Vitest query import (@ts-expect-error) cannot be resolved by tsc; this is test infrastructure.
  'apps/web/src/pwa/register-service-worker.test.ts'
]);
const SUPPRESSION_PATTERN = /@(ts-ignore|ts-nocheck|ts-expect-error)/;
const EXPLICIT_ANY_PATTERN =
  /(:\s*any\b|\bas\s+any\b|<any>|\bRecord<[^>]*,\s*any\b|\bPromise<\s*any\b|\bArray<\s*any\b|\bany\[\])/;

function toPosixRelative(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(rootDir: string, currentDir: string, files: string[]): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await collectFiles(rootDir, fullPath, files);
      }
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      files.push(fullPath);
    }
  }
}

function scanTypeScriptFile(rootDir: string, filePath: string, content: string): TypeSafetyViolation[] {
  const relativeFile = toPosixRelative(rootDir, filePath);
  const violations: TypeSafetyViolation[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (SUPPRESSION_PATTERN.test(line)) {
      violations.push({
        type: 'ts-suppression',
        file: relativeFile,
        line: lineNumber,
        message: 'TypeScript suppression comments are forbidden in source.'
      });
    }

    if (EXPLICIT_ANY_PATTERN.test(line)) {
      violations.push({
        type: 'explicit-any',
        file: relativeFile,
        line: lineNumber,
        message: 'Explicit any is forbidden. Use unknown plus a type guard or a concrete contract type.'
      });
    }
  });

  return violations;
}

export async function collectTypeSafetyViolations(rootDir = process.cwd()): Promise<TypeSafetyViolation[]> {
  const files: string[] = [];
  const violations: TypeSafetyViolation[] = [];

  for (const sourceRoot of SOURCE_ROOTS) {
    const absoluteRoot = path.join(rootDir, sourceRoot);
    if (await pathExists(absoluteRoot)) {
      await collectFiles(rootDir, absoluteRoot, files);
    }
  }

  const sortedFiles = files.sort();
  const jsFiles = sortedFiles.filter((f) => f.endsWith('.js'));
  const tsFiles = sortedFiles.filter((f) => !f.endsWith('.js'));

  for (const filePath of jsFiles) {
    const relativeFile = toPosixRelative(rootDir, filePath);
    if (EXCLUDED_FILES.has(relativeFile)) continue;
    violations.push({
      type: 'tracked-js-source',
      file: relativeFile,
      line: 1,
      message: 'Tracked JavaScript source is forbidden under apps/, packages/, and scripts/.'
    });
  }

  for (const filePath of tsFiles) {
    const relativeFile = toPosixRelative(rootDir, filePath);
    if (EXCLUDED_FILES.has(relativeFile)) continue;
    const content = await fs.readFile(filePath, 'utf8');
    violations.push(...scanTypeScriptFile(rootDir, filePath, content));
  }

  return violations;
}

async function main(): Promise<void> {
  const violations = await collectTypeSafetyViolations();

  if (violations.length > 0) {
    console.error('[Type Safety Audit] FAILED.');
    for (const violation of violations) {
      console.error(`  - ${violation.file}:${violation.line} ${violation.message}`);
    }
    process.exit(1);
  }

  console.log('[Type Safety Audit] PASSED.');
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  main().catch((error) => {
    console.error(`[Type Safety Audit] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
