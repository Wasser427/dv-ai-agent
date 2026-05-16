import zh from './zh';
import en from './en';
import { ConfigManager } from '../config';

const translations: Record<string, any> = { zh, en };

export class I18n {
  private static instance: I18n;
  private currentLang: string;

  private constructor() {
    const config = ConfigManager.getInstance();
    const raw = (config.get('language') as string).toLowerCase();
    this.currentLang = (raw === 'en' || raw === 'eng' || raw === 'english') ? 'en' : 'zh';
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

  format(key: string, ...args: any[]): string {
    let template = this.t(key);
    for (let i = 0; i < args.length; i++) {
      template = template.replace(`{${i}}`, String(args[i]));
    }
    return template;
  }

  setLanguage(lang: string): void {
    if (translations[lang]) {
      this.currentLang = lang;
    }
  }

  reload(): void {
    const config = ConfigManager.getInstance();
    const raw = (config.get('language') as string).toLowerCase();
    const lang = (raw === 'en' || raw === 'eng' || raw === 'english') ? 'en' : 'zh';
    this.currentLang = translations[lang] ? lang : 'zh';
  }

  getCurrentLang(): string {
    return this.currentLang;
  }
}
