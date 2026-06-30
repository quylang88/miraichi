import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), 'utf8'));
}

describe('Build command policy', () => {
  it('exposes a conventional root build command for the static web artifact', () => {
    const packageJson = readJson('package.json');

    expect(packageJson.scripts.build).toBe('pnpm run build:web-static');
    expect(packageJson.scripts['build:web-static']).toBe('pnpm --filter web run build:static');
  });

  it('exposes a conventional root web command for local web development', () => {
    const packageJson = readJson('package.json');

    expect(packageJson.scripts.web).toBe('pnpm run dev:web');
    expect(packageJson.scripts['dev:web']).toBe('pnpm --filter web run dev');
  });
});
