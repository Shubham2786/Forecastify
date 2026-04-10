const hi: Record<string, string> = {
  "nav.overview": "ओवरव्यू", "nav.jarvis": "जार्विस", "nav.demandSpikes": "डिमांड स्पाइक्स",
  "nav.productAnalysis": "प्रोडक्ट एनालिसिस", "nav.categoryAnalysis": "कैटेगरी एनालिसिस",
  "nav.purchaseList": "खरीदारी लिस्ट", "nav.forecasts": "फोरकास्ट", "nav.inventory": "इन्वेंटरी",
  "nav.alerts": "अलर्ट", "nav.settings": "सेटिंग्स", "nav.signOut": "लॉग आउट", "nav.addProduct": "प्रोडक्ट जोड़ें",

  "stat.expectedSales": "अगले 7 दिन की बिक्री", "stat.vsLastWeek": "पिछले हफ्ते से {{val}}%",
  "stat.totalProducts": "स्टोर में कुल प्रोडक्ट", "stat.stockValue": "{{val}} स्टॉक वैल्यू",
  "stat.accuracy": "प्रेडिक्शन एक्यूरेसी", "stat.unitsExpected": "{{val}} यूनिट इस हफ्ते बिकेंगे",
  "stat.alerts": "अलर्ट (ध्यान दो!)", "stat.alertBreakdown": "{{critical}} खतरा, {{low}} कम, {{overstock}} ज्यादा",

  "risk.stockoutTitle": "स्टॉक खत्म होने वाला", "risk.stockoutDesc": "3 दिन में खत्म हो सकते हैं",
  "risk.products": "{{val}} प्रोडक्ट", "risk.volatilityTitle": "डिमांड कितना बदलता है",
  "risk.volatilityHigh": "बहुत ज्यादा बदलाव", "risk.volatilityMed": "थोड़ा बदलाव", "risk.volatilityLow": "स्टेबल डिमांड",
  "risk.trendTitle": "इस हफ्ते का ट्रेंड", "risk.trendDesc": "पिछले हफ्ते से तुलना",
  "risk.overstockTitle": "एक्स्ट्रा स्टॉक (पैसा फंसा)", "risk.overstockDesc": "ज़रूरत से ज्यादा स्टॉक",

  "chart.forecastTitle": "अगले 7 दिन का फोरकास्ट (कुल {{count}} प्रोडक्ट)",
  "chart.forecastDesc": "नीला = अगले हफ्ते कितना बिकेगा | हरा = पिछले हफ्ते कितना बिका | नारंगी = कितना स्टॉक रखो",
  "chart.forecast": "फोरकास्ट", "chart.lastWeek": "पिछला हफ्ता", "chart.recommended": "रिकमेंडेड",
  "chart.categoryTitle": "कैटेगरी वाइज स्टॉक", "chart.categoryDesc": "किस कैटेगरी में कितना स्टॉक है",
  "chart.units": "यूनिट",

  "table.productInsights": "प्रोडक्ट की डिटेल", "table.topDemand": "सबसे ज्यादा बिकने वाले",
  "table.lowStock": "कम स्टॉक", "table.highValue": "सबसे महंगा स्टॉक", "table.recent": "नए प्रोडक्ट",
  "table.product": "प्रोडक्ट", "table.category": "कैटेगरी", "table.dailyDemand": "रोज़ाना डिमांड",
  "table.weekly": "हफ्ते भर", "table.stock": "स्टॉक", "table.daysLeft": "कितने दिन चलेगा",
  "table.needed": "और चाहिए", "table.qty": "मात्रा", "table.price": "कीमत", "table.status": "स्टेटस",
  "table.totalValue": "कुल वैल्यू", "table.noData": "कोई डेटा नहीं है", "table.day": "दिन", "table.days": "दिन",
  "table.moreNeeded": "{{val}} और चाहिए", "table.ok": "ठीक है",

  "status.critical": "खत्म!", "status.low": "कम है", "status.overstock": "बहुत ज्यादा", "status.optimal": "सही है",

  "biz.weatherTitle": "मौसम का असर", "biz.hotDays": "गर्मी में: avg {{val}} बिकता है",
  "biz.coldDays": "ठंड में: avg {{val}} बिकता है", "biz.promoTitle": "ऑफर्स का असर",
  "biz.promosRan": "{{val}} ऑफर चले", "biz.last30": "पिछले 30 दिन का डेटा",
  "biz.noPromos": "कोई ऑफर नहीं चला", "biz.eventsTitle": "आने वाले त्योहार",
  "biz.noEvents": "अगले 2 हफ्ते कोई इवेंट नहीं", "biz.patternsTitle": "बिक्री का पैटर्न",
  "biz.weekend": "वीकेंड (शनि-रवि)", "biz.weekday": "वीकडे (सोम-शुक्र)",
  "biz.avgPerProduct": "avg/प्रोडक्ट", "biz.weekendUplift": "वीकेंड में {{val}}% {{dir}} बिकता है",
  "biz.more": "ज्यादा", "biz.less": "कम", "biz.liveSignals": "लाइव सिग्नल",

  "risk.stockoutTableTitle": "स्टॉक खत्म होने का चांस",
  "risk.stockoutTableDesc": "ये प्रोडक्ट जल्दी खत्म हो सकते हैं — पहले ऑर्डर करो",
  "risk.dailyDemandCol": "रोज़ डिमांड", "risk.daysLeftCol": "कितने दिन चलेगा",
  "risk.probability": "खत्म होने का %", "risk.allSafe": "सब सेफ है! कोई प्रोडक्ट जल्दी खत्म नहीं होगा",
  "risk.volatilityTableTitle": "डिमांड कितना बदलता है (वोलैटिलिटी)",
  "risk.volatilityTableDesc": "जितना ज्यादा % उतना अनप्रेडिक्टेबल — ज्यादा बफर स्टॉक रखो",
  "risk.avgSales": "Avg बिक्री/दिन", "risk.volatility": "वोलैटिलिटी", "risk.level": "लेवल",
  "risk.highChange": "बहुत बदलता", "risk.medChange": "थोड़ा बदलता", "risk.stable": "स्टेबल",
  "risk.noHistoric": "हिस्टोरिक डेटा नहीं है अभी", "risk.records": "रेकॉर्ड्स",

  "data.lastUpdated": "अपडेट: {{time}}", "data.source": "डेटा: {{records}} बिक्री रेकॉर्ड {{city}} से | {{products}} प्रोडक्ट फोरकास्ट",
  "common.loading": "लोड हो रहा है...", "common.demand": "डिमांड", "common.din": "दिन",
  "groq.langInstruction": "Respond entirely in Hindi (हिन्दी).",
};
export default hi;
