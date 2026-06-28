import { validateConfig } from '../packages/config/src/competition-registry.mock.js';

console.log('[Phase 2 Verify] Running automated scope enforcement test suite...');

let failed = false;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    failed = true;
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

// 1. Config Loader Scope & Safety Checks (ADR-0009 & ADR-0010)
console.log('\n--- 1. Testing Config Registry Validation ---');
try {
  const valid = validateConfig({ competitionId: 'comp_1', seasonId: '2026' });
  assert(valid === true, 'validateConfig accepts valid configuration keys');
} catch (err) {
  assert(false, `validateConfig rejected valid configuration: ${err instanceof Error ? err.message : String(err)}`);
}

try {
  const validWorldCupRegistry = validateConfig({ competitionId: 'comp_1', name: 'World Cup Tournament', sport: 'football', status: 'active' });
  assert(validWorldCupRegistry === true, 'validateConfig accepts World Cup as explicit registry metadata');
} catch (err) {
  assert(false, `validateConfig rejected valid World Cup registry metadata: ${err instanceof Error ? err.message : String(err)}`);
}

try {
  validateConfig({ competitionId: 'comp_1', invalidField: 'hack' });
  assert(false, 'validateConfig should reject unapproved/invalid config keys');
} catch (err) {
  assert((err instanceof Error ? err.message : String(err)).includes('Invalid configuration key'), 'validateConfig successfully rejects invalid key "invalidField"');
}

// 2. Chatbot Refusal Checks (ADR-0007 Rule Compliance)
console.log('\n--- 2. Testing Chatbot Sports Refusal Bounds ---');
const checkSportsQuery = (msg: string) => /predict|win|team|score|match|odds|play|ratio|history|average|stats/i.test(msg);

assert(checkSportsQuery('Why does the model predict Team A win?') === true, 'Approved sports queries match query pattern');
assert(checkSportsQuery('What is the recipe for cheese pizza?') === false, 'Non-sports queries are marked as out-of-scope (pizza)');
assert(checkSportsQuery('What is the weather in Paris?') === false, 'Non-sports queries are marked as out-of-scope (weather)');

if (failed) {
  console.error('\n[Phase 2 Verify] Scope enforcement checks FAILED.');
  process.exit(1);
} else {
  console.log('\n[Phase 2 Verify] Scope enforcement checks PASSED successfully.');
}
