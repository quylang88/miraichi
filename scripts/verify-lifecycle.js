import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export const LIFECYCLE_SKILL_MARKER = 'miraichi-delivery-lifecycle';

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

export function findPlaceholderScripts(manifests) {
  const findings = [];

  for (const manifest of manifests) {
    const scripts = manifest.json.scripts || {};

    for (const [scriptName, command] of Object.entries(scripts)) {
      if (typeof command !== 'string') continue;

      const normalizedCommand = command.toLowerCase();
      const isPassOnlyNodeEval =
        normalizedCommand.includes('node -e') &&
        normalizedCommand.includes('pass');

      if (isPassOnlyNodeEval) {
        findings.push({
          file: manifest.path,
          packageName: manifest.json.name || '(unnamed package)',
          scriptName,
          command
        });
      }
    }
  }

  return findings;
}

export function findMissingRootScripts(packageJson, requiredScripts = REQUIRED_ROOT_SCRIPTS) {
  const scripts = packageJson.scripts || {};
  return requiredScripts.filter((scriptName) => !(scriptName in scripts));
}

export function findMissingLifecycleReferences(fileContents, marker = LIFECYCLE_SKILL_MARKER) {
  const missing = [];

  for (const file of REQUIRED_LIFECYCLE_REFERENCE_FILES) {
    const content = fileContents.get(file);
    if (!content || !content.includes(marker)) {
      missing.push(file);
    }
  }

  return missing;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readWorkspacePackageManifests(rootDir) {
  const manifests = [];
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

async function readRequiredLifecycleFiles(rootDir) {
  const fileContents = new Map();

  for (const file of REQUIRED_LIFECYCLE_REFERENCE_FILES) {
    const absolutePath = path.join(rootDir, file);
    if (await pathExists(absolutePath)) {
      fileContents.set(file, await fs.readFile(absolutePath, 'utf8'));
    }
  }

  return fileContents;
}

export async function evaluateLifecycle(rootDir) {
  const manifests = await readWorkspacePackageManifests(rootDir);
  const rootPackage = manifests.find((manifest) => manifest.path === 'package.json').json;
  const fileContents = await readRequiredLifecycleFiles(rootDir);
  const lifecycleSkillPath = path.join(rootDir, '.agent/skills/miraichi-delivery-lifecycle/SKILL.md');

  return {
    missingRootScripts: findMissingRootScripts(rootPackage),
    placeholderScripts: findPlaceholderScripts(manifests),
    missingLifecycleReferences: findMissingLifecycleReferences(fileContents),
    lifecycleSkillExists: await pathExists(lifecycleSkillPath)
  };
}

function printIssueList(title, items, formatItem = (item) => `  - ${item}`) {
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

  if (!result.lifecycleSkillExists) {
    console.error('[Lifecycle Verify] Missing .agent/skills/miraichi-delivery-lifecycle/SKILL.md');
  }

  const failed =
    result.missingRootScripts.length > 0 ||
    result.placeholderScripts.length > 0 ||
    result.missingLifecycleReferences.length > 0 ||
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
    console.error(`[Lifecycle Verify] ${error.message}`);
    process.exit(1);
  });
}
