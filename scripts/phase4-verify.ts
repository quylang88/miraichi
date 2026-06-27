import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateInputCandidate } from '../apps/local-ai/src/input/input-candidate-validator.js';
import { mockInputCandidate } from '../apps/local-ai/src/input/mock-input-candidate.js';
import { runMockPrediction } from '../apps/local-ai/src/engines/mock-prediction-engine.js';
import { generateMockExplanation } from '../apps/local-ai/src/explainability/mock-explanation-refusal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyPhase4() {
  console.log('[Phase 4 Verify] Starting Phase 4.3 Mock Local AI verification tests...');

  const filesToCheck = [
    'apps/local-ai/src/input/input-candidate-validator.ts',
    'apps/local-ai/src/input/mock-input-candidate.ts',
    'apps/local-ai/src/engines/prediction-strategy-interface.ts',
    'apps/local-ai/src/engines/mock-prediction-engine.ts',
    'apps/local-ai/src/output/prediction-envelope-builder.ts',
    'apps/local-ai/src/explainability/mock-explanation-refusal.ts',
    'apps/local-ai/src/routes/mock-prediction.ts',
    'apps/local-ai/src/routes/mock-explanation.ts'
  ];

  // 1. Verify files exist
  for (const file of filesToCheck) {
    const filePath = path.join(__dirname, '..', file);
    try {
      await fs.access(filePath);
      console.log(`  ✅ Exists: ${file}`);
    } catch {
      console.error(`  ❌ Missing: ${file}`);
      process.exit(1);
    }
  }

  // 2. Verify mock input candidate uses generic values
  const inputGeneric = mockInputCandidate;
  if (
    inputGeneric.competitionId !== 'competition-alpha' ||
    inputGeneric.seasonId !== 'season-alpha-2026' ||
    inputGeneric.matchId !== 'match-alpha-001'
  ) {
    console.error('  ❌ Failure: mockInputCandidate does not use generic placeholders.');
    process.exit(1);
  }
  console.log('  ✅ Mock Input: Uses generic placeholders and identifiers.');

  // 3. Verify mock prediction engine
  const envelope = runMockPrediction(inputGeneric);
  if (envelope.predictionAvailable !== false) {
    console.error('  ❌ Failure: mock prediction available is true.');
    process.exit(1);
  }
  if (envelope.engineMode !== 'mock') {
    console.error('  ❌ Failure: mock prediction engineMode is not "mock".');
    process.exit(1);
  }
  if (envelope.confidenceLabel !== 'not_available') {
    console.error('  ❌ Failure: mock prediction confidenceLabel is not "not_available".');
    process.exit(1);
  }

  // Forbidden labels check on mock engine output
  const forbiddenLabels = ['home_win', 'draw', 'away_win', 'over_under', 'btts', 'recommended_pick', 'recommended_bet'];
  const serializedEnvelope = JSON.stringify(envelope).toLowerCase();
  for (const label of forbiddenLabels) {
    if (serializedEnvelope.includes(label)) {
      console.error(`  ❌ Failure: Mock prediction envelope contains forbidden label "${label}".`);
      process.exit(1);
    }
  }
  console.log('  ✅ Mock Engine: Correctly outputs traceable envelopes with predictionAvailable: false and no forbidden labels.');

  // 4. Verify mock explanation refusal
  const explanation = generateMockExplanation(envelope);
  if (explanation.explanationAvailable !== false) {
    console.error('  ❌ Failure: explanationAvailable is true for refusal.');
    process.exit(1);
  }
  if (!explanation.text || !explanation.text.includes('No prediction data is available')) {
    console.error('  ❌ Failure: explanation text does not contain refusal message.');
    process.exit(1);
  }
  if (explanation.references.predictionId !== envelope.predictionId) {
    console.error('  ❌ Failure: explanation references do not propagate predictionId.');
    process.exit(1);
  }
  console.log('  ✅ Mock Explanation: Refuses correctly with trace references when predictionAvailable is false.');

  // 5. Audit files for forbidden keywords (real tournaments, DB clients, ORMs, secrets, active wagers)
  const forbiddenKeywords = [
    'prisma', 'mongoose', 'sequelize', 'drizzle', 'postgresql', 'mysql',
    'api_key', 'api-key', 'secret_key', 'world cup', 'fifa', 'premier league',
    'onnxruntime', 'tensorflow', 'pytorch', 'llama.cpp', 'ollama', 'openai', 'anthropic'
  ];
  const srcDirs = [
    'apps/local-ai/src/input',
    'apps/local-ai/src/engines',
    'apps/local-ai/src/output',
    'apps/local-ai/src/explainability'
  ];

  for (const dir of srcDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    await scanDir(dirPath, forbiddenKeywords);
  }
  console.log('  ✅ Guardrail Audit: Verified zero model runtime, database, secrets, or tournament violations.');

  console.log('\n[Phase 4 Verify] Phase 4.3 Mock Prediction Scaffold verification tests PASSED successfully.');
}

async function scanDir(dirPath, keywords) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await scanDir(fullPath, keywords);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lowerContent = content.toLowerCase();

      for (const keyword of keywords) {
        if (lowerContent.includes(keyword)) {
          console.error(`  ❌ Violation in file ${fullPath}: Found forbidden keyword "${keyword}"`);
          process.exit(1);
        }
      }
    }
  }
}

verifyPhase4().catch((err) => {
  console.error('[Phase 4 Verify] Critical failure during execution:', err);
  process.exit(1);
});
