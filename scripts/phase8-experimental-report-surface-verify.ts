import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildExperimentalReportSurface,
  generateExperimentalReportSurfaceMarkdown,
  type CandidateBakeoffReportForSurface
} from '../apps/local-ai/src/reports/experimental-report-surface.js';

const BAKEOFF_REPORT_PATH = 'apps/local-ai/reports/phase-8-4-candidate-model-bakeoff.json';
const SURFACE_REPORT_PATH = 'apps/local-ai/reports/phase-8-5-owner-only-experimental-report-surface.json';
const SURFACE_MARKDOWN_PATH = 'docs/data/PHASE-8-5-OWNER-ONLY-EXPERIMENTAL-REPORT-SURFACE.md';

function bakeoffReportPath(rootDir: string): string {
  return path.join(rootDir, BAKEOFF_REPORT_PATH);
}

export function verifyPhase85Preflight(rootDir: string): void {
  const sourcePath = bakeoffReportPath(rootDir);
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Phase 8.5 requires the Phase 8.4 candidate bake-off JSON report.');
  }

  const report = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as Partial<CandidateBakeoffReportForSurface>;
  if (report.selectedCandidateId !== null) {
    throw new Error('Phase 8.5 cannot run after a candidate has been selected.');
  }

  if (report.selectionAuthority !== 'blocked_until_phase_8_6_model_selection_adr') {
    throw new Error('Phase 8.5 requires model selection authority to remain blocked until Phase 8.6.');
  }
}

export function generatePhase85Report(rootDir: string) {
  verifyPhase85Preflight(rootDir);
  const sourcePath = bakeoffReportPath(rootDir);
  const bakeoffReport = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as CandidateBakeoffReportForSurface;
  return buildExperimentalReportSurface(bakeoffReport);
}

export function main(): void {
  const rootDir = process.cwd();
  const surface = generatePhase85Report(rootDir);
  const reportPath = path.join(rootDir, SURFACE_REPORT_PATH);
  const markdownPath = path.join(rootDir, SURFACE_MARKDOWN_PATH);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(surface, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, generateExperimentalReportSurfaceMarkdown(surface), 'utf8');

  if (surface.selectedCandidateId !== null || surface.audience !== 'owner_only') {
    console.error(`[Phase 8.5 Experimental Report Surface] FAILED. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`[Phase 8.5 Experimental Report Surface] PASSED. Report: ${reportPath}`);
  console.log(`[Phase 8.5 Experimental Report Surface] Audience: ${surface.audience}`);
  console.log(`[Phase 8.5 Experimental Report Surface] Selected candidate: none`);
}

const currentModulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isMain = Boolean(invokedPath) && (
  invokedPath === path.resolve(currentModulePath) ||
  invokedPath.endsWith('phase8-experimental-report-surface-verify.ts') ||
  invokedPath.endsWith('phase8-experimental-report-surface-verify.js') ||
  invokedPath.endsWith('phase8-experimental-report-surface-verify')
);

if (isMain) {
  main();
}
