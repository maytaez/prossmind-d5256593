/**
 * Simple language detection based on common patterns and keywords
 * Returns ISO 639-1 language code (e.g., 'en', 'es', 'fr', 'de', etc.)
 * Falls back to 'en' if language cannot be determined
 */

export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) {
    return 'en';
  }

  const normalizedText = text.toLowerCase();
  
  // Check for German-specific characters and common words first (more reliable)
  // German has umlauts (ä, ö, ü) and ß which are strong indicators
  if (/[äöüßÄÖÜ]/.test(text)) {
    return 'de';
  }
  
  // Common language patterns - expanded with more common words
  const languagePatterns: Record<string, RegExp[]> = {
    'es': [/\b(es|está|están|con|para|por|del|la|el|de|en|un|una|son|ser|hacer|tiene|tener|proceso|diagrama|crear|generar)\b/i],
    'fr': [/\b(est|sont|avec|pour|par|du|la|le|de|en|un|une|sont|être|faire|a|avoir|processus|diagramme|créer|générer)\b/i],
    'de': [
      // Very common German words
      /\b(ist|sind|mit|für|von|der|die|das|dem|den|des|ein|eine|einen|einem|einer|und|oder|wenn|dann|aber|auch|nicht|wird|werden|kann|können|soll|sollen|muss|müssen|hat|haben|sein|machen|gehen|kommen|sehen|wissen|geben|nehmen|finden|stehen|liegen|sitzen|bleiben|kommen|gehen|sagen|sprechen|denken|glauben|wollen|möchten|dürfen|sollen)\b/i,
      // Process-related German words
      /\b(prozess|prozesse|diagramm|diagramme|erstellen|erzeugen|generieren|kreieren|anlegen|definieren|beschreiben|ablauf|abläufe|verfahren|vorgang|vorgänge|workflow|workflows|schritt|schritte|aktivität|aktivitäten|aufgabe|aufgaben|ereignis|ereignisse|entscheidung|entscheidungen|start|anfang|beginn|ende|schluss|benutzer|system|manuell|gateway|gateways|parallel|sequenz|sequenzen|bpmn|kunde|kunden|bestellung|bestellungen|genehmigung|genehmigungen|zahlung|zahlungen|lieferung|lieferungen|rechnung|rechnungen|produkt|produkte|service|services|anfrage|anfragen|antwort|antworten|formular|formulare|dokument|dokumente|daten|information|informationen)\b/i
    ],
    'it': [/\b(è|sono|con|per|da|del|la|il|di|in|un|una|sono|essere|fare|ha|avere|processo|diagramma|creare|generare)\b/i],
    'pt': [/\b(é|são|com|para|por|do|da|de|em|um|uma|são|ser|fazer|tem|ter|processo|diagrama|criar|gerar)\b/i],
    'ru': [/\b(есть|с|для|от|в|на|процесс|диаграмма|создать|генерировать|начать|конец|задача)\b/i],
    'ja': [/\b(は|が|を|に|で|プロセス|図|作成|生成|開始|終了|タスク)\b/i],
    'ko': [/\b(은|는|을|를|에|에서|프로세스|다이어그램|생성|시작|종료|작업)\b/i],
    'zh': [/\b(是|的|在|和|过程|图表|创建|生成|开始|结束|任务)\b/i],
    'ar': [/\b(هو|هي|مع|ل|من|في|عملية|رسم|إنشاء|بداية|نهاية|مهمة)\b/i],
    'hi': [/\b(है|के|से|में|प्रक्रिया|आरेख|बनाएं|शुरू|अंत|कार्य)\b/i],
  };

  // Count matches for each language
  const scores: Record<string, number> = {};
  
  for (const [lang, patterns] of Object.entries(languagePatterns)) {
    scores[lang] = 0;
    for (const pattern of patterns) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        scores[lang] += matches.length;
      }
    }
  }

  // Find language with highest score
  let maxScore = 0;
  let detectedLang = 'en';
  
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang;
    }
  }

  // If no strong match found, check for specific character sets
  if (maxScore === 0) {
    // Check for Chinese/Japanese/Korean characters
    if (/[\u4e00-\u9fff]/.test(text)) {
      return 'zh';
    }
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return 'ja';
    }
    if (/[\uac00-\ud7af]/.test(text)) {
      return 'ko';
    }
    // Check for Arabic/Hebrew (RTL scripts)
    if (/[\u0600-\u06ff]/.test(text)) {
      return 'ar';
    }
    // Check for Cyrillic
    if (/[\u0400-\u04ff]/.test(text)) {
      return 'ru';
    }
    // Check for Devanagari (Hindi)
    if (/[\u0900-\u097f]/.test(text)) {
      return 'hi';
    }
  }

  return detectedLang;
}

/**
 * Get language name for display in prompts
 */
export function getLanguageName(langCode: string): string {
  const languageNames: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
  };
  
  return languageNames[langCode] || 'English';
}

