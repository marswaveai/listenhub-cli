import type { Language } from "@marswave/listenhub-sdk";

const cjkRegex = /[\u4E00-\u9FFF\u3400-\u4DBF]/v;
const kanaRegex = /[\u3040-\u309F\u30A0-\u30FF]/v;

export function inferLanguage(text?: string): Language {
  if (!text) return "en";
  if (kanaRegex.test(text)) return "ja";
  if (cjkRegex.test(text)) return "zh";
  return "en";
}
