import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');

console.log('[PWA Verify] Starting PWA compliance verification...');

// 1. Verify files exist
const filesToVerify = [
  'apps/web/public/manifest.webmanifest',
  'apps/web/public/service-worker.ts',
  'apps/web/public/icons/icon.svg',
  'apps/web/src/pwa/register-service-worker.ts',
  'apps/web/src/auth-bootstrap.ts',
  'apps/web/src/shell-entry.ts',
  'apps/web/src/config/navigation-tabs.ts',
  'apps/web/src/components/app-shell.ts',
  'apps/web/src/components/bottom-navigation.ts',
  'apps/web/src/components/screens/today-screen.ts',
  'apps/web/src/components/screens/matches-screen.ts',
  'apps/web/src/components/screens/bets-screen.ts',
  'apps/web/src/components/screens/bankroll-screen.ts',
  'apps/web/src/services/settings-service.ts',
  'apps/web/src/services/i18n-service.ts',
  'apps/web/src/services/live-match-service.ts',
  'apps/web/src/live/live-refresh-lifecycle.ts',
  'apps/web/src/live/pull-down-refresh.ts'
];

let failed = false;

for (const file of filesToVerify) {
  const fullPath = path.join(ROOT_DIR, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ❌ Missing file: ${file}`);
    failed = true;
  } else {
    console.log(`  ✅ Exists: ${file}`);
  }
}

// 2. Read apps/web/src/index.ts and verify HTML tags and viewport
const webServerPath = path.join(ROOT_DIR, 'apps/web/src/index.ts');
if (fs.existsSync(webServerPath)) {
  const content = fs.readFileSync(webServerPath, 'utf8');
  
  // Verify viewport corrected
  if (!content.includes('viewport-fit=cover') || !content.includes('initial-scale=1')) {
    console.error('  ❌ Viewport viewport-fit=cover or initial-scale=1 missing or incorrect.');
    failed = true;
  } else {
    console.log('  ✅ Viewport corrected for notch and iOS safe area.');
  }

  // Verify manifest link
  if (!content.includes('href="/manifest.webmanifest"')) {
    console.error('  ❌ HTML shell missing manifest link.');
    failed = true;
  } else {
    console.log('  ✅ Manifest link found.');
  }

  // Verify iOS meta tags
  const iosMetaTags = [
    'rel="icon"',
    'apple-mobile-web-app-capable',
    'apple-mobile-web-app-status-bar-style',
    'apple-mobile-web-app-title',
    'apple-touch-icon'
  ];
  for (const tag of iosMetaTags) {
    if (!content.includes(tag)) {
      console.error(`  ❌ HTML shell missing iOS meta tag/link: "${tag}"`);
      failed = true;
    } else {
      console.log(`  ✅ iOS tag found: "${tag}"`);
    }
  }

  // Verify register-service-worker module import
  if (!content.includes('/apps/web/src/pwa/register-service-worker.js')) {
    console.error('  ❌ HTML shell missing register-service-worker.js script or import.');
    failed = true;
  } else {
    console.log('  ✅ Service worker registration script import found.');
  }

  if (!content.includes('/apps/web/src/auth-bootstrap.js')) {
    console.error('  ❌ Production shell missing owner auth bootstrap script import.');
    failed = true;
  } else {
    console.log('  ✅ Owner auth bootstrap script import found.');
  }
  if (content.includes('src="/apps/web/src/shell-entry.js"')) {
    console.error('  ❌ Production shell bypasses owner auth with a direct shell-entry script import.');
    failed = true;
  } else {
    console.log('  ✅ Production shell does not bypass owner auth.');
  }

  if (!content.includes('id="app-root"')) {
    console.error('  ❌ Production shell missing app-root mount point.');
    failed = true;
  } else {
    console.log('  ✅ Production shell app-root mount point found.');
  }
} else {
  console.error('  ❌ apps/web/src/index.ts not found.');
  failed = true;
}

// 2a. Verify production shell is TypeScript-first and uses the accepted four-tab backbone
const productionShellFiles = [
  'apps/web/src/auth-bootstrap.ts',
  'apps/web/src/shell-entry.ts',
  'apps/web/src/config/navigation-tabs.ts',
  'apps/web/src/components/app-shell.ts',
  'apps/web/src/components/bottom-navigation.ts',
  'apps/web/src/services/settings-service.ts',
  'apps/web/src/services/i18n-service.ts'
];

const serviceWorkerRegistrationPath = path.join(ROOT_DIR, 'apps/web/src/pwa/register-service-worker.ts');
if (fs.existsSync(serviceWorkerRegistrationPath)) {
  const content = fs.readFileSync(serviceWorkerRegistrationPath, 'utf8');
  const requiredLocalDevMarkers = [
    'LOCAL_DEV_HOSTS',
    'getRegistrations',
    'globalThis.caches.delete',
    'Local dev mode: service workers and shell caches disabled'
  ];

  for (const marker of requiredLocalDevMarkers) {
    if (!content.includes(marker)) {
      console.error(`  ❌ Service worker registration missing local dev cache-bypass marker: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Service worker registration local dev marker found: ${marker}`);
    }
  }
}

const serviceWorkerPath = path.join(ROOT_DIR, 'apps/web/public/service-worker.ts');
if (fs.existsSync(serviceWorkerPath)) {
  const content = fs.readFileSync(serviceWorkerPath, 'utf8');
  const requiredCacheMarkers = [
    "miraichi-shell-v7-live-flow",
    "/apps/web/src/auth-bootstrap.js",
    "/apps/web/src/config/navigation-tabs.js",
    "/apps/web/src/components/app-shell.js"
  ];

  for (const marker of requiredCacheMarkers) {
    if (!content.includes(marker)) {
      console.error(`  ❌ Service worker missing Phase 5.12 cache marker: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Service worker Phase 5.12 cache marker found: ${marker}`);
    }
  }
}

const ownerAuthBootstrapPath = path.join(ROOT_DIR, 'apps/web/src/auth-bootstrap.ts');
if (fs.existsSync(ownerAuthBootstrapPath)) {
  const content = fs.readFileSync(ownerAuthBootstrapPath, 'utf8');
  for (const marker of ["/api/v1/auth/session", "import('./shell-entry.js')"]) {
    if (!content.includes(marker)) {
      console.error(`  ❌ Owner auth bootstrap missing gated-shell marker: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Owner auth bootstrap marker found: ${marker}`);
    }
  }
}

for (const file of productionShellFiles) {
  const fullPath = path.join(ROOT_DIR, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ❌ Production shell TypeScript module missing: ${file}`);
    failed = true;
  } else {
    console.log(`  ✅ Production shell TypeScript module found: ${file}`);
  }
}

const navigationConfigPath = path.join(ROOT_DIR, 'apps/web/src/config/navigation-tabs.ts');
if (fs.existsSync(navigationConfigPath)) {
  const content = fs.readFileSync(navigationConfigPath, 'utf8');
  const requiredTabs = [
    "'today'",
    "'matches'",
    "'bets'",
    "'bankroll'"
  ];

  for (const marker of requiredTabs) {
    if (!content.includes(marker)) {
      console.error(`  ❌ Production navigation config missing tab marker: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Production navigation tab marker found: ${marker}`);
    }
  }

  const forbiddenTabs = [
    "id: 'settings'",
    "id: 'add'"
  ];

  for (const marker of forbiddenTabs) {
    if (content.includes(marker)) {
      console.error(`  ❌ Production navigation config contains forbidden primary tab: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Production navigation config omits forbidden primary tab: ${marker}`);
    }
  }
}

const appShellPath = path.join(ROOT_DIR, 'apps/web/src/components/app-shell.ts');
if (fs.existsSync(appShellPath)) {
  const rendererPaths = [
    appShellPath,
    path.join(ROOT_DIR, 'apps/web/src/components/screens/today-screen.ts'),
    path.join(ROOT_DIR, 'apps/web/src/components/screens/matches-screen.ts'),
    path.join(ROOT_DIR, 'apps/web/src/components/screens/bets-screen.ts'),
    path.join(ROOT_DIR, 'apps/web/src/components/screens/bankroll-screen.ts')
  ];
  const content = rendererPaths.filter((file) => fs.existsSync(file)).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const requiredShellMarkers = [
    'data-production-shell="phase-5-9"',
    'data-production-baseline="black-apple-ledger"',
    'data-add-bet-boundary="planned"',
    'class="main-scroll"',
    'id="screen-today"',
    'id="screen-match-detail"',
    'data-open-match',
    'data-open-scoped-add',
    'data-open-settlement',
    'data-open-settled-detail',
    'id="settlement-form"',
    'class="sheet-backdrop"',
    'id="match-summary-readonly"'
  ];

  for (const marker of requiredShellMarkers) {
    if (!content.includes(marker)) {
      console.error(`  ❌ Production shell missing marker: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Production shell marker found: ${marker}`);
    }
  }

  const forbiddenShellMarkers = [
    'class="top-bar"',
    'class="notice"',
    'Choose Match to Add',
    'aria-label="Phase 5.9"'
  ];

  for (const marker of forbiddenShellMarkers) {
    if (content.includes(marker)) {
      console.error(`  ❌ Production shell contains removed UI marker: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Production shell omits removed UI marker: ${marker}`);
    }
  }
}

// 2b. Verify the obsolete preview shell is no longer served now that production owns the UI
const previewPath = path.join(ROOT_DIR, 'apps/web/public/preview.html');
if (fs.existsSync(previewPath)) {
  console.error('  ❌ Obsolete preview shell still exists: apps/web/public/preview.html');
  failed = true;
} else {
  console.log('  ✅ Obsolete preview shell file is absent.');
}

if (fs.existsSync(webServerPath)) {
  const content = fs.readFileSync(webServerPath, 'utf8');
  const forbiddenPreviewRoutes = [
    '/preview',
    'preview.html'
  ];

  for (const marker of forbiddenPreviewRoutes) {
    if (content.includes(marker)) {
      console.error(`  ❌ Obsolete preview route marker still exists in web server: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Web server omits obsolete preview route marker: ${marker}`);
    }
  }
}

// 3. Verify no native iOS files exist
const iosDir = path.join(ROOT_DIR, 'apps/ios');
if (fs.existsSync(iosDir)) {
  console.error('  ❌ Failure: apps/ios directory should not exist.');
  failed = true;
} else {
  console.log('  ✅ No native iOS folder exists.');
}

// 4. Verify no React Native/Expo/Capacitor/Cordova dependencies exist in package.json files
const packageJsons = [
  'package.json',
  'apps/web/package.json'
];
const forbiddenDeps = ['react-native', 'expo', 'capacitor', 'cordova', '@capacitor/core'];
for (const pjson of packageJsons) {
  const pjsonPath = path.join(ROOT_DIR, pjson);
  if (fs.existsSync(pjsonPath)) {
    const raw = fs.readFileSync(pjsonPath, 'utf8');
    const lower = raw.toLowerCase();
    for (const dep of forbiddenDeps) {
      if (lower.includes(dep)) {
        console.error(`  ❌ Failure: Forbidden dependency "${dep}" found in ${pjson}`);
        failed = true;
      }
    }
  }
}
console.log('  ✅ Verification passed: No hybrid wrapper / native libraries in packages.');

// 5. Scan codebase for forbidden logic, push notifications, secrets
const forbiddenKeywords = [
  'apns', 'pushnotification', 'firebase-admin', 'webpush', 'vapid',
  'api_key', 'api-key', 'secret_key', 'prisma', 'mongoose', 'sequelize', 'drizzle', 'postgresql', 'mysql',
  'world cup', 'fifa', 'premier league'
];

function scanContent(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
  for (const keyword of forbiddenKeywords) {
    if (content.includes(keyword)) {
      console.error(`  ❌ Failure: Forbidden keyword "${keyword}" found in file ${filePath}`);
      failed = true;
    }
  }
}

// We scan the new files only to make sure no violations were added
const filesToScan = [
  'apps/web/public/service-worker.ts',
  'apps/web/src/pwa/register-service-worker.ts'
];
for (const file of filesToScan) {
  const fullPath = path.join(ROOT_DIR, file);
  if (fs.existsSync(fullPath)) {
    scanContent(fullPath);
  }
}

if (failed) {
  console.error('\n[PWA Verify] PWA compliance verification FAILED.');
  process.exit(1);
} else {
  console.log('\n[PWA Verify] PWA compliance verification PASSED.');
  process.exit(0);
}
