import { Injectable, signal } from '@angular/core';

export type Language = 'en' | 'fr';
export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  language = signal<Language>(this.getInitialLanguage());
  dateFormat = signal<DateFormat>(this.getInitialDateFormat());

  private getInitialLanguage(): Language {
    const storedLang = localStorage.getItem('appLanguage');
    return storedLang === 'fr' ? 'fr' : 'en';
  }

  private getInitialDateFormat(): DateFormat {
    const storedFormat = localStorage.getItem('appDateFormat');
    return storedFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'DD/MM/YYYY';
  }

  setLanguage(lang: Language) {
    this.language.set(lang);
    localStorage.setItem('appLanguage', lang);
  }

  setDateFormat(format: DateFormat) {
    this.dateFormat.set(format);
    localStorage.setItem('appDateFormat', format);
  }
}