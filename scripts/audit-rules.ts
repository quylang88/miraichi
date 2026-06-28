import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');

const RULES = [
  {
    name: 'Database/ORM Client Import Check',
    pattern: /from\s+['"](prisma|sequelize|mongoose|sqlite3|pg|mysql2|typeorm|mongodb)['"]/i,
    message: 'Database ORM/Client library import found. DB connections are strictly forbidden in Phase 2.'
  },
  {
    name: 'Core Logic Tournament Coupling Check',
    pattern: /['"](?:world\s*cup|fifa|premier\s*league|la\s*liga)['"]/i,
    message: 'Competition-specific string found in code. World Cup/national-team metadata belongs in registry/config/data, not core logic.',
    // Allowed files for this specific rule (tests and validators checking agnosticism checks)
    allowList: [
      'packages/config/src/competition-registry.mock.ts',
      'scripts/phase2-verify.ts'
    ]
  },
  {
    name: 'Betting Calculation Check',
    pattern: /(?:kellyCriterion|calculatePayout|impliedProbability|oddsToProbability|payoutMultiplier)/i,
    message: 'Premature betting/odds calculation function found. Betting math is forbidden in Phase 2.',
    allowList: [
      'apps/local-ai/src/features/feature-spec.ts',
      'apps/local-ai/src/features/feature-spec.test.ts',
      'apps/local-ai/src/features/leakage-audit.ts',
      'apps/local-ai/src/features/leakage-audit.test.ts',
      'apps/local-ai/src/features/feature-audit-report.ts',
      'apps/local-ai/src/features/feature-audit-report.test.ts'
    ]
  },
  {
    name: 'Bankroll & Risk Limit Check',
    pattern: /(?:bankrollLimit|riskLimit|allocateStake|adjustRisk)/i,
    message: 'Bankroll allocation or risk check found. Risk calculations are forbidden in Phase 2.'
  }
];

let violationsCount = 0;

function scanDir(dirPath: string) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'docs') {
        scanDir(fullPath);
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) &&
      relativePath !== 'scripts/audit-rules.ts'
    ) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      for (const rule of RULES) {
        if (rule.allowList && rule.allowList.includes(relativePath)) {
          continue; 
        }
        
        if (rule.pattern.test(content)) {
          console.error(`❌ [Audit Violation] in ${relativePath}:`);
          console.error(`   Rule: ${rule.name}`);
          console.error(`   Message: ${rule.message}`);
          violationsCount++;
        }
      }
    }
  }
}

console.log('[Audit-Rules] Scanning apps/ and packages/ directories for rule violations...');
scanDir(path.join(ROOT_DIR, 'apps'));
scanDir(path.join(ROOT_DIR, 'packages'));

if (violationsCount > 0) {
  console.error(`\n[Audit-Rules] Scan FAILED: ${violationsCount} guardrail violations found.`);
  process.exit(1);
} else {
  console.log('\n[Audit-Rules] Scan PASSED: Zero guardrail violations found.');
  process.exit(0);
}
