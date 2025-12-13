/**
 * Simple language detection based on common patterns and keywords
 * Returns ISO 639-1 language code (e.g., 'en', 'es', 'fr', 'de', etc.)
 * Falls back to 'en' if language cannot be determined
 */

export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) {
    return "en";
  }

  const normalizedText = text.toLowerCase();

  // STRATEGY: Default to English unless there are VERY STRONG signals of another language
  // Only check for other languages if user has special characters or many language-specific keywords

  // 1. Check for language-specific characters (strongest signal)

  // German umlauts and ß
  if (/[äöüßÄÖÜ]/.test(text)) {
    console.log("[Language Detection] German detected (special characters)");
    return "de";
  }

  // Chinese/Japanese/Korean characters
  if (/[\u4e00-\u9fff]/.test(text)) {
    console.log("[Language Detection] Chinese detected (CJK characters)");
    return "zh";
  }
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
    console.log("[Language Detection] Japanese detected (Hiragana/Katakana)");
    return "ja";
  }
  if (/[\uac00-\ud7af]/.test(text)) {
    console.log("[Language Detection] Korean detected (Hangul)");
    return "ko";
  }

  // Arabic/Hebrew (RTL scripts)
  if (/[\u0600-\u06ff]/.test(text)) {
    console.log("[Language Detection] Arabic detected (Arabic script)");
    return "ar";
  }

  // Cyrillic (Russian)
  if (/[\u0400-\u04ff]/.test(text)) {
    console.log("[Language Detection] Russian detected (Cyrillic)");
    return "ru";
  }

  // Devanagari (Hindi)
  if (/[\u0900-\u097f]/.test(text)) {
    console.log("[Language Detection] Hindi detected (Devanagari)");
    return "hi";
  }

  // 2. For Latin-script languages (French, Spanish, Italian, Portuguese, German),
  //    only detect if there are MANY (5+) very specific language keywords

  const languagePatterns: Record<string, RegExp> = {
    fr: /\b(processus|diagramme|créer|générer|tâche|événement|début|fin|flux|approbation|révision|demande|formulaire|équipe|risque|conformité|vérifier|catégoriser|soumettre|employé|financier|opérationnel|nécessaire|nouveau)\b/gi,
    es: /\b(está|están|tiene|tienen|hacer|proceso|diagrama|crear|generar|tarea|evento|inicio|final|flujo|aprobación|revisión|solicitud|necesario|nuevo)\b/gi,
    de: /\b(prozess|diagramm|erstellen|generieren|aufgabe|ereignis|anfang|ende|fluss|genehmigung|überprüfung|antrag|notwendig|neu)\b/gi,
    it: /\b(processo|diagramma|creare|generare|compito|evento|inizio|fine|flusso|approvazione|revisione|richiesta|necessario|nuovo)\b/gi,
    pt: /\b(processo|diagrama|criar|gerar|tarefa|evento|início|fim|fluxo|aprovação|revisão|solicitação|necessário|novo)\b/gi,
  };

  // Count matches for each language - use global flag to count all matches
  for (const [lang, pattern] of Object.entries(languagePatterns)) {
    const matches = normalizedText.match(pattern);
    const count = matches ? matches.length : 0;

    // Require 5+ matches to detect non-English language
    if (count >= 5) {
      console.log(`[Language Detection] ${lang.toUpperCase()} detected (${count} language-specific keywords)`);
      return lang;
    }
  }

  // 3. Default to English
  console.log("[Language Detection] Defaulting to English");
  return "en";
}

/**
 * Get language name for display in prompts
 */
export function getLanguageName(langCode: string): string {
  const languageNames: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi",
  };

  return languageNames[langCode] || "English";
}
