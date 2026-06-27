import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  REQUIRED_DOC_INDEX_REFERENCES,
  REQUIRED_LIFECYCLE_REFERENCE_FILES,
  REQUIRED_ROOT_SCRIPTS,
  REQUIRED_TEST_ORGANIZATION_MARKERS,
  REQUIRED_TYPESCRIPT_DIRECTION_MARKERS,
  evaluateLifecycle,
  findMissingMarkers,
  findMissingLifecycleReferences,
  findMissingRootScripts,
  findPlaceholderScripts
} from './verify-lifecycle.js';

describe('verify-lifecycle helpers', () => {
  it('flags placeholder test scripts that only print pass output', () => {
    const manifests = [
      {
        path: 'apps/api/package.json',
        json: {
          name: 'api',
          scripts: {
            test: 'node -e "console.log(\'api test pass\')"'
          }
        }
      },
      {
        path: 'packages/shared/package.json',
        json: {
          name: '@miraichi/shared',
          scripts: {
            test: 'vitest run'
          }
        }
      }
    ];

    expect(findPlaceholderScripts(manifests)).toEqual([
      {
        file: 'apps/api/package.json',
        packageName: 'api',
        scriptName: 'test',
        command: 'node -e "console.log(\'api test pass\')"'
      }
    ]);
  });

  it('requires the root lifecycle verification scripts', () => {
    const packageJson = {
      scripts: {
        'test:unit': 'vitest run',
        'verify:local': 'pnpm run verify:lifecycle'
      }
    };

    expect(findMissingRootScripts(packageJson, REQUIRED_ROOT_SCRIPTS)).toEqual([
      'test:unit:coverage',
      'test:integration',
      'verify:release'
    ]);
  });

  it('requires every lifecycle enforcement entrypoint to reference the central skill', () => {
    const fileContents = new Map(
      REQUIRED_LIFECYCLE_REFERENCE_FILES.map((file) => [
        file,
        file === 'AGENTS.md' ? 'miraichi-delivery-lifecycle' : 'existing content'
      ])
    );

    expect(findMissingLifecycleReferences(fileContents)).toEqual(
      REQUIRED_LIFECYCLE_REFERENCE_FILES.filter((file) => file !== 'AGENTS.md')
    );
  });

  it('detects missing test organization and TypeScript direction markers', () => {
    const fileContents = new Map([
      ['docs/workflows/testing-workflow.md', 'unit tests run with Vitest'],
      ['.agent/skills/miraichi-delivery-lifecycle/SKILL.md', 'test policy'],
      ['docs/README.md', 'Architecture docs only']
    ]);

    const missing = findMissingMarkers(fileContents, [
      ...REQUIRED_TEST_ORGANIZATION_MARKERS,
      ...REQUIRED_TYPESCRIPT_DIRECTION_MARKERS,
      ...REQUIRED_DOC_INDEX_REFERENCES
    ]);

    expect(missing).toContainEqual({
      file: 'docs/workflows/testing-workflow.md',
      marker: '*.test.{js,ts}'
    });
    expect(missing).toContainEqual({
      file: 'docs/workflows/testing-workflow.md',
      marker: 'ADR-0034'
    });
    expect(missing).toContainEqual({
      file: 'docs/README.md',
      marker: 'apps/api/docs/api-architecture.md'
    });
  });

  it('evaluates missing lifecycle wiring from workspace package manifests and files', async () => {
    const rootDir = await createWorkspaceFixture({
      rootScripts: {
        'test:unit': 'vitest run'
      },
      packageScripts: {
        test: 'node -e "console.log(\'api test pass\')"'
      },
      filesWithLifecycleMarker: ['AGENTS.md'],
      includeLifecycleSkill: false,
      includeRequiredMarkers: false
    });

    try {
      const result = await evaluateLifecycle(rootDir);

      expect(result.lifecycleSkillExists).toBe(false);
      expect(result.missingRootScripts).toEqual([
        'test:unit:coverage',
        'test:integration',
        'verify:local',
        'verify:release'
      ]);
      expect(result.placeholderScripts).toHaveLength(1);
      expect(result.missingLifecycleReferences).toContain('WORKFLOW.md');
      expect(result.missingTestOrganizationMarkers.length).toBeGreaterThan(0);
      expect(result.missingTypeScriptDirectionMarkers.length).toBeGreaterThan(0);
      expect(result.missingDocIndexReferences.length).toBeGreaterThan(0);
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it('passes evaluation for a fully wired lifecycle fixture', async () => {
    const rootDir = await createWorkspaceFixture({
      rootScripts: Object.fromEntries(
        REQUIRED_ROOT_SCRIPTS.map((scriptName) => [scriptName, 'echo ok'])
      ),
      packageScripts: {
        test: 'vitest run',
        lint: 'node ../../scripts/check-js-syntax.js .'
      },
      filesWithLifecycleMarker: REQUIRED_LIFECYCLE_REFERENCE_FILES,
      includeLifecycleSkill: true,
      includeRequiredMarkers: true
    });

    try {
      expect(await evaluateLifecycle(rootDir)).toEqual({
        missingRootScripts: [],
        placeholderScripts: [],
        missingLifecycleReferences: [],
        missingTestOrganizationMarkers: [],
        missingTypeScriptDirectionMarkers: [],
        missingDocIndexReferences: [],
        lifecycleSkillExists: true
      });
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});

async function createWorkspaceFixture({
  rootScripts,
  packageScripts,
  filesWithLifecycleMarker,
  includeLifecycleSkill,
  includeRequiredMarkers
}) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-lifecycle-'));

  await writeJson(path.join(rootDir, 'package.json'), {
    name: 'fixture-root',
    scripts: rootScripts
  });

  await fs.mkdir(path.join(rootDir, 'apps/api'), { recursive: true });
  await writeJson(path.join(rootDir, 'apps/api/package.json'), {
    name: 'api',
    scripts: packageScripts
  });

  const fileContentByPath = new Map();

  for (const file of REQUIRED_LIFECYCLE_REFERENCE_FILES) {
    const content = filesWithLifecycleMarker.includes(file)
      ? 'miraichi-delivery-lifecycle'
      : 'existing content';
    fileContentByPath.set(file, content);
  }

  const requiredMarkerFiles = new Set([
    ...REQUIRED_TEST_ORGANIZATION_MARKERS,
    ...REQUIRED_TYPESCRIPT_DIRECTION_MARKERS,
    ...REQUIRED_DOC_INDEX_REFERENCES
  ].map((requirement) => requirement.file));

  for (const file of includeRequiredMarkers ? requiredMarkerFiles : []) {
    if (file === '.agent/skills/miraichi-delivery-lifecycle/SKILL.md' && !includeLifecycleSkill) {
      continue;
    }

    const markerContent = [
      ...REQUIRED_TEST_ORGANIZATION_MARKERS,
      ...REQUIRED_TYPESCRIPT_DIRECTION_MARKERS,
      ...REQUIRED_DOC_INDEX_REFERENCES
    ]
      .filter((requirement) => requirement.file === file)
      .map((requirement) => requirement.marker)
      .join('\n');

    fileContentByPath.set(
      file,
      [fileContentByPath.get(file), markerContent].filter(Boolean).join('\n')
    );
  }

  if (includeLifecycleSkill) {
    const skillFile = '.agent/skills/miraichi-delivery-lifecycle/SKILL.md';
    fileContentByPath.set(
      skillFile,
      ['---\nname: miraichi-delivery-lifecycle\n---', fileContentByPath.get(skillFile)]
        .filter(Boolean)
        .join('\n')
    );
  }

  for (const [file, content] of fileContentByPath) {
    const filePath = path.join(rootDir, file);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }

  return rootDir;
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
