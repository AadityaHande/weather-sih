/**
 * sync-secondary-i18n.js
 * Propagates nested weather components, activity rings, compass directions,
 * UV risk tags, humidity levels, condition maps, and time tags to all 11 locales.
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');

const EXTENSIONS = {
  hi: {
    common: {
      today: "आज",
      tomorrow: "कल",
      tonight: "आज रात",
      am: "पूर्वाह्न",
      pm: "अपराह्न"
    },
    weather: {
      windDirectionFormat: "{dir} दिशा ({deg}°)",
      windDirectionSimple: "{dir} दिशा",
      activityRings: {
        precipitationLabel: "वर्षा",
        precipitationSub: "बारिश की संभावना",
        humidityLabel: "आर्द्रता",
        humiditySub: "वायुमंडलीय नमी",
        windLabel: "हवा की गति",
        windSub: "सतही हवा"
      },
      forecastTabs: {
        temperature: "तापमान",
        precipitation: "वर्षा",
        wind: "हवा"
      },
      humidityStatuses: {
        humid: "आर्द्र",
        comfortable: "सुखद",
        dry: "शुष्क"
      },
      uvLevels: {
        low: "कम जोखिम",
        moderate: "मध्यम जोखिम",
        high: "उच्च जोखिम",
        veryHigh: "अत्यधिक जोखिम",
        extreme: "अति तीव्र",
        goodUv: "सुरक्षित यूवी"
      },
      directions: {
        N: "उत्तर", S: "दक्षिण", E: "पूर्व", W: "पश्चिम",
        NE: "उत्तर-पूर्व", NW: "उत्तर-पश्चिम", SE: "दक्षिण-पूर्व", SW: "दक्षिण-पश्चिम",
        NNE: "उत्तर-उत्तर-पूर्व", ENE: "पूर्व-उत्तर-पूर्व", ESE: "पूर्व-दक्षिण-पूर्व", SSE: "दक्षिण-दक्षिण-पूर्व",
        SSW: "दक्षिण-दक्षिण-पश्चिम", WSW: "पश्चिम-दक्षिण-पश्चिम", WNW: "पश्चिम-उत्तर-पश्चिम", NNW: "उत्तर-उत्तर-पश्चिम"
      },
      conditions: {
        clearDay: "साफ आसमान • धूप",
        clearNight: "साफ रात • तारे",
        partlyCloudyDay: "आंशिक बादल",
        partlyCloudyNight: "आंशिक बादल रात",
        overcast: "घने बादल",
        fog: "कोहरा / धुंध",
        drizzle: "बूंदाबांदी",
        rain: "बारिश",
        showers: "तेज बौछारें",
        thunderstorm: "आंधी-तूफान चेतावनी",
        snow: "बर्फबारी"
      }
    }
  },
  mr: {
    common: {
      today: "आज",
      tomorrow: "उद्या",
      tonight: "आज रात्री",
      am: "सकाळी",
      pm: "दुपारी"
    },
    weather: {
      windDirectionFormat: "{dir} दिशा ({deg}°)",
      windDirectionSimple: "{dir} दिशा",
      activityRings: {
        precipitationLabel: "पर्जन्यवृष्टी",
        precipitationSub: "पावसाची शक्यता",
        humidityLabel: "आर्द्रता",
        humiditySub: "वातावरणातील ओलावा",
        windLabel: "वाऱ्याचा वेग",
        windSub: "पृष्ठभागावरील वारे"
      },
      forecastTabs: {
        temperature: "तापमान",
        precipitation: "पाऊस",
        wind: "वारा"
      },
      humidityStatuses: {
        humid: "दमट",
        comfortable: "सुखद",
        dry: "कोरडे"
      },
      uvLevels: {
        low: "कमी जोखीम",
        moderate: "मध्यम जोखीम",
        high: "उच्च जोखीम",
        veryHigh: "अति उच्च जोखीम",
        extreme: "तीव्र",
        goodUv: "सुरक्षित यूवी"
      },
      directions: {
        N: "उत्तर", S: "दक्षिण", E: "पूर्व", W: "पश्चिम",
        NE: "ईशान्य", NW: "वायव्य", SE: "आग्नेय", SW: "नैऋत्य",
        NNE: "उत्तर-ईशान्य", ENE: "पूर्व-ईशान्य", ESE: "पूर्व-आग्नेय", SSE: "दक्षिण-आग्नेय",
        SSW: "दक्षिण-नैऋत्य", WSW: "पश्चिम-नैऋत्य", WNW: "पश्चिम-वायव्य", NNW: "उत्तर-वायव्य"
      },
      conditions: {
        clearDay: "निरभ्र आकाश • ऊन",
        clearNight: "निरभ्र रात्र • तारे",
        partlyCloudyDay: "अंशतः ढगाळ",
        partlyCloudyNight: "अंशतः ढगाळ रात्र",
        overcast: "ढगाळ वातावरण",
        fog: "धुके",
        drizzle: "रिमझिम पाऊस",
        rain: "पाऊस",
        showers: "पावसाच्या सरी",
        thunderstorm: "वादळी पाऊस चेतावणी",
        snow: "बर्फवृष्टी"
      }
    }
  },
  kn: {
    common: {
      today: "ಇಂದು",
      tomorrow: "ನಾಳೆ",
      tonight: "ಇಂದು ರಾತ್ರಿ",
      am: "ಬೆಳಿಗ್ಗೆ",
      pm: "ಸಂಜೆ"
    },
    weather: {
      windDirectionFormat: "{dir} ದಿಕ್ಕು ({deg}°)",
      windDirectionSimple: "{dir} ದಿಕ್ಕು",
      activityRings: {
        precipitationLabel: "ಮಳೆ ಪ್ರಮಾಣ",
        precipitationSub: "ಮಳೆಯ ಸಂಭವನೀಯತೆ",
        humidityLabel: "ಆರ್ದ್ರತೆ",
        humiditySub: "ವಾತಾವರಣದ ತೇವಾಂಶ",
        windLabel: "ಗಾಳಿಯ ವೇಗ",
        windSub: "ಮೇಲ್ಮೈ ಗಾಳಿ"
      },
      forecastTabs: {
        temperature: "ತಾಪಮಾನ",
        precipitation: "ಮಳೆ",
        wind: "ಗಾಳಿ"
      },
      humidityStatuses: {
        humid: "ಆರ್ದ್ರ",
        comfortable: "ಹಿತಕರ",
        dry: "ಶುಷ್ಕ"
      },
      uvLevels: {
        low: "ಕಡಿಮೆ ಅಪಾಯ",
        moderate: "ಮಧ್ಯಮ ಅಪಾಯ",
        high: "ಹೆಚ್ಚಿನ ಅಪಾಯ",
        veryHigh: "ಅತಿ ಹೆಚ್ಚು",
        extreme: "ತೀವ್ರ",
        goodUv: "ಉತ್ತಮ UV"
      },
      directions: {
        N: "ಉತ್ತರ", S: "ದಕ್ಷಿಣ", E: "ಪೂರ್ವ", W: "ಪಶ್ಚಿಮ",
        NE: "ಈಶಾನ್ಯ", NW: "ವಾಯುವ್ಯ", SE: "ಆಗ್ನೇಯ", SW: "ನೈಋತ್ಯ",
        NNE: "ಉತ್ತರ-ಈಶಾನ್ಯ", ENE: "ಪೂರ್ವ-ಈಶಾನ್ಯ", ESE: "ಪೂರ್ವ-ಆಗ್ನೇಯ", SSE: "ದಕ್ಷಿಣ-ಆಗ್ನೇಯ",
        SSW: "ದಕ್ಷಿಣ-ನೈಋತ್ಯ", WSW: "ಪಶ್ಚಿಮ-ನೈಋತ್ಯ", WNW: "ಪಶ್ಚಿಮ-ವಾಯುವ್ಯ", NNW: "ಉತ್ತರ-ವಾಯುವ್ಯ"
      },
      conditions: {
        clearDay: "ಸ್ವಚ್ಛ ಆಕಾಶ • ಬಿಸಿಲು",
        clearNight: "ಸ್ವಚ್ಛ ರಾತ್ರಿ • ತಾರೆಗಳು",
        partlyCloudyDay: "ಭಾಗಶಃ ಮೋಡ ಕವಿದಿದೆ",
        partlyCloudyNight: "ಭಾಗಶಃ ಮೋಡ ಕವಿದ ರಾತ್ರಿ",
        overcast: "ದಟ್ಟ ಮೋಡ ಕವಿದಿದೆ",
        fog: "ದಟ್ಟ ಮಂಜು",
        drizzle: "ತುಂತುರು ಮಳೆ",
        rain: "ಮಳೆ",
        showers: "ಮಳೆಯ ಸಿಂಚನ",
        thunderstorm: "ಗುಡುಗು ಸಹಿತ ಮಳೆ ಎಚ್ಚರಿಕೆ",
        snow: "ಹಿಮಪಾತ"
      }
    }
  },
  ta: {
    common: {
      today: "இன்று",
      tomorrow: "நாளை",
      tonight: "இன்று இரவு",
      am: "காலை",
      pm: "மாலை"
    },
    weather: {
      windDirectionFormat: "{dir} திசை ({deg}°)",
      windDirectionSimple: "{dir} திசை",
      activityRings: {
        precipitationLabel: "மழைப்பொழிவு",
        precipitationSub: "மழை வாய்ப்பு",
        humidityLabel: "ஈரப்பதம்",
        humiditySub: "வளிமண்டல ஈரப்பதம்",
        windLabel: "காற்றின் வேகம்",
        windSub: "தரைக்காற்று"
      },
      forecastTabs: {
        temperature: "வெப்பநிலை",
        precipitation: "மழை",
        wind: "காற்று"
      },
      humidityStatuses: {
        humid: "அதிக ஈரப்பதம்",
        comfortable: "சீரான நிலை",
        dry: "வறண்ட நிலை"
      },
      uvLevels: {
        low: "குறைந்த ஆபத்து",
        moderate: "மிதமான ஆபத்து",
        high: "அதிக ஆபத்து",
        veryHigh: "மிக அதிக ஆபத்து",
        extreme: "தீவிர நிலை",
        goodUv: "பாதுகாப்பான UV"
      },
      directions: {
        N: "வடக்கு", S: "தெற்கு", E: "கிழக்கு", W: "மேற்கு",
        NE: "வடகிழக்கு", NW: "வடமேற்கு", SE: "தென்கிழக்கு", SW: "தென்மேற்கு",
        NNE: "வட-வடகிழக்கு", ENE: "கிழக்கு-வடகிழக்கு", ESE: "கிழக்கு-தென்கிழக்கு", SSE: "தெற்கு-தென்கிழக்கு",
        SSW: "தெற்கு-தென்மேற்கு", WSW: "மேற்கு-தென்மேற்கு", WNW: "மேற்கு-வடமேற்கு", NNW: "வட-வடமேற்கு"
      },
      conditions: {
        clearDay: "தெளிவான வானம் • வெயில்",
        clearNight: "தெளிவான இரவு • நட்சத்திரங்கள்",
        partlyCloudyDay: "பகுதி மேகமூட்டம்",
        partlyCloudyNight: "பகுதி மேகமூட்டமான இரவு",
        overcast: "அடர்ந்த மேகமூட்டம்",
        fog: "பனிமூட்டம்",
        drizzle: "தூறல்",
        rain: "மழை",
        showers: "மழைச்சாரல்",
        thunderstorm: "இடியுடன் கூடிய புயல் எச்சரிக்கை",
        snow: "பனிப்பொழிவு"
      }
    }
  },
  te: {
    common: {
      today: "ఈరోజు",
      tomorrow: "రేపు",
      tonight: "ఈ రాత్రి",
      am: "ఉదయం",
      pm: "సాయంత్రం"
    },
    weather: {
      windDirectionFormat: "{dir} దిశ ({deg}°)",
      windDirectionSimple: "{dir} దిశ",
      activityRings: {
        precipitationLabel: "వర్షపాతం",
        precipitationSub: "వర్షం అవకాశం",
        humidityLabel: "తేమ",
        humiditySub: "వాతావరణ తేమ",
        windLabel: "గాలి వేగం",
        windSub: "ఉపరితల గాలులు"
      },
      forecastTabs: {
        temperature: "ఉష్ణోగ్రత",
        precipitation: "వర్షం",
        wind: "గాలి"
      },
      humidityStatuses: {
        humid: "తేమతో కూడిన",
        comfortable: "అనుకూలమైన",
        dry: "పొడి"
      },
      uvLevels: {
        low: "తక్కువ ప్రమాదం",
        moderate: "మితమైన ప్రమాదం",
        high: "అధిక ప్రమాదం",
        veryHigh: "చాలా ఎక్కువ",
        extreme: "తీవ్రమైన",
        goodUv: "మంచి UV"
      },
      directions: {
        N: "ఉత్తరం", S: "దక్షిణం", E: "తూర్పు", W: "పడమర",
        NE: "ఈశాన్యం", NW: "వాయువ్యం", SE: "ఆగ్నేయం", SW: "నైరుతి",
        NNE: "ఉత్తర-ఈశాన్యం", ENE: "తూర్పు-ఈశాన్యం", ESE: "తూర్పు-ఆగ్నేయం", SSE: "దక్షిణ-ఆగ్నేయం",
        SSW: "దక్షిణ-నైరుతి", WSW: "పడమర-నైరుతి", WNW: "పడమర-వాయువ్యం", NNW: "ఉత్తర-వాయువ్యం"
      },
      conditions: {
        clearDay: "నిర్మలమైన ఆకాశం • ఎండ",
        clearNight: "నిర్మలమైన రాత్రి • నక్షత్రాలు",
        partlyCloudyDay: "పాక్షికంగా మేఘావృతం",
        partlyCloudyNight: "పాక్షిక మేఘావృత రాత్రి",
        overcast: "దట్టమైన మేఘాలు",
        fog: "పొగమంచు",
        drizzle: "చిరుజల్లులు",
        rain: "వర్షం",
        showers: "వర్షపు జల్లులు",
        thunderstorm: "ఉరుములతో కూడిన వర్షం హెచ్చరిక",
        snow: "మంచుకురవడం"
      }
    }
  },
  bn: {
    common: {
      today: "আজ",
      tomorrow: "আগামীকাল",
      tonight: "আজ রাতে",
      am: "সকাল",
      pm: "সন্ধ্যা"
    },
    weather: {
      windDirectionFormat: "{dir} দিক ({deg}°)",
      windDirectionSimple: "{dir} দিক",
      activityRings: {
        precipitationLabel: "বৃষ্টিপাত",
        precipitationSub: "বৃষ্টির সম্ভাবনা",
        humidityLabel: "আর্দ্রতা",
        humiditySub: "বায়ুমণ্ডলীয় আর্দ্রতা",
        windLabel: "বাতাসের গতি",
        windSub: "পৃষ্ঠীয় বাতাস"
      },
      forecastTabs: {
        temperature: "তাপমাত্রা",
        precipitation: "বৃষ্টিপাত",
        wind: "বাতাস"
      },
      humidityStatuses: {
        humid: "আর্দ্র",
        comfortable: "আরামদায়ক",
        dry: "শুষ্ক"
      },
      uvLevels: {
        low: "কম ঝুঁকি",
        moderate: "মাঝারি ঝুঁকি",
        high: "উচ্চ ঝুঁকি",
        veryHigh: "অত্যধিক ঝুঁকি",
        extreme: "চরম",
        goodUv: "নিরাপদ UV"
      },
      directions: {
        N: "উত্তর", S: "দক্ষিণ", E: "পূর্ব", W: "পশ্চিম",
        NE: "উত্তর-পূর্ব", NW: "উত্তর-পশ্চিম", SE: "দক্ষিণ-পূর্ব", SW: "দক্ষিণ-পশ্চিম",
        NNE: "উত্তর-উত্তরপূর্ব", ENE: "পূর্ব-উত্তরপূর্ব", ESE: "পূর্ব-দক্ষিণপূর্ব", SSE: "দক্ষিণ-দক্ষিণপূর্ব",
        SSW: "দক্ষিণ-দক্ষিণপশ্চিম", WSW: "পশ্চিম-দক্ষিণপশ্চিম", WNW: "পশ্চিম-উত্তরপশ্চিম", NNW: "উত্তর-উত্তরপশ্চিম"
      },
      conditions: {
        clearDay: "পরিষ্কার আকাশ • রোদ",
        clearNight: "পরিষ্কার রাত • তারাময়",
        partlyCloudyDay: "আংশিক মেঘলা",
        partlyCloudyNight: "আংশিক মেঘলা রাত",
        overcast: "ঘন মেঘাচ্ছন্ন",
        fog: "কুয়াশা",
        drizzle: "ঝিরিঝিরি বৃষ্টি",
        rain: "বৃষ্টি",
        showers: "বৃষ্টির ঝাপটা",
        thunderstorm: "বজ্রঝড় সতর্কতা",
        snow: "তুষারপাত"
      }
    }
  },
  gu: {
    common: {
      today: "આજે",
      tomorrow: "આવતીકાલે",
      tonight: "આજે રાત્રે",
      am: "સવારે",
      pm: "સાંજે"
    },
    weather: {
      windDirectionFormat: "{dir} દિશા ({deg}°)",
      windDirectionSimple: "{dir} દિશા",
      activityRings: {
        precipitationLabel: "વરસાદનું પ્રમાણ",
        precipitationSub: "વરસાદની શક્યતા",
        humidityLabel: "ભેજ",
        humiditySub: "વાતાવરણીય ભેજ",
        windLabel: "પવનની ઝડપ",
        windSub: "સપાટી પરનો પવન"
      },
      forecastTabs: {
        temperature: "તાપમાન",
        precipitation: "વરસાદ",
        wind: "પવન"
      },
      humidityStatuses: {
        humid: "ભેજવાળું",
        comfortable: "સુખદ",
        dry: "સૂકું"
      },
      uvLevels: {
        low: "ઓછું જોખમ",
        moderate: "મધ્યમ જોખમ",
        high: "વધુ જોખમ",
        veryHigh: "ખૂબ વધુ જોખમ",
        extreme: "અત્યંત તીવ્ર",
        goodUv: "સુરક્ષિત UV"
      },
      directions: {
        N: "ઉત્તર", S: "દક્ષિણ", E: "પૂર્વ", W: "પશ્ચિમ",
        NE: "ઈશાન", NW: "વાયવ્ય", SE: "અગ્નિ", SW: "નૈઋત્ય",
        NNE: "ઉત્તર-ઈશાન", ENE: "પૂર્વ-ઈશાન", ESE: "પૂર્વ-અગ્નિ", SSE: "દક્ષિણ-અગ્નિ",
        SSW: "દક્ષિણ-નૈઋત્ય", WSW: "પશ્ચિમ-નૈઋત્ય", WNW: "પશ્ચિમ-વાયવ્ય", NNW: "ઉત્તર-વાયવ્ય"
      },
      conditions: {
        clearDay: "સ્વચ્છ આકાશ • તડકો",
        clearNight: "સ્વચ્છ રાત • તારામંડળ",
        partlyCloudyDay: "આંશિક વાદળછાયું",
        partlyCloudyNight: "આંશિક વાદળછાયી રાત",
        overcast: "વાદળછાયું વાતાવરણ",
        fog: "ધુમ્મસ",
        drizzle: "ઝરમર વરસાદ",
        rain: "વરસાદ",
        showers: "વરસાદી ઝાપટાં",
        thunderstorm: "વાવાઝોડાની ચેતવણી",
        snow: "બરફવર્ષા"
      }
    }
  },
  ml: {
    common: {
      today: "ഇന്ന്",
      tomorrow: "നാളെ",
      tonight: "ഇന്ന് രാത്രി",
      am: "രാവിലെ",
      pm: "വൈകുന്നേരം"
    },
    weather: {
      windDirectionFormat: "{dir} ദിശ ({deg}°)",
      windDirectionSimple: "{dir} ദിശ",
      activityRings: {
        precipitationLabel: "മഴയുടെ അളവ്",
        precipitationSub: "മഴ സാധ്യത",
        humidityLabel: "ഈർപ്പം",
        humiditySub: "അന്തരീക്ഷ ഈർപ്പം",
        windLabel: "കാറ്റിന്റെ വേഗത",
        windSub: "ഉപരിതല കാറ്റ്"
      },
      forecastTabs: {
        temperature: "താപനില",
        precipitation: "മഴ",
        wind: "കാറ്റ്"
      },
      humidityStatuses: {
        humid: "ഈർപ്പമുള്ളത്",
        comfortable: "സുഖകരമായത്",
        dry: "വരണ്ടത്"
      },
      uvLevels: {
        low: "കുറഞ്ഞ സാധ്യത",
        moderate: "മിതമായ സാധ്യത",
        high: "കൂടിയ സാധ്യത",
        veryHigh: "വളരെ കൂടുതൽ",
        extreme: "തീവ്രമായത്",
        goodUv: "സുരക്ഷിതമായ UV"
      },
      directions: {
        N: "വടക്ക്", S: "തെക്ക്", E: "കിഴക്ക്", W: "പടിഞ്ഞാറ്",
        NE: "വടക്കുകിഴക്ക്", NW: "വടക്കുപടിഞ്ഞാറ്", SE: "തെക്കുകിഴക്ക്", SW: "തെക്കുപടിഞ്ഞാറ്",
        NNE: "വടക്ക്-വടക്കുകിഴക്ക്", ENE: "കിഴക്ക്-വടക്കുകിഴക്ക്", ESE: "കിഴക്ക്-തെക്കുകിഴക്ക്", SSE: "തെക്ക്-തെക്കുകിഴക്ക്",
        SSW: "തെക്ക്-തെക്കുപടിഞ്ഞാറ്", WSW: "പടിഞ്ഞാറ്-തെക്കുപടിഞ്ഞാറ്", WNW: "പടിഞ്ഞാറ്-വടക്കുപടിഞ്ഞാറ്", NNW: "വടക്ക്-വടക്കുപടിഞ്ഞാറ്"
      },
      conditions: {
        clearDay: "തെളിഞ്ഞ ആകാശം • വെയിൽ",
        clearNight: "തെളിഞ്ഞ രാത്രി • നക്ഷത്രങ്ങൾ",
        partlyCloudyDay: "ഭാഗികമായി മേഘാവൃതം",
        partlyCloudyNight: "ഭാഗിക മേഘാവൃത രാത്രി",
        overcast: "മൂടിക്കെട്ടിയ ആകാശം",
        fog: "മഞ്ഞ്",
        drizzle: "ചാറ്റൽമഴ",
        rain: "മഴ",
        showers: "മഴക്കാറ്റ്",
        thunderstorm: "ഇടിമിന്നലോടുകൂടിയ കൊടുങ്കാറ്റ് മുന്നറിയിപ്പ്",
        snow: "മഞ്ഞുവീഴ്ച"
      }
    }
  },
  pa: {
    common: {
      today: "ਅੱਜ",
      tomorrow: "ਕੱਲ੍ਹ",
      tonight: "ਅੱਜ ਰਾਤ",
      am: "ਸਵੇਰੇ",
      pm: "ਸ਼ਾਮ"
    },
    weather: {
      windDirectionFormat: "{dir} ਦਿਸ਼ਾ ({deg}°)",
      windDirectionSimple: "{dir} ਦਿਸ਼ਾ",
      activityRings: {
        precipitationLabel: "ਮੀਂਹ ਦੀ ਮਾਤਰਾ",
        precipitationSub: "ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ",
        humidityLabel: "ਨਮੀ",
        humiditySub: "ਵਾਯੂਮੰਡਲੀ ਨਮੀ",
        windLabel: "ਹਵਾ ਦੀ ਗਤੀ",
        windSub: "ਸਤਹੀ ਹਵਾ"
      },
      forecastTabs: {
        temperature: "ਤਾਪਮਾਨ",
        precipitation: "ਮੀਂਹ",
        wind: "ਹਵਾ"
      },
      humidityStatuses: {
        humid: "ਨਮੀ ਵਾਲਾ",
        comfortable: "ਸੁਹਾਵਣਾ",
        dry: "ਖੁਸ਼ਕ"
      },
      uvLevels: {
        low: "ਘੱਟ ਖਤਰਾ",
        moderate: "ਦਰਮਿਆਨਾ ਖਤਰਾ",
        high: "ਉੱਚ ਖਤਰਾ",
        veryHigh: "ਬਹੁਤ ਜ਼ਿਆਦਾ",
        extreme: "ਬਹੁਤ ਤਿੱਖਾ",
        goodUv: "ਚੰਗੀ ਯੂਵੀ"
      },
      directions: {
        N: "ਉੱਤਰ", S: "ਦੱਖਣ", E: "ਪੂਰਬ", W: "ਪੱਛਮ",
        NE: "ਉੱਤਰ-ਪੂਰਬ", NW: "ਉੱਤਰ-ਪੱਛਮ", SE: "ਦੱਖਣ-ਪੂਰਬ", SW: "ਦੱਖਣ-ਪੱਛਮ",
        NNE: "ਉੱਤਰ-ਉੱਤਰਪੂਰਬ", ENE: "ਪੂਰਬ-ਉੱਤਰਪੂਰਬ", ESE: "ਪੂਰਬ-ਦੱਖਣਪੂਰਬ", SSE: "ਦੱਖਣ-ਦੱਖਣਪੂਰਬ",
        SSW: "ਦੱਖਣ-ਦੱਖਣਪੱਛਮ", WSW: "ਪੱਛਮ-ਦੱਖਣਪੱਛਮ", WNW: "ਪੱਛਮ-ਉੱਤਰਪੱਛਮ", NNW: "ਉੱਤਰ-ਉੱਤਰਪੱਛਮ"
      },
      conditions: {
        clearDay: "ਸਾਫ਼ ਅਸਮਾਨ • ਧੁੱਪ",
        clearNight: "ਸਾਫ਼ ਰਾਤ • ਤਾਰੇ",
        partlyCloudyDay: "ਅੰਸ਼ਕ ਤੌਰ 'ਤੇ ਬੱਦਲਵਾਈ",
        partlyCloudyNight: "ਅੰਸ਼ਕ ਬੱਦਲਵਾਈ ਰਾਤ",
        overcast: "ਭਾਰੀ ਬੱਦਲਵਾਈ",
        fog: "ਧੁੰਦ",
        drizzle: "ਬੂੰਦਾਬਾਂਦੀ",
        rain: "ਮੀਂਹ",
        showers: "ਮੀਂਹ ਦੇ ਛਿੱਟੇ",
        thunderstorm: "ਤੂਫ਼ਾਨ ਦੀ ਚੇਤਾਵਨੀ",
        snow: "ਬਰਫ਼ਬਾਰੀ"
      }
    }
  },
  ur: {
    common: {
      today: "آج",
      tomorrow: "کل",
      tonight: "آج رات",
      am: "صبح",
      pm: "شام"
    },
    weather: {
      windDirectionFormat: "{dir} سمت ({deg}°)",
      windDirectionSimple: "{dir} سمت",
      activityRings: {
        precipitationLabel: "بارش کا تناسب",
        precipitationSub: "بارش کا امکان",
        humidityLabel: "نمی",
        humiditySub: "فضائی نمی",
        windLabel: "ہوا کی رفتار",
        windSub: "سطحی ہوائیں"
      },
      forecastTabs: {
        temperature: "درجہ حرارت",
        precipitation: "بارش",
        wind: "ہوا"
      },
      humidityStatuses: {
        humid: "مرطوب",
        comfortable: "خوشگوار",
        dry: "خشک"
      },
      uvLevels: {
        low: "کم خطرہ",
        moderate: "معتدل خطرہ",
        high: "زیادہ خطرہ",
        veryHigh: "بہت زیادہ خطرہ",
        extreme: "شدید",
        goodUv: "محفوظ یو وی"
      },
      directions: {
        N: "شمال", S: "جنوب", E: "مشرق", W: "مغرب",
        NE: "شمال مشرق", NW: "شمال مغرب", SE: "جنوب مشرق", SW: "جنوب مغرب",
        NNE: "شمال-شمال مشرق", ENE: "مشرق-شمال مشرق", ESE: "مشرق-جنوب مشرق", SSE: "جنوب-جنوب مشرق",
        SSW: "جنوب-جنوب مغرب", WSW: "مغرب-جنوب مغرب", WNW: "مغرب-شمال مغرب", NNW: "شمال-شمال مغرب"
      },
      conditions: {
        clearDay: "صاف آسمان • دھوپ",
        clearNight: "صاف رات • تارے",
        partlyCloudyDay: "جزوی ابر آلود",
        partlyCloudyNight: "جزوی ابر آلود رات",
        overcast: "مکمل ابر آلود",
        fog: "دھند",
        drizzle: "بونداباندی",
        rain: "بارش",
        showers: "تیز بارش کی پھوار",
        thunderstorm: "گرج چمک کے ساتھ طوفان کی وارننگ",
        snow: "برف باری"
      }
    }
  },
  or: {
    common: {
      today: "ଆଜି",
      tomorrow: "ଆସନ୍ତାକାଲି",
      tonight: "ଆଜି ରାତି",
      am: "ପୂର୍ବାହ୍ନ",
      pm: "ଅପରାହ୍ନ"
    },
    weather: {
      windDirectionFormat: "{dir} ଦିଗ ({deg}°)",
      windDirectionSimple: "{dir} ଦିଗ",
      activityRings: {
        precipitationLabel: "ବୃଷ୍ଟିପାତ",
        precipitationSub: "ବର୍ଷା ସମ୍ଭାବନା",
        humidityLabel: "ଆର୍ଦ୍ରତା",
        humiditySub: "ବାୟୁମଣ୍ଡଳୀୟ ଆର୍ଦ୍ରତା",
        windLabel: "ପବନ ବେଗ",
        windSub: "ଭୂପୃଷ୍ଠ ପବନ"
      },
      forecastTabs: {
        temperature: "ତାପମାତ୍ରା",
        precipitation: "ବର୍ଷା",
        wind: "ପବନ"
      },
      humidityStatuses: {
        humid: "ଆର୍ଦ୍ର",
        comfortable: "ଆରାମଦାୟକ",
        dry: "ଶୁଷ୍କ"
      },
      uvLevels: {
        low: "କମ୍ ବିପଦ",
        moderate: "ମଧ୍ୟମ ବିପଦ",
        high: "ଅଧିକ ବିପଦ",
        veryHigh: "ଅତ୍ୟଧିକ ବିପଦ",
        extreme: "ତୀବ୍ର",
        goodUv: "ନିରାପଦ UV"
      },
      directions: {
        N: "ଉତ୍ତର", S: "ଦକ୍ଷିଣ", E: "ପୂର୍ବ", W: "ପଶ୍ଚିମ",
        NE: "ଉତ୍ତର-ପୂର୍ବ", NW: "ଉତ୍ତର-ପଶ୍ଚିମ", SE: "ଦକ୍ଷିଣ-ପୂର୍ବ", SW: "ଦକ୍ଷିଣ-ପଶ୍ଚିମ",
        NNE: "ଉତ୍ତର-ଉତ୍ତରପୂର୍ବ", ENE: "ପୂର୍ବ-ଉତ୍ତରପୂର୍ବ", ESE: "ପୂର୍ବ-ଦକ୍ଷିଣପୂର୍ବ", SSE: "ଦକ୍ଷିଣ-ଦକ୍ଷିଣପୂର୍ବ",
        SSW: "ଦକ୍ଷିଣ-ଦକ୍ଷିଣପଶ୍ଚିମ", WSW: "ପଶ୍ଚିମ-ଦକ୍ଷିଣପଶ୍ଚିମ", WNW: "ପଶ୍ଚିମ-ଉତ୍ତରପଶ୍ଚିମ", NNW: "ଉତ୍ତର-ଉତ୍ତରପଶ୍ଚିମ"
      },
      conditions: {
        clearDay: "ପରିଷ୍କାର ଆକାଶ • ଖରା",
        clearNight: "ପରିଷ୍କାର ରାତି • ତାରକା",
        partlyCloudyDay: "ଆଂଶିକ ମେଘୁଆ",
        partlyCloudyNight: "ଆଂଶିକ ମେଘୁଆ ରାତି",
        overcast: "ଘନ ମେଘାଚ୍ଛନ୍ନ",
        fog: "କୁହୁଡ଼ି",
        drizzle: "ଝିପିଝିପି ବର୍ଷା",
        rain: "ବର୍ଷା",
        showers: "ବର୍ଷା ଝଟକା",
        thunderstorm: "ବଜ୍ରପାତ ସତର୍କତା",
        snow: "ତୁଷାରପାତ"
      }
    }
  }
};

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }
  Object.assign(target || {}, source);
  return target;
}

for (const [lang, ext] of Object.entries(EXTENSIONS)) {
  const filePath = path.join(MESSAGES_DIR, `${lang}.json`);
  if (fs.existsSync(filePath)) {
    const orig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const merged = deepMerge(orig, ext);
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`Merged extensions into ${lang}.json`);
  }
}
console.log('All 11 languages updated successfully!');
