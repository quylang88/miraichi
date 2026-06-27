import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export const LIFECYCLE_SKILL_MARKER = 'miraichi-delivery-lifecycle';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = {
  [key: string]: JsonValue;
};

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: JsonValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

type PackageManifest = {
  path: string;
  json: JsonObject;
};

type MarkerRequirement = {
  file: string;
  marker: string;
};

type PlaceholderScriptFinding = {
  file: string;
  packageName: string;
  scriptName: string;
  command: string;
};

export const REQUIRED_ROOT_SCRIPTS = [
  'test:unit',
  'test:unit:coverage',
  'test:integration',
  'verify:local',
  'verify:release'
];

export const REQUIRED_LIFECYCLE_REFERENCE_FILES = [
  'AGENTS.md',
  'WORKFLOW.md',
  'docs/prompts/planning-prompt.md',
  'docs/prompts/codex-bootstrap-prompt.md',
  'docs/workflows/task-workflow.md',
  'docs/workflows/testing-workflow.md',
  'docs/workflows/release-workflow.md',
  'docs/workflows/pr-checklist.md',
  'ops/deploy/staging-plan.md',
  'ops/deploy/production-plan.md',
  '.agent/skills/executing-plans/SKILL.md',
  '.agent/skills/test-driven-development/SKILL.md',
  '.agent/skills/verification-before-completion/SKILL.md',
  '.agent/skills/miraichi-project-guardrails/SKILL.md'
];

export const REQUIRED_TEST_ORGANIZATION_MARKERS: MarkerRequirement[] = [
  { file: 'docs/workflows/testing-workflow.md', marker: '*.test.{js,ts}' },
  { file: 'docs/workflows/testing-workflow.md', marker: 'tests/integration/' },
  { file: 'docs/workflows/testing-workflow.md', marker: 'tests/e2e/' },
  { file: 'docs/workflows/testing-workflow.md', marker: 'large feature boundary' },
  { file: 'docs/workflows/testing-workflow.md', marker: 'colocated' },
  { file: '.agent/skills/miraichi-delivery-lifecycle/SKILL.md', marker: '*.test.{js,ts}' },
  { file: '.agent/skills/miraichi-delivery-lifecycle/SKILL.md', marker: 'tests/integration/' },
  { file: '.agent/skills/miraichi-delivery-lifecycle/SKILL.md', marker: 'tests/e2e/' },
  { file: '.agent/skills/miraichi-delivery-lifecycle/SKILL.md', marker: 'large feature boundary' }
];

export const REQUIRED_TYPESCRIPT_DIRECTION_MARKERS: MarkerRequirement[] = [
  { file: 'docs/workflows/testing-workflow.md', marker: 'ADR-0034' },
  { file: 'docs/workflows/testing-workflow.md', marker: '*.test.ts' },
  { file: 'docs/workflows/testing-workflow.md', marker: 'New app modules must be TypeScript-first' },
  { file: 'docs/workflows/testing-workflow.md', marker: 'big-bang migration' },
  { file: '.agent/skills/miraichi-delivery-lifecycle/SKILL.md', marker: 'gradual TypeScript' },
  { file: '.agent/skills/miraichi-delivery-lifecycle/SKILL.md', marker: '*.test.ts' },
  { file: '.agent/skills/miraichi-delivery-lifecycle/SKILL.md', marker: 'New app modules must be TypeScript-first' },
  { file: '.agent/skills/miraichi-project-guardrails/SKILL.md', marker: 'New application modules default to TypeScript' },
  { file: 'docs/architecture/module-map.md', marker: 'TypeScript migration order' },
  { file: 'docs/architecture/module-map.md', marker: 'New application modules must be TypeScript-first' },
  { file: 'apps/web/docs/frontend-architecture.md', marker: 'New web client modules must be TypeScript-first' }
];

export const REQUIRED_DOC_INDEX_REFERENCES: MarkerRequirement[] = [
  { file: 'docs/README.md', marker: 'docs/architecture/module-map.md' },
  { file: 'docs/README.md', marker: 'docs/decisions/README.md' },
  { file: 'docs/README.md', marker: 'docs/workflows/testing-workflow.md' },
  { file: 'docs/README.md', marker: 'docs/governance/OWNER-DECISION-GATES.md' },
  { file: 'docs/README.md', marker: 'apps/api/docs/api-architecture.md' },
  { file: 'docs/README.md', marker: 'apps/web/docs/frontend-architecture.md' },
  { file: 'docs/README.md', marker: 'apps/local-ai/docs/ai-architecture.md' },
  { file: 'docs/README.md', marker: 'apps/worker/docs/worker-architecture.md' },
  { file: 'docs/README.md', marker: 'packages/ui/docs/design-system.md' },
  { file: 'docs/README.md', marker: 'packages/config/docs/environment-strategy.md' },
  { file: 'docs/README.md', marker: 'packages/shared/docs/shared-types.md' },
  { file: 'docs/README.md', marker: 'packages/agent-protocol/docs/agent-communication.md' },
  { file: 'docs/README.md', marker: 'ops/deploy/staging-plan.md' },
  { file: 'docs/README.md', marker: 'ops/ci/github-actions-plan.md' }
];

export function findPlaceholderScripts(manifests: PackageManifest[]): PlaceholderScriptFinding[] {
  const findings: PlaceholderScriptFinding[] = [];

  for (const manifest of manifests) {
    const scripts = isJsonObject(manifest.json.scripts) ? manifest.json.scripts : {};

    for (const [scriptName, command] of Object.entries(scripts)) {
      if (typeof command !== 'string') continue;

      const normalizedCommand = command.toLowerCase();
      const isPassOnlyNodeEval =
        normalizedCommand.includes('node -e') &&
        normalizedCommand.includes('pass');

      if (isPassOnlyNodeEval) {
        findings.push({
          file: manifest.path,
          packageName: readString(manifest.json.name, '(unnamed package)'),
          scriptName,
          command
        });
      }
    }
  }

  return findings;
}

export function findMissingRootScripts(
  packageJson: JsonObject,
  requiredScripts: string[] = REQUIRED_ROOT_SCRIPTS
): string[] {
  const scripts = packageJson.scripts;
  const scriptsObj = isJsonObject(scripts) ? scripts : {};
  return requiredScripts.filter((scriptName) => !(scriptName in scriptsObj));
}

export function findMissingLifecycleReferences(
  fileContents: Map<string, string>,
  marker = LIFECYCLE_SKILL_MARKER
): string[] {
  const missing: string[] = [];

  for (const file of REQUIRED_LIFECYCLE_REFERENCE_FILES) {
    const content = fileContents.get(file);
    if (!content || !content.includes(marker)) {
      missing.push(file);
    }
  }

  return missing;
}

export function findMissingMarkers(
  fileContents: Map<string, string>,
  requirements: MarkerRequirement[]
): MarkerRequirement[] {
  return requirements.filter((requirement) => {
    const content = fileContents.get(requirement.file);
    return !content || !content.includes(requirement.marker);
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath: string): Promise<JsonObject> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as JsonObject;
}

async function readWorkspacePackageManifests(rootDir: string): Promise<PackageManifest[]> {
  const manifests: PackageManifest[] = [];
  const rootPackagePath = path.join(rootDir, 'package.json');

  manifests.push({
    path: 'package.json',
    json: await readJson(rootPackagePath)
  });

  for (const workspaceDir of ['apps', 'packages']) {
    const absoluteWorkspaceDir = path.join(rootDir, workspaceDir);
    if (!(await pathExists(absoluteWorkspaceDir))) continue;

    const entries = await fs.readdir(absoluteWorkspaceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const packagePath = path.join(absoluteWorkspaceDir, entry.name, 'package.json');
      if (!(await pathExists(packagePath))) continue;

      manifests.push({
        path: path.relative(rootDir, packagePath).replace(/\\/g, '/'),
        json: await readJson(packagePath)
      });
    }
  }

  return manifests;
}

async function readRequiredLifecycleFiles(rootDir: string): Promise<Map<string, string>> {
  const fileContents = new Map();
  const requiredFiles = new Set([
    ...REQUIRED_LIFECYCLE_REFERENCE_FILES,
    ...REQUIRED_TEST_ORGANIZATION_MARKERS.map((requirement) => requirement.file),
    ...REQUIRED_TYPESCRIPT_DIRECTION_MARKERS.map((requirement) => requirement.file),
    ...REQUIRED_DOC_INDEX_REFERENCES.map((requirement) => requirement.file)
  ]);

  for (const file of requiredFiles) {
    const absolutePath = path.join(rootDir, file);
    if (await pathExists(absolutePath)) {
      fileContents.set(file, await fs.readFile(absolutePath, 'utf8'));
    }
  }

  return fileContents;
}

export async function evaluateLifecycle(rootDir: string) {
  const manifests = await readWorkspacePackageManifests(rootDir);
  const rootManifest = manifests.find((manifest) => manifest.path === 'package.json');
  if (!rootManifest) {
    throw new Error('Missing root package.json manifest');
  }
  const rootPackage = rootManifest.json;
  const fileContents = await readRequiredLifecycleFiles(rootDir);
  const lifecycleSkillPath = path.join(rootDir, '.agent/skills/miraichi-delivery-lifecycle/SKILL.md');

  return {
    missingRootScripts: findMissingRootScripts(rootPackage),
    placeholderScripts: findPlaceholderScripts(manifests),
    missingLifecycleReferences: findMissingLifecycleReferences(fileContents),
    missingTestOrganizationMarkers: findMissingMarkers(fileContents, REQUIRED_TEST_ORGANIZATION_MARKERS),
    missingTypeScriptDirectionMarkers: findMissingMarkers(fileContents, REQUIRED_TYPESCRIPT_DIRECTION_MARKERS),
    missingDocIndexReferences: findMissingMarkers(fileContents, REQUIRED_DOC_INDEX_REFERENCES),
    lifecycleSkillExists: await pathExists(lifecycleSkillPath)
  };
}

function printIssueList<T>(
  title: string,
  items: T[],
  formatItem: (item: T) => string = (item) => `  - ${item}`
) {
  if (items.length === 0) return;

  console.error(title);
  for (const item of items) {
    console.error(formatItem(item));
  }
}

async function main() {
  const rootDir = process.cwd();
  const result = await evaluateLifecycle(rootDir);

  printIssueList('[Lifecycle Verify] Missing root scripts:', result.missingRootScripts);
  printIssueList(
    '[Lifecycle Verify] Placeholder pass-only scripts found:',
    result.placeholderScripts,
    (item) => `  - ${item.file} -> ${item.scriptName}: ${item.command}`
  );
  printIssueList(
    '[Lifecycle Verify] Files missing lifecycle skill reference:',
    result.missingLifecycleReferences
  );
  printIssueList(
    '[Lifecycle Verify] Missing test organization markers:',
    result.missingTestOrganizationMarkers,
    (item) => `  - ${item.file} missing "${item.marker}"`
  );
  printIssueList(
    '[Lifecycle Verify] Missing TypeScript direction markers:',
    result.missingTypeScriptDirectionMarkers,
    (item) => `  - ${item.file} missing "${item.marker}"`
  );
  printIssueList(
    '[Lifecycle Verify] Missing docs index references:',
    result.missingDocIndexReferences,
    (item) => `  - ${item.file} missing "${item.marker}"`
  );

  if (!result.lifecycleSkillExists) {
    console.error('[Lifecycle Verify] Missing .agent/skills/miraichi-delivery-lifecycle/SKILL.md');
  }

  const failed =
    result.missingRootScripts.length > 0 ||
    result.placeholderScripts.length > 0 ||
    result.missingLifecycleReferences.length > 0 ||
    result.missingTestOrganizationMarkers.length > 0 ||
    result.missingTypeScriptDirectionMarkers.length > 0 ||
    result.missingDocIndexReferences.length > 0 ||
    !result.lifecycleSkillExists;

  if (failed) {
    console.error('\n[Lifecycle Verify] FAILED.');
    process.exit(1);
  }

  console.log('[Lifecycle Verify] PASSED.');
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  main().catch((error) => {
    console.error(`[Lifecycle Verify] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
