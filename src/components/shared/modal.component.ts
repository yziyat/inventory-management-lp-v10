import { ChangeDetectionStrategy, Component, input, output, TemplateRef } from '@angular/core';

@Component({
  selector: 'app-modal',
  imports: [],
  standalone: true,
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-50 z-40" (click)="close.emit()"></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" [class]="modalClass()">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="text-xl font-semibold text-gray-800">{{ title() }}</h3>
            <button (click)="close.emit()" class="text-gray-400 hover:text-gray-600" aria-label="Close modal">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-6 overflow-y-auto">
            <ng-content></ng-content>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  isOpen = input.required<boolean>();
  title = input<string>('Modal Title');
  modalClass = input<string>('');
  close = output<void>();
}