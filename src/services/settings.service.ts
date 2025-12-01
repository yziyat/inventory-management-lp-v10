import { Injectable, signal, effect } from '@angular/core';
import { Language, DateFormat } from '../models/user.model';

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

  // Load user-specific preferences or fallback to global settings
  loadUserPreferences(userLanguage?: Language, userDateFormat?: DateFormat) {
    if (userLanguage) {
      this.language.set(userLanguage);
    }
    if (userDateFormat) {
      this.dateFormat.set(userDateFormat);
    }
  }
}