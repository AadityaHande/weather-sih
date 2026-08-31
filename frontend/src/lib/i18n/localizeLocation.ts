/**
 * localizeLocation.ts
 * Translates and transliterates Indian cities, administrative terms (Ward, Sector, Nagar),
 * and reverse-geocoded location strings into India's scheduled languages.
 */

// Common administrative division terms across languages
const ADMIN_TERMS: Record<string, Record<string, string>> = {
  ward: {
    en: "Ward",
    mr: "वॉर्ड",
    hi: "वार्ड",
    kn: "ವಾರ್ಡ್",
    ta: "வார்டு",
    te: "వార్డు",
    bn: "ওয়ার্ড",
    gu: "વોર્ડ",
    ml: "വാർഡ്",
    pa: "ਵਾਰਡ",
    ur: "وارڈ",
    or: "ୱାର୍ଡ",
  },
  sector: {
    en: "Sector",
    mr: "सेक्टर",
    hi: "सेक्टर",
    kn: "ಸೆಕ್ಟರ್",
    ta: "செக்டர்",
    te: "సెక్టార్",
    bn: "সেক্টর",
    gu: "સેક્ટર",
    ml: "സെക്ടർ",
    pa: "ਸੈਕਟਰ",
    ur: "سیکٹر",
    or: "ସେକ୍ଟର",
  },
  nagar: {
    en: "Nagar",
    mr: "नगर",
    hi: "नगर",
    kn: "ನಗರ",
    ta: "நகர்",
    te: "నగర్",
    bn: "নগর",
    gu: "નગર",
    ml: "നഗർ",
    pa: "ਨਗਰ",
    ur: "نگر",
    or: "ନଗର",
  },
  road: {
    en: "Road",
    mr: "रस्ता",
    hi: "मार्ग",
    kn: "ರಸ್ತೆ",
    ta: "சாலை",
    te: "రోడ్డు",
    bn: "রোড",
    gu: "રોડ",
    ml: "റോഡ്",
    pa: "ਸੜਕ",
    ur: "روڈ",
    or: "ରାସ୍ତା",
  },
  colony: {
    en: "Colony",
    mr: "कॉलनी",
    hi: "कॉलोनी",
    kn: "ಕಾಲೋನಿ",
    ta: "காலனி",
    te: "కాలనీ",
    bn: "কলোনি",
    gu: "કોલોની",
    ml: "കോളനി",
    pa: "ਕਲੋਨੀ",
    ur: "کالونی",
    or: "କଲୋନୀ",
  },
  circle: {
    en: "Circle",
    mr: "चौक",
    hi: "चौक",
    kn: "ವೃತ್ತ",
    ta: "வட்டம்",
    te: "సర్కిల్",
    bn: "সার্কেল",
    gu: "સર્કલ",
    ml: "സർക്കിൾ",
    pa: "ਚੌਕ",
    ur: "چوک",
    or: "ଛକ",
  },
};

// Major Indian cities and common localities across languages
const LOCALITY_NAMES: Record<string, Record<string, string>> = {
  pune: {
    en: "Pune",
    mr: "पुणे",
    hi: "पुणे",
    kn: "ಪುಣೆ",
    ta: "புனே",
    te: "పుణె",
    bn: "পুনে",
    gu: "પુણે",
    ml: "പൂനെ",
    pa: "ਪੁਣੇ",
    ur: "پونے",
    or: "ପୁଣେ",
  },
  gokulnagar: {
    en: "Gokulnagar",
    mr: "गोकुळनगर",
    hi: "गोकुलनगर",
    kn: "ಗೋಕುಲನಗರ",
    ta: "கோகுல்நகர்",
    te: "గోకులనగర్",
    bn: "গোকুলনগর",
    gu: "ગોકુળનગર",
    ml: "ഗോകുൽനഗർ",
    pa: "ਗੋਕੁਲਨਗਰ",
    ur: "گوکل نگر",
    or: "ଗୋକୁଳନଗର",
  },
  mumbai: {
    en: "Mumbai",
    mr: "मुंबई",
    hi: "मुंबई",
    kn: "ಮುಂಬೈ",
    ta: "மும்பை",
    te: "ముంబై",
    bn: "মুম্বই",
    gu: "મુંબઈ",
    ml: "മുംബൈ",
    pa: "ਮੁੰਬਈ",
    ur: "ممبئی",
    or: "ମୁମ୍ବାଇ",
  },
  delhi: {
    en: "Delhi",
    mr: "दिल्ली",
    hi: "दिल्ली",
    kn: "ದೆಹಲಿ",
    ta: "டெல்லி",
    te: "ఢిల్లీ",
    bn: "দিল্লি",
    gu: "દિલ્હી",
    ml: "ഡൽഹി",
    pa: "ਦਿੱਲੀ",
    ur: "دہلی",
    or: "ଦିଲ୍ଲୀ",
  },
  bangalore: {
    en: "Bengaluru",
    mr: "बंगळुरू",
    hi: "बेंगलुरु",
    kn: "ಬೆಂಗಳೂರು",
    ta: "பெங்களூரு",
    te: "బెంగళూరు",
    bn: "বেঙ্গালুরু",
    gu: "બેંગલુરુ",
    ml: "ബാംഗ്ലൂർ",
    pa: "ਬੈਂਗਲੁਰੂ",
    ur: "بنگلور",
    or: "ବେଙ୍ଗାଲୁରୁ",
  },
  bengaluru: {
    en: "Bengaluru",
    mr: "बंगळुरू",
    hi: "बेंगलुरु",
    kn: "ಬೆಂಗಳೂರು",
    ta: "பெங்களூரு",
    te: "బెంగళూరు",
    bn: "বেঙ্গালুরু",
    gu: "બેંગલુરુ",
    ml: "ബാംഗ്ലൂർ",
    pa: "ਬੈਂਗਲੁਰੂ",
    ur: "بنگلور",
    or: "ବେଙ୍ଗାଲୁରୁ",
  },
  hyderabad: {
    en: "Hyderabad",
    mr: "हैदराबाद",
    hi: "हैदराबाद",
    kn: "ಹೈದರಾಬಾದ್",
    ta: "ஹைதராபாத்",
    te: "హైదరాబాద్",
    bn: "হায়দ্রাবাদ",
    gu: "હૈદરાબાદ",
    ml: "ഹൈദരാബാദ്",
    pa: "ਹੈਦਰਾਬਾਦ",
    ur: "حیدرآباد",
    or: "ହାଇଦ୍ରାବାଦ",
  },
  chennai: {
    en: "Chennai",
    mr: "चेन्नई",
    hi: "चेन्नई",
    kn: "ಚೆನ್ನೈ",
    ta: "சென்னை",
    te: "చెన్నై",
    bn: "চেন্নাই",
    gu: "ચેન્નાઈ",
    ml: "ചെന്നൈ",
    pa: "ਚੇਨਈ",
    ur: "چنئی",
    or: "ଚେନ୍ନାଇ",
  },
  kolkata: {
    en: "Kolkata",
    mr: "कोलकाता",
    hi: "कोलकाता",
    kn: "ಕೋಲ್ಕತ್ತಾ",
    ta: "கொல்கத்தா",
    te: "కోల్‌కతా",
    bn: "কলকাতা",
    gu: "કોલકાતા",
    ml: "കൊൽക്കത്ത",
    pa: "ਕੋਲਕਾਤਾ",
    ur: "کولکتہ",
    or: "କୋଲକାତା",
  },
  ahmedabad: {
    en: "Ahmedabad",
    mr: "अहमदाबाद",
    hi: "अहमदाबाद",
    kn: "ಅಹಮದಾಬಾದ್",
    ta: "அகமதாபாத்",
    te: "అహ్మదాబాద్",
    bn: "আহমেদাবাদ",
    gu: "અમદાવાદ",
    ml: "അഹമ്മദാബാദ്",
    pa: "ਅਹਿਮਦਾਬਾਦ",
    ur: "احمد آباد",
    or: "ଅହମଦାବାଦ",
  },
  jaipur: {
    en: "Jaipur",
    mr: "जयपूर",
    hi: "जयपुर",
    kn: "ಜೈಪುರ",
    ta: "ஜெய்ப்பூர்",
    te: "జైపూర్",
    bn: "জয়পুর",
    gu: "જયપુર",
    ml: "ജയ്പൂർ",
    pa: "ਜੈਪੁਰ",
    ur: "جے پور",
    or: "ଜୟପୁର",
  },
  surat: {
    en: "Surat",
    mr: "सुरत",
    hi: "सूरत",
    kn: "ಸೂರತ್",
    ta: "சூரத்",
    te: "సూరత్",
    bn: "সুরাট",
    gu: "સુરત",
    ml: "സൂററ്റ്",
    pa: "ਸੂਰਤ",
    ur: "سورت",
    or: "ସୁରଟ",
  },
  nagpur: {
    en: "Nagpur",
    mr: "नागपूर",
    hi: "नागपुर",
    kn: "ನಾಗಪುರ",
    ta: "நாக்பூர்",
    te: "నాగ్‌పూర్",
    bn: "নাগপুর",
    gu: "નાગપુર",
    ml: "നാഗ്പൂർ",
    pa: "ਨਾਗਪੁਰ",
    ur: "ناگپور",
    or: "ନାଗପୁର",
  },
  nashik: {
    en: "Nashik",
    mr: "नाशिक",
    hi: "नासिक",
    kn: "ನಾಸಿಕ್",
    ta: "நாசிக்",
    te: "నాసిక్",
    bn: "নাসিক",
    gu: "નાસિક",
    ml: "നാസിക്",
    pa: "ਨਾਸਿਕ",
    ur: "ناسک",
    or: "ନାସିକ",
  },
  katraj: {
    en: "Katraj",
    mr: "कात्रज",
    hi: "कात्रज",
    kn: "ಕಾತ್ರಾಜ್",
    ta: "காத்ராஜ்",
    te: "కాత్రాజ్",
    bn: "কাতরাজ",
    gu: "કાત્રજ",
    ml: "കാത്രാജ്",
    pa: "ਕਾਤਰਜ",
    ur: "کاترج",
    or: "କାତ୍ରାଜ",
  },
  kothrud: {
    en: "Kothrud",
    mr: "कोथरूड",
    hi: "कोथरुड",
    kn: "ಕೊತ್ರುಡ್",
    ta: "கோத்ருட்",
    te: "కొత్రుడ్",
    bn: "কোথরুদ",
    gu: "કોથરૂડ",
    ml: "കോത്രുഡ്",
    pa: "ਕੋਥਰੂਡ",
    ur: "کوتھرود",
    or: "କୋଥରୁଡ",
  },
  hadapsar: {
    en: "Hadapsar",
    mr: "हडपसर",
    hi: "हडपसर",
    kn: "ಹಡಪ್ಸರ್",
    ta: "ஹடப்சர்",
    te: "హడప్సర్",
    bn: "হাদাপসার",
    gu: "હડપસર",
    ml: "ഹഡപ്സർ",
    pa: "ਹੜੱਪਸਰ",
    ur: "ہڑپسر",
    or: "ହଡପସର",
  },
  shivajinagar: {
    en: "Shivajinagar",
    mr: "शिवाजीनगर",
    hi: "शिवाजीनगर",
    kn: "ಶಿವಾಜಿನಗರ",
    ta: "சிவாஜிநகர்",
    te: "శివాజీనగర్",
    bn: "শিবাজীনগর",
    gu: "શિવાજીનગર",
    ml: "ശിവാജിനഗർ",
    pa: "ਸ਼ਿਵਾਜੀਨਗਰ",
    ur: "శివాజీనగర్",
    or: "ଶିବାଜୀନଗର",
  },
  aundh: {
    en: "Aundh",
    mr: "औंध",
    hi: "औंध",
    kn: "ಔಂಧ್",
    ta: "ஔந்த்",
    te: "ఔంధ్",
    bn: "ঔন্ধ",
    gu: "ઔંધ",
    ml: "ഔന്ധ്",
    pa: "ਔਂਧ",
    ur: "اوندھ",
    or: "ଔନ୍ଧ",
  },
  baner: {
    en: "Baner",
    mr: "बाणेर",
    hi: "बानेर",
    kn: "ಬಾನೇರ್",
    ta: "பானேர்",
    te: "బానెర్",
    bn: "বানের",
    gu: "બાનેર",
    ml: "ബാനർ",
    pa: "ਬਾਨੇਰ",
    ur: "بانیر",
    or: "ବାନେର",
  },
  hinjewadi: {
    en: "Hinjewadi",
    mr: "हिंजवडी",
    hi: "हिंजवड़ी",
    kn: "ಹಿಂಜೇವಾಡಿ",
    ta: "ஹிஞ்சேவாடி",
    te: "హింజేవాడి",
    bn: "হিঞ্জেওয়াড়ি",
    gu: "હિંજવડી",
    ml: "ഹിഞ്ചേവാടി",
    pa: "ਹਿੰਜੇਵਾੜੀ",
    ur: "ہنجے واڑی",
    or: "ହିଞ୍ଜେୱାଡ଼ି",
  },
  viman_nagar: {
    en: "Viman Nagar",
    mr: "विमान नगर",
    hi: "विमान नगर",
    kn: "ವಿಮಾನ ನಗರ",
    ta: "விமான் நகர்",
    te: "విమాన్ నగర్",
    bn: "বিমান নগর",
    gu: "વિમાન નગર",
    ml: "വിമാൻ നഗർ",
    pa: "ਵਿਮਾਨ ਨਗਰ",
    ur: "ویمان نگر",
    or: "ବିମାନ ନଗର",
  },
};

/**
 * Localizes a single word or recognized token
 */
function translateToken(token: string, targetLocale: string): string {
  const clean = token.toLowerCase().trim();

  // 1. Check administrative terms
  if (ADMIN_TERMS[clean] && ADMIN_TERMS[clean][targetLocale]) {
    return ADMIN_TERMS[clean][targetLocale];
  }

  // 2. Check locality names
  if (LOCALITY_NAMES[clean] && LOCALITY_NAMES[clean][targetLocale]) {
    return LOCALITY_NAMES[clean][targetLocale];
  }

  // 3. Composite check (e.g. "Gokulnagar" = "gokul" + "nagar")
  for (const [key, map] of Object.entries(LOCALITY_NAMES)) {
    if (clean === key && map[targetLocale]) {
      return map[targetLocale];
    }
  }

  return token;
}

/**
 * Translates a complete location string (e.g. "Ward 1, Pune" or "Gokulnagar, Pune")
 * into the target language.
 */
export function formatLocalizedLocation(
  rawLocation: string | undefined | null,
  locale: string = "en",
  fallbackLocating: string = "Locating GPS..."
): string {
  if (!rawLocation) return "";
  if (rawLocation === "Locating GPS...") return fallbackLocating;
  if (locale === "en") return rawLocation;

  // Split by commas first to preserve structure
  const parts = rawLocation.split(",").map((p) => p.trim());

  const translatedParts = parts.map((part) => {
    // Check if the whole part has an exact match
    const fullClean = part.toLowerCase().replace(/\s+/g, "_");
    if (LOCALITY_NAMES[fullClean] && LOCALITY_NAMES[fullClean][locale]) {
      return LOCALITY_NAMES[fullClean][locale];
    }

    // Tokenize words and numbers
    const tokens = part.split(/(\s+)/);
    const translatedTokens = tokens.map((tok) => {
      if (/^\s+$/.test(tok)) return tok;
      return translateToken(tok, locale);
    });

    return translatedTokens.join("");
  });

  // For Urdu, comma is "، "
  const separator = locale === "ur" ? "، " : ", ";
  return translatedParts.join(separator);
}
