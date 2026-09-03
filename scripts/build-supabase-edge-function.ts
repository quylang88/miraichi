import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';

export interface EdgeBuildResult {
  readonly outputFile: string;
  readonly metadataFile: string;
}

function workspaceSourcePlugin(rootDir: string): Plugin {
  const packages: Readonly<Record<string, string>> = {
    '@miraichi/shared': 'packages/shared',
    '@miraichi/config': 'packages/config',
    '@miraichi/agent-protocol': 'packages/agent-protocol'
  };
  return {
    name: 'miraichi-workspace-source',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@miraichi\/(?:shared|config|agent-protocol)(?:\/.*)?$/ }, (args) => {
        const packageName = Object.keys(packages).find((candidate) => (
          args.path === candidate || args.path.startsWith(`${candidate}/`)
        ));
        if (!packageName) return undefined;
        const packageRoot = packages[packageName]!;
        const suffix = args.path.slice(packageName.length).replace(/\.js$/, '.ts');
        return {
          path: suffix
            ? path.join(rootDir, packageRoot, suffix.replace(/^\//, ''))
            : path.join(rootDir, packageRoot, 'src/index.ts')
        };
      });
    }
  };
}

export async function buildSupabaseEdgeFunction(options: {
  readonly rootDir?: string;
  readonly outputRoot?: string;
} = {}): Promise<EdgeBuildResult> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const outputRoot = path.resolve(
    options.outputRoot ?? path.join(rootDir, 'supabase/functions/_shared/generated')
  );
  const outputFile = path.join(outputRoot, 'miraichi-edge-runtime.js');
  const metadataFile = path.join(outputRoot, 'miraichi-edge-runtime.meta.json');
  await mkdir(outputRoot, { recursive: true });

  const result = await build({
    absWorkingDir: rootDir,
    entryPoints: ['apps/api/src/runtime/edge-runtime-composition.ts'],
    outfile: outputFile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    metafile: true,
    sourcemap: false,
    legalComments: 'none',
    external: ['node:buffer', 'node:crypto'],
    plugins: [workspaceSourcePlugin(rootDir)],
    logLevel: 'silent'
  });
  if (!result.metafile) throw new Error('Edge bundle metadata was not generated');
  await writeFile(metadataFile, `${JSON.stringify(result.metafile, null, 2)}\n`, 'utf8');
  return { outputFile, metadataFile };
}

async function main(): Promise<void> {
  const result = await buildSupabaseEdgeFunction();
  console.log(JSON.stringify({
    status: 'built',
    output: path.relative(process.cwd(), result.outputFile).replace(/\\/g, '/'),
    metadata: path.relative(process.cwd(), result.metadataFile).replace(/\\/g, '/')
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
