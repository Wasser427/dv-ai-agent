import zh from './zh';
import en from './en';

const translations: Record<string, any> = { zh, en };

export class I18n {
  private static instance: I18n;
  private currentLang: string;

  private constructor() {
    this.currentLang = 'zh';
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
    this.currentLang = 'zh';
  }

  getCurrentLang(): string {
    return this.currentLang;
  }
}