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
  'apps/web/public/service-worker.js',
  'apps/web/public/icons/icon.svg',
  'apps/web/src/pwa/register-service-worker.js'
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

// 2. Read apps/web/src/index.js and verify HTML tags and viewport
const webServerPath = path.join(ROOT_DIR, 'apps/web/src/index.js');
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
} else {
  console.error('  ❌ apps/web/src/index.js not found.');
  failed = true;
}

// 2b. Verify the preview keeps Add Bet scoped to a match group
const previewPath = path.join(ROOT_DIR, 'apps/web/public/preview.html');
if (fs.existsSync(previewPath)) {
  const content = fs.readFileSync(previewPath, 'utf8');

  const requiredPreviewMarkers = [
    'id="screen-match-detail"',
    'data-open-match',
    'data-open-scoped-add',
    'data-open-edit',
    'data-review-only',
    'id="match-summary-readonly"'
  ];

  for (const marker of requiredPreviewMarkers) {
    if (!content.includes(marker)) {
      console.error(`  ❌ Preview missing match-scoped marker: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Preview marker found: ${marker}`);
    }
  }

  const forbiddenPreviewMarkers = [
    'id="match-field"',
    'name="match-field"',
    'for="match-field"',
    'data-primary-add',
    'Add Bet via Match'
  ];

  for (const marker of forbiddenPreviewMarkers) {
    if (content.includes(marker)) {
      console.error(`  ❌ Preview still contains global match dropdown marker: ${marker}`);
      failed = true;
    } else {
      console.log(`  ✅ Preview omits global match dropdown marker: ${marker}`);
    }
  }
} else {
  console.error('  ❌ apps/web/public/preview.html not found.');
  failed = true;
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

function scanContent(filePath) {
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
  'apps/web/public/service-worker.js',
  'apps/web/src/pwa/register-service-worker.js'
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
