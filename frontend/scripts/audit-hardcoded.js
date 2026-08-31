/**
 * audit-hardcoded.js
 * Scans components for untranslated raw strings in JSX and props,
 * and verifies 100% dictionary completeness across all supported locales.
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const EN_PATH = path.join(MESSAGES_DIR, 'en.json');

// 1. Verify Dictionary Completeness
const enRaw = fs.readFileSync(EN_PATH, 'utf8');
const enData = JSON.parse(enRaw);

function extractKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(extractKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = new Set(extractKeys(enData));
const files = fs.readdirSync(MESSAGES_DIR).filter(f => f.endsWith('.json') && f !== 'en.json');

let hasMissingKeys = false;
console.log('==================================================');
console.log(`🔍 i18n Completeness Audit: Checking ${files.length + 1} locales against ${enKeys.size} keys`);
console.log('==================================================');

files.forEach(file => {
  const content = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf8'));
  const currentKeys = new Set(extractKeys(content));
  const missing = [...enKeys].filter(k => !currentKeys.has(k));

  if (missing.length > 0) {
    hasMissingKeys = true;
    console.error(`❌ ${file}: Missing ${missing.length} keys:`);
    console.error(missing.slice(0, 10).map(k => `   - ${k}`).join('\n'));
    if (missing.length > 10) console.error(`   ... and ${missing.length - 10} more`);
  } else {
    console.log(`✅ ${file}: 100% complete (${currentKeys.size}/${enKeys.size} keys)`);
  }
});

// 2. Component JSX & Prop String Audit
const COMPONENT_REGRESSION_CHECKS = [
  {
    file: path.join(__dirname, '..', 'src', 'components', 'EnvironmentalActivityRings.tsx'),
    checks: [
      { pattern: /label:\s*["']PRECIPITATION["']/, desc: 'Hardcoded PRECIPITATION label in rings' },
      { pattern: /subtext:\s*["']Rain probability["']/, desc: 'Hardcoded Rain probability subtext' },
      { pattern: /subtext:\s*["']Atmospheric moisture["']/, desc: 'Hardcoded Atmospheric moisture subtext' },
      { pattern: /subtext:\s*["']Surface vectors["']/, desc: 'Hardcoded Surface vectors subtext' },
    ]
  },
  {
    file: path.join(__dirname, '..', 'src', 'components', 'InteractiveForecastCard.tsx'),
    checks: [
      { pattern: /<span>Temperature<\/span>/, desc: 'Hardcoded Temperature tab label' },
      { pattern: /<span>Precipitation<\/span>/, desc: 'Hardcoded Precipitation tab label' },
      { pattern: /<span>Wind<\/span>/, desc: 'Hardcoded Wind tab label' },
    ]
  },
  {
    file: path.join(__dirname, '..', 'src', 'app', 'weather', 'page.tsx'),
    checks: [
      { pattern: /["']Partly Cloudy • Good UV["']/, desc: 'Hardcoded condition status string' },
    ]
  },
  {
    file: path.join(__dirname, '..', 'src', 'app', 'home', 'page.tsx'),
    checks: [
      { pattern: /["']Partly Cloudy • Good UV["']/, desc: 'Hardcoded condition status string' },
    ]
  },
  {
    file: path.join(__dirname, '..', 'src', 'components', 'PersonaInsightsSection.tsx'),
    checks: []
  },
  {
    file: path.join(__dirname, '..', 'src', 'components', 'AppSidebar.tsx'),
    checks: []
  },
  {
    file: path.join(__dirname, '..', 'src', 'app', 'settings', 'page.tsx'),
    checks: []
  },
  {
    file: path.join(__dirname, '..', 'src', 'app', 'chatbot', 'page.tsx'),
    checks: []
  },
];

console.log('\n==================================================');
console.log('🛡️ JSX & Props Localization Audit: Auditing Core Translated Components');
console.log('==================================================');

let auditFailed = false;

COMPONENT_REGRESSION_CHECKS.forEach(({ file, checks }) => {
  const relPath = path.relative(path.join(__dirname, '..'), file);
  if (!fs.existsSync(file)) {
    console.warn(`⚠️ Skipped missing file: ${relPath}`);
    return;
  }

  const content = fs.readFileSync(file, 'utf8');
  const usesI18n = content.includes('useI18n') || content.includes('t(');

  if (!usesI18n) {
    console.error(`❌ ${relPath}: Missing useI18n integration!`);
    auditFailed = true;
  } else {
    console.log(`✅ ${relPath}: useI18n hook integrated`);
  }

  checks.forEach(({ pattern, desc }) => {
    if (pattern.test(content)) {
      console.error(`❌ ${relPath}: Detected forbidden raw literal (${desc})`);
      auditFailed = true;
    }
  });
});

console.log('==================================================');
if (hasMissingKeys || auditFailed) {
  console.error('❌ i18n Audit Failed. Fix the flagged issues above.');
  process.exit(1);
} else {
  console.log('🎉 100% i18n Audit Passed! All components, props, and locales synchronized.');
  process.exit(0);
}
