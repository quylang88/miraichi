import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const SCANNED_DIRS = ['apps', 'packages', 'scripts'];

describe('deprecated URL parsing guard', () => {
  it('does not use url.parse in application or verification code', () => {
    const offenders: string[] = [];
    const deprecatedPattern = ['url', 'parse('].join('.');

    for (const dir of SCANNED_DIRS) {
      scanJavaScriptFiles(path.resolve(dir), offenders, deprecatedPattern);
    }

    expect(offenders).toEqual([]);
  });
});

function scanJavaScriptFiles(dirPath: string, offenders: string[], deprecatedPattern: string) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'coverage') continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanJavaScriptFiles(fullPath, offenders, deprecatedPattern);
      continue;
    }

    if (!entry.isFile() || (!entry.name.endsWith('.js') && !entry.name.endsWith('.ts'))) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(deprecatedPattern)) {
      offenders.push(path.relative(process.cwd(), fullPath).replace(/\\/g, '/'));
    }
  }
}
