export interface LocaleConfig {
  code: string;
  name: string;
  nativeName: string;
  script: string;
  dir: "ltr" | "rtl";
  phase: 1 | 2;
  aiChatSupported: boolean;
}

// All 22 Scheduled Languages of India (8th Schedule) + English
export const ALL_LOCALES: LocaleConfig[] = [
  // Phase 1: High population & widely-spoken across major states
  { code: "en", name: "English", nativeName: "English", script: "Latin", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", script: "Devanagari", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "mr", name: "Marathi", nativeName: "मराठी", script: "Devanagari", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", script: "Tamil", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", script: "Telugu", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", script: "Kannada", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", script: "Bengali", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", script: "Gujarati", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", script: "Malayalam", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", script: "Gurmukhi", dir: "ltr", phase: 1, aiChatSupported: true },
  { code: "ur", name: "Urdu", nativeName: "اردو", script: "Nastaliq", dir: "rtl", phase: 1, aiChatSupported: true },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", script: "Odia", dir: "ltr", phase: 1, aiChatSupported: true },

  // Phase 2: Remaining Scheduled Languages of India
  { code: "as", name: "Assamese", nativeName: "অসমীয়া", script: "Bengali-Assamese", dir: "ltr", phase: 2, aiChatSupported: false },
  { code: "brx", name: "Bodo", nativeName: "बर'", script: "Devanagari", dir: "ltr", phase: 2, aiChatSupported: false },
  { code: "doi", name: "Dogri", nativeName: "डोगरी", script: "Devanagari", dir: "ltr", phase: 2, aiChatSupported: false },
  { code: "ks", name: "Kashmiri", nativeName: "कॉशुर / کٲشُر", script: "Perso-Arabic / Sharada", dir: "rtl", phase: 2, aiChatSupported: false },
  { code: "kok", name: "Konkani", nativeName: "कोंकणी", script: "Devanagari", dir: "ltr", phase: 2, aiChatSupported: false },
  { code: "mai", name: "Maithili", nativeName: "मैथिली", script: "Devanagari", dir: "ltr", phase: 2, aiChatSupported: false },
  { code: "mni", name: "Manipuri", nativeName: "ꯃꯤꯇꯩꯂꯣꯟ (Meitei)", script: "Meetei Mayek", dir: "ltr", phase: 2, aiChatSupported: false },
  { code: "ne", name: "Nepali", nativeName: "नेपाली", script: "Devanagari", dir: "ltr", phase: 2, aiChatSupported: false },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्", script: "Devanagari", dir: "ltr", phase: 2, aiChatSupported: false },
  { code: "sat", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ (Ol Chiki)", script: "Ol Chiki", dir: "ltr", phase: 2, aiChatSupported: false },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي / सिन्धी", script: "Perso-Arabic", dir: "rtl", phase: 2, aiChatSupported: false },
];

export const PHASE_1_LOCALES = ALL_LOCALES.filter((l) => l.phase === 1);
export const DEFAULT_LOCALE = "en";

export function getLocaleConfig(code: string): LocaleConfig {
  const found = ALL_LOCALES.find((l) => l.code === code);
  return found || ALL_LOCALES[0];
}

export function isRtlLocale(code: string): boolean {
  const config = getLocaleConfig(code);
  return config.dir === "rtl";
}
