const fs = require("fs");
const path = require("path");

const MESSAGES_DIR = path.join(__dirname, "..", "messages");
const EN_PATH = path.join(MESSAGES_DIR, "en.json");

function getNestedKeys(obj, prefix = "") {
  let keys = [];
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getNestedKeys(obj[key], fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

function runAudit() {
  if (!fs.existsSync(EN_PATH)) {
    console.error("Missing source of truth messages/en.json!");
    process.exit(1);
  }

  const enContent = JSON.parse(fs.readFileSync(EN_PATH, "utf-8"));
  const enKeys = getNestedKeys(enContent);
  const totalKeys = enKeys.length;

  console.log(`\n======================================================`);
  console.log(`🌍 Mausam i18n Translation Completeness Tracker`);
  console.log(`Benchmark (en.json): ${totalKeys} translation keys`);
  console.log(`======================================================\n`);

  const files = fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith(".json"));

  let allPass = true;

  console.log(
    "| Locale | File       | Translated | Missing | Coverage | Status   |"
  );
  console.log(
    "|--------|------------|------------|---------|----------|----------|"
  );

  for (const file of files) {
    const localeCode = path.basename(file, ".json");
    const filePath = path.join(MESSAGES_DIR, file);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const localeKeys = new Set(getNestedKeys(content));

      const missing = enKeys.filter((k) => !localeKeys.has(k));
      const translatedCount = enKeys.length - missing.length;
      const pct = Math.round((translatedCount / totalKeys) * 100);

      const status = missing.length === 0 ? "✅ Complete" : `⚠️ ${missing.length} missing`;
      if (missing.length > 0) allPass = false;

      console.log(
        `| ${localeCode.padEnd(6)} | ${file.padEnd(10)} | ${String(translatedCount).padStart(10)} | ${String(missing.length).padStart(7)} | ${String(pct + "%").padStart(8)} | ${status.padEnd(8)} |`
      );

      if (missing.length > 0 && missing.length <= 5) {
        console.log(`   └─ Missing: ${missing.join(", ")}`);
      }
    } catch (e) {
      console.error(`| ${localeCode.padEnd(6)} | Error reading file: ${e.message}`);
      allPass = false;
    }
  }

  console.log(`\n======================================================\n`);
  if (!allPass) {
    console.log("ℹ️ Some locales have fallback keys (falling back to English seamlessly).");
  } else {
    console.log("🎉 All active locales have 100% complete translation coverage!");
  }
}

runAudit();
