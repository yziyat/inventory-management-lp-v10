import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { TranslationService } from '../../services/translation.service';
import { SettingsService, Language, DateFormat } from '../../services/settings.service';
import { ApiError } from '../../services/api-error';
import { ConfirmationService } from '../../services/confirmation.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  imports: [],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private apiService = inject(ApiService);
  private translationService = inject(TranslationService);
  private settingsService = inject(SettingsService);
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);

  t = this.translationService.currentTranslations;
  currentLang = this.settingsService.language;
  currentDateFormat = this.settingsService.dateFormat;

  dateFormats: DateFormat[] = ['YYYY-MM-DD', 'DD/MM/YYYY'];
  settings = this.apiService.settings;
  categories = computed(() => this.settings().categories);
  suppliers = computed(() => this.settings().suppliers);
  destinations = computed(() => this.settings().destinations);
  outgoingSubcategories = computed(() => this.settings().outgoingSubcategories);

  newCategory = signal('');
  newSupplier = signal('');
  newDestination = signal('');
  newSubcategory = signal('');

  setLanguage(lang: Language) {
    this.settingsService.setLanguage(lang);
  }

  setDateFormat(format: DateFormat) {
    this.settingsService.setDateFormat(format);
  }

  addSetting(type: 'categories' | 'suppliers' | 'destinations' | 'outgoingSubcategories') {
    let value = '';
    let signalToReset: any;
    let errorKeyExists = '';

    switch (type) {
      case 'categories':
        value = this.newCategory().trim();
        signalToReset = this.newCategory;
        errorKeyExists = 'errors.categoryExists';
        break;
      case 'suppliers':
        value = this.newSupplier().trim();
        signalToReset = this.newSupplier;
        errorKeyExists = 'errors.supplierExists';
        break;
      case 'destinations':
        value = this.newDestination().trim();
        signalToReset = this.newDestination;
        errorKeyExists = 'errors.destinationExists';
        break;
      case 'outgoingSubcategories':
        value = this.newSubcategory().trim();
        signalToReset = this.newSubcategory;
        errorKeyExists = 'errors.subcategoryExists';
        break;
    }

    if (!value) return;

    const currentList = this.settings()[type];
    if (currentList.map(i => i.toLowerCase()).includes(value.toLowerCase())) {
      this.notificationService.showWarning(this.translationService.translate(errorKeyExists));
      return;
    }

    const updatedList = [...currentList, value];
    try {
      this.apiService.updateSettings(type, updatedList);
      this.notificationService.showSuccess(this.t().common.addSuccess);
      signalToReset.set('');
    } catch (error) {
      console.error(`Failed to add ${type}`, error);
      this.notificationService.showError('Failed to add item.');
    }
  }

  async deleteSetting(type: 'categories' | 'suppliers' | 'destinations' | 'outgoingSubcategories', itemToDelete: string) {
    const title = this.translationService.translate('common.deleteConfirmationTitle');
    const confirmMsg = this.translationService.translate('settings.deleteConfirmation', { item: itemToDelete });

    const confirmed = await this.confirmationService.confirm(title, confirmMsg);
    if (!confirmed) return;

    const updatedList = this.settings()[type].filter(item => item !== itemToDelete);
    try {
      this.apiService.updateSettings(type, updatedList);
      this.notificationService.showSuccess(this.t().common.deleteSuccess);
    } catch (error: any) {
      console.error(`Failed to delete ${type}`, error);
      let errorMessage: string;
      if (error?._isApiError) {
        switch (error.key) {
          case 'CATEGORY_IN_USE':
            errorMessage = this.translationService.translate('errors.categoryInUse', error.params);
            break;
          case 'SUPPLIER_IN_USE':
            errorMessage = this.translationService.translate('errors.supplierInUse', error.params);
            break;
          case 'DESTINATION_IN_USE':
            errorMessage = this.translationService.translate('errors.destinationInUse', error.params);
            break;
          case 'SUBCATEGORY_IN_USE':
            errorMessage = this.translationService.translate('errors.subcategoryInUse', error.params);
            break;
          default:
            errorMessage = 'Failed to delete item.';
        }
      } else {
        errorMessage = 'Failed to delete item.';
      }
      this.notificationService.showError(errorMessage);
    }
  }
}