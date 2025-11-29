import { Injectable, signal, computed, inject } from '@angular/core';
import { en } from '../i18n/en';
import { fr } from '../i18n/fr';
import { SettingsService } from './settings.service';

type TranslationParams = Record<string, string | number>;

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private settingsService = inject(SettingsService);
  private translations = { en, fr };

  language = this.settingsService.language;

  currentTranslations = computed(() => this.translations[this.language()]);

  translate(key: string, params?: TranslationParams): string {
    const dict = this.currentTranslations();
    let translation = this.resolveKey(key, dict);

    if (translation === undefined) {
      console.warn(`Translation not found for key: ${key}`);
      // Fallback to English if key not found in current language
      translation = this.resolveKey(key, this.translations.en);
      if (translation === undefined) return key;
    }

    if (params) {
      Object.keys(params).forEach(paramKey => {
        const regex = new RegExp(`{{${paramKey}}}`, 'g');
        if (translation) {
          translation = translation.replace(regex, String(params[paramKey]));
        }
      });
    }

    return translation;
  }

  private resolveKey(key: string, dict: any): string | undefined {
    try {
      return key.split('.').reduce((o, i) => o[i], dict);
    } catch (e) {
      return undefined;
    }
  }
}