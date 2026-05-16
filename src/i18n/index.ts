import zh from './zh';
import en from './en';
import { ConfigManager } from '../config';

const translations: Record<string, any> = { zh, en };

export class I18n {
  private static instance: I18n;
  private currentLang: string;

  private constructor() {
    const config = ConfigManager.getInstance();
    this.currentLang = config.get('language') as string;
  }

  static getInstance(): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  t(key: string): string {
    const langData = translations[this.currentLang] || translations['zh'];
    return langData[key] || key;
  }

  setLanguage(lang: string): void {
    if (translations[lang]) {
      this.currentLang = lang;
    }
  }
}
