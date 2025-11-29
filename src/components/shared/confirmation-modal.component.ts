import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmationService } from '../../services/confirmation.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-confirmation-modal',
  imports: [],
  standalone: true,
  template: `
    @if (confirmationService.state().isOpen) {
      <div class="fixed inset-0 bg-black bg-opacity-60 z-40" (click)="onCancel()"></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
          <div class="p-6 text-center">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 class="mt-5 text-lg font-semibold leading-6 text-slate-900">{{ confirmationService.state().title }}</h3>
            <div class="mt-2">
              <p class="text-sm text-slate-500">{{ confirmationService.state().message }}</p>
            </div>
          </div>
          <div class="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 rounded-b-lg">
            <button type="button" (click)="onConfirm()" class="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto">
              {{ t().common.delete }}
            </button>
            <button type="button" (click)="onCancel()" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:mt-0 sm:w-auto">
              {{ t().common.cancel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationModalComponent {
  confirmationService = inject(ConfirmationService);
  private translationService = inject(TranslationService);
  t = this.translationService.currentTranslations;

  onConfirm() {
    this.confirmationService.onConfirm();
  }

  onCancel() {
    this.confirmationService.onCancel();
  }
}
