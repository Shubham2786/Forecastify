import en from "./en";
import hi from "./hi";

// Regional languages — inherit from English, override key labels
function makeLang(overrides: Record<string, string>): Record<string, string> {
  return { ...en, ...overrides };
}

const mr = makeLang({
  "nav.overview": "ओव्हरव्ह्यू", "nav.purchaseList": "खरेदी यादी", "nav.marketInsights": "मार्केट इनसाइट्स",
  "nav.modelAccuracy": "मॉडेल अचूकता", "nav.expiryRisk": "एक्सपायरी रिस्क", "nav.inventoryHealth": "हेल्थ स्कोअर", "nav.reorderPlanner": "रीऑर्डर प्लॅनर",
  "nav.forecasts": "अंदाज",
  "nav.inventory": "इन्व्हेंटरी", "nav.alerts": "सूचना", "nav.settings": "सेटिंग्ज",
  "nav.signOut": "बाहेर पडा", "nav.addProduct": "प्रॉडक्ट जोडा",
  "stat.expectedSales": "पुढील 7 दिवसांची विक्री", "stat.vsLastWeek": "मागील आठवड्यापेक्षा {{val}}%",
  "stat.totalProducts": "दुकानातील एकूण प्रॉडक्ट", "stat.stockValue": "{{val}} एकूण स्टॉक किंमत",
  "stat.accuracy": "अंदाज अचूकता", "stat.alerts": "सूचना (लक्ष द्या!)",
  "risk.stockoutTitle": "स्टॉक संपणार", "risk.stockoutDesc": "3 दिवसांत संपू शकतात",
  "risk.volatilityTitle": "मागणी किती बदलते", "risk.trendTitle": "या आठवड्याचा ट्रेंड",
  "risk.overstockTitle": "अतिरिक्त स्टॉक (पैसे अडकले)",
  "chart.forecastTitle": "पुढील 7 दिवसांचा अंदाज (एकूण {{count}} प्रॉडक्ट)",
  "chart.categoryTitle": "कॅटेगरी प्रमाणे स्टॉक",
  "table.productInsights": "प्रॉडक्ट तपशील", "table.topDemand": "सर्वाधिक विकले जाणारे",
  "table.lowStock": "कमी स्टॉक", "table.highValue": "महाग स्टॉक", "table.recentlyAdded": "नुकतेच जोडलेले",
  "status.critical": "संपले!", "status.low": "कमी आहे", "status.overstock": "खूप जास्त", "status.optimal": "योग्य",
  "biz.weatherTitle": "हवामानाचा परिणाम", "biz.promoTitle": "ऑफरचा परिणाम",
  "biz.eventsTitle": "येणारे सण", "biz.patternsTitle": "विक्रीचा पॅटर्न",
  "risk.stockoutTableTitle": "स्टॉक संपण्याची शक्यता",
  "risk.volatilityTableTitle": "मागणी किती बदलते (व्होलॅटिलिटी)",
  "groq.langInstruction": "Respond entirely in Marathi (मराठी).",
});

const ta = makeLang({
  "nav.overview": "மேலோட்டம்", "nav.purchaseList": "கொள்முதல் பட்டியல்", "nav.marketInsights": "சந்தை நுண்ணறிவு",
  "nav.modelAccuracy": "மாடல் துல்லியம்", "nav.expiryRisk": "காலாவதி ஆபத்து", "nav.inventoryHealth": "ஹெல்த் ஸ்கோர்", "nav.reorderPlanner": "மறு ஆர்டர்",
  "nav.inventory": "சரக்கு", "nav.alerts": "எச்சரிக்கைகள்", "nav.settings": "அமைப்புகள்",
  "nav.signOut": "வெளியேறு", "nav.addProduct": "பொருள் சேர்",
  "stat.expectedSales": "எதிர்பார்க்கப்படும் விற்பனை (7 நாள்)", "stat.totalProducts": "மொத்த பொருட்கள்",
  "stat.accuracy": "கணிப்பு துல்லியம்", "stat.alerts": "எச்சரிக்கைகள் (கவனம்!)",
  "risk.stockoutTitle": "சரக்கு தீர்ந்துவிடும்", "risk.volatilityTitle": "தேவை மாற்ற விகிதம்",
  "risk.trendTitle": "இந்த வார போக்கு", "risk.overstockTitle": "அதிக சரக்கு",
  "status.critical": "தீர்ந்தது!", "status.low": "குறைவு", "status.overstock": "அதிகம்", "status.optimal": "நல்லது",
  "biz.weatherTitle": "வானிலை தாக்கம்", "biz.eventsTitle": "வரும் திருவிழாக்கள்",
  "groq.langInstruction": "Respond entirely in Tamil (தமிழ்).",
});

const te = makeLang({
  "nav.overview": "అవలోకనం", "nav.purchaseList": "కొనుగోలు జాబితా", "nav.marketInsights": "మార్కెట్ ఇన్‌సైట్స్",
  "nav.modelAccuracy": "మోడల్ ఖచ్చితత్వం", "nav.expiryRisk": "ఎక్స్‌పైరీ రిస్క్", "nav.inventoryHealth": "హెల్త్ స్కోర్", "nav.reorderPlanner": "రీఆర్డర్ ప్లానర్",
  "nav.inventory": "ఇన్వెంటరీ", "nav.alerts": "హెచ్చరికలు", "nav.settings": "సెట్టింగ్‌లు",
  "nav.signOut": "లాగ్ అవుట్", "nav.addProduct": "ఉత్పత్తి జోడించు",
  "stat.expectedSales": "ఊహించిన అమ్మకాలు (7 రోజులు)", "stat.totalProducts": "మొత్తం ఉత్పత్తులు",
  "stat.accuracy": "అంచనా ఖచ్చితత్వం", "stat.alerts": "హెచ్చరికలు (దృష్టి పెట్టండి!)",
  "risk.stockoutTitle": "స్టాక్ అయిపోతుంది", "risk.volatilityTitle": "డిమాండ్ మార్పు రేటు",
  "risk.trendTitle": "ఈ వారం ట్రెండ్", "risk.overstockTitle": "అధిక స్టాక్",
  "status.critical": "అయిపోయింది!", "status.low": "తక్కువ", "status.overstock": "ఎక్కువ", "status.optimal": "బాగుంది",
  "biz.weatherTitle": "వాతావరణ ప్రభావం", "biz.eventsTitle": "రాబోయే పండుగలు",
  "groq.langInstruction": "Respond entirely in Telugu (తెలుగు).",
});

const kn = makeLang({
  "nav.overview": "ಅವಲೋಕನ", "nav.purchaseList": "ಖರೀದಿ ಪಟ್ಟಿ", "nav.marketInsights": "ಮಾರುಕಟ್ಟೆ ಒಳನೋಟಗಳು",
  "nav.modelAccuracy": "ಮಾಡೆಲ್ ನಿಖರತೆ", "nav.expiryRisk": "ಎಕ್ಸ್‌ಪೈರಿ ಅಪಾಯ", "nav.inventoryHealth": "ಹೆಲ್ತ್ ಸ್ಕೋರ್", "nav.reorderPlanner": "ರೀಆರ್ಡರ್ ಪ್ಲಾನರ್",
  "nav.inventory": "ಸರಕು", "nav.alerts": "ಎಚ್ಚರಿಕೆ", "nav.settings": "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
  "nav.signOut": "ಲಾಗ್ ಔಟ್", "nav.addProduct": "ಉತ್ಪನ್ನ ಸೇರಿಸಿ",
  "stat.expectedSales": "ನಿರೀಕ್ಷಿತ ಮಾರಾಟ (7 ದಿನ)", "stat.totalProducts": "ಒಟ್ಟು ಉತ್ಪನ್ನಗಳು",
  "stat.accuracy": "ಮುನ್ಸೂಚನೆ ನಿಖರತೆ", "stat.alerts": "ಎಚ್ಚರಿಕೆಗಳು (ಗಮನ!)",
  "risk.stockoutTitle": "ಸ್ಟಾಕ್ ಮುಗಿಯುತ್ತಿದೆ", "risk.volatilityTitle": "ಬೇಡಿಕೆ ಬದಲಾವಣೆ",
  "status.critical": "ಮುಗಿದಿದೆ!", "status.low": "ಕಡಿಮೆ", "status.overstock": "ಹೆಚ್ಚು", "status.optimal": "ಸರಿ",
  "biz.weatherTitle": "ಹವಾಮಾನ ಪರಿಣಾಮ", "biz.eventsTitle": "ಬರಲಿರುವ ಹಬ್ಬಗಳು",
  "groq.langInstruction": "Respond entirely in Kannada (ಕನ್ನಡ).",
});

const bn = makeLang({
  "nav.overview": "ওভারভিউ", "nav.purchaseList": "কেনাকাটার তালিকা", "nav.marketInsights": "মার্কেট ইনসাইটস",
  "nav.modelAccuracy": "মডেল নির্ভুলতা", "nav.expiryRisk": "মেয়াদ ঝুঁকি", "nav.inventoryHealth": "হেলথ স্কোর", "nav.reorderPlanner": "রিঅর্ডার প্ল্যানার",
  "nav.inventory": "মজুত", "nav.alerts": "সতর্কতা", "nav.settings": "সেটিংস",
  "nav.signOut": "লগ আউট", "nav.addProduct": "পণ্য যোগ করুন",
  "stat.expectedSales": "প্রত্যাশিত বিক্রি (৭ দিন)", "stat.totalProducts": "মোট পণ্য",
  "stat.accuracy": "পূর্বাভাস নির্ভুলতা", "stat.alerts": "সতর্কতা (মনোযোগ দিন!)",
  "risk.stockoutTitle": "স্টক শেষ হচ্ছে", "risk.volatilityTitle": "চাহিদা পরিবর্তনের হার",
  "status.critical": "শেষ!", "status.low": "কম", "status.overstock": "বেশি", "status.optimal": "ঠিক আছে",
  "biz.weatherTitle": "আবহাওয়ার প্রভাব", "biz.eventsTitle": "আসন্ন উৎসব",
  "groq.langInstruction": "Respond entirely in Bengali (বাংলা).",
});

const gu = makeLang({
  "nav.overview": "ઓવરવ્યૂ", "nav.purchaseList": "ખરીદી યાદી", "nav.marketInsights": "માર્કેટ ઇનસાઇટ્સ",
  "nav.modelAccuracy": "મોડેલ ચોકસાઈ", "nav.expiryRisk": "એક્સપાયરી રિસ્ક", "nav.inventoryHealth": "હેલ્થ સ્કોર", "nav.reorderPlanner": "રીઓર્ડર પ્લાનર",
  "nav.inventory": "ઇન્વેન્ટરી", "nav.alerts": "ચેતવણી", "nav.settings": "સેટિંગ્સ",
  "nav.signOut": "લોગ આઉટ", "nav.addProduct": "ઉત્પાદન ઉમેરો",
  "stat.expectedSales": "અપેક્ષિત વેચાણ (7 દિવસ)", "stat.totalProducts": "કુલ ઉત્પાદનો",
  "stat.accuracy": "આગાહી ચોકસાઈ", "stat.alerts": "ચેતવણી (ધ્યાન આપો!)",
  "risk.stockoutTitle": "સ્ટોક ખતમ થશે", "risk.volatilityTitle": "માંગ ફેરફાર દર",
  "status.critical": "ખતમ!", "status.low": "ઓછું", "status.overstock": "વધારે", "status.optimal": "બરાબર",
  "biz.weatherTitle": "હવામાનની અસર", "biz.eventsTitle": "આવનારા તહેવારો",
  "groq.langInstruction": "Respond entirely in Gujarati (ગુજરાતી).",
});

export type LangCode = "en" | "hi" | "mr" | "ta" | "te" | "kn" | "bn" | "gu";

export const LANGUAGES: { code: LangCode; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
];

const allTranslations: Record<LangCode, Record<string, string>> = { en, hi, mr, ta, te, kn, bn, gu };

export function getTranslation(lang: LangCode, key: string, vars?: Record<string, string | number>): string {
  let text = allTranslations[lang]?.[key] || allTranslations.en[key] || key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => { text = text.replace(`{{${k}}}`, String(v)); });
  }
  return text;
}

export function getGroqLangInstruction(lang: LangCode): string {
  return allTranslations[lang]?.["groq.langInstruction"] || "Respond entirely in English.";
}

export default allTranslations;
