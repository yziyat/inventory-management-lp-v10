import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, effect } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Article } from '../../models/article.model';
import { Movement, MovementType } from '../../models/movement.model';
import { ModalComponent } from '../shared/modal.component';
import { TranslationService } from '../../services/translation.service';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { CustomDatePipe } from '../../pipes/custom-date.pipe';
import { NotificationService } from '../../services/notification.service';
import { ApiError } from '../../services/api-error';
import { PaginationComponent } from '../shared/pagination.component';

@Component({
  selector: 'app-article-detail',
  standalone: true,
  imports: [ModalComponent, CustomDatePipe, ReactiveFormsModule, PaginationComponent],
  template: `
    <app-modal [isOpen]="!!article()" [title]="t().articles.detail.title" (close)="close.emit()" modalClass="max-w-6xl">
      @if (article(); as art) {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 transition-all" [class.blur-sm]="isMovementModalOpen()">
          <!-- Left Column: Info & Price History -->
          <div class="lg:col-span-1 space-y-6">
            <!-- Information -->
            <div class="bg-slate-50 p-4 rounded-lg border">
              <h3 class="font-semibold text-slate-800 mb-3 border-b pb-2">{{ t().articles.detail.information }}</h3>
              <div class="space-y-2 text-sm">
                <p><span class="font-semibold text-slate-600 w-32 inline-block">{{t().articles.table.name}}:</span> {{ art.name }}</p>
                <p><span class="font-semibold text-slate-600 w-32 inline-block">{{t().articles.table.code}}:</span> {{ art.code }}</p>
                <p><span class="font-semibold text-slate-600 w-32 inline-block">{{t().articles.table.category}}:</span> {{ art.category }}</p>
                <p><span class="font-semibold text-slate-600 w-32 inline-block">{{t().articles.form.unit.label}}:</span> {{ art.unit }}</p>
                <p><span class="font-semibold text-slate-600 w-32 inline-block">{{t().articles.table.price}}:</span> {{ art.price.toFixed(2) }} {{ t().common.currency }}</p>
                <p><span class="font-semibold text-slate-600 w-32 inline-block">{{t().articles.table.alert}}:</span> {{ art.alert }} {{ art.unit }}</p>
                <p><span class="font-semibold text-slate-600 w-32 inline-block">{{t().articles.detail.createdAt}}:</span> {{ art.createdAt | customDate }}</p>
                <p><span class="font-semibold text-slate-600 w-32 inline-block">{{t().articles.detail.updatedAt}}:</span> {{ art.updatedAt | customDate }}</p>
                @if (art.description) {
                  <div class="pt-2">
                    <span class="font-semibold text-slate-600">{{t().articles.form.description.label}}:</span>
                    <p class="text-slate-700 whitespace-pre-wrap mt-1">{{ art.description }}</p>
                  </div>
                }
              </div>
            </div>
            <!-- Price History -->
            <div class="bg-slate-50 p-4 rounded-lg border">
              <h3 class="font-semibold text-slate-800 mb-3 border-b pb-2">{{ t().articles.detail.priceHistory }}</h3>
              <ul class="space-y-1 text-sm max-h-40 overflow-y-auto pr-2">
                @for(history of art.priceHistory.slice().reverse(); track $index) {
                  <li class="flex justify-between hover:bg-slate-200 p-1 rounded-md">
                    <span class="text-slate-600">{{ history.date | customDate }}:</span>
                    <span class="font-semibold">{{ history.price.toFixed(2) }} {{ t().common.currency }}</span>
                  </li>
                }
              </ul>
            </div>
          </div>

          <!-- Right Column: Movements -->
          <div class="lg:col-span-2 flex flex-col">
            <div class="flex justify-between items-center mb-3">
              <h3 class="font-semibold text-slate-800 text-lg">{{ t().articles.detail.movementHistory }}</h3>
              @if (authService.isAdmin() || authService.isEditor()) {
                <button (click)="openMovementModal()" class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    {{ t().articles.detail.addMovement }}
                </button>
              }
            </div>
            <div class="flex-grow overflow-y-auto border rounded-lg bg-white">
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-100 text-slate-600 sticky top-0 z-10">
                  <tr>
                    <th class="p-3">Date</th>
                    <th class="p-3">Type</th>
                    <th class="p-3 text-center">Qty</th>
                    <th class="p-3">Fourn./Dest.</th>
                    <th class="p-3">Réf.</th>
                  </tr>
                </thead>
                <tbody>
                  @for (movement of paginatedMovements(); track movement.id) {
                    <tr class="border-t hover:bg-slate-50">
                      <td class="p-3">{{ movement.date | customDate }}</td>
                      <td class="p-3">
                        <span class="px-2 py-0.5 text-xs font-semibold leading-tight rounded-full"
                          [class.text-green-800]="movement.type === 'Entrée'" [class.bg-green-100]="movement.type === 'Entrée'"
                          [class.text-red-800]="movement.type === 'Sortie'" [class.bg-red-100]="movement.type === 'Sortie'"
                          [class.text-amber-800]="movement.type === 'Ajustement'" [class.bg-amber-100]="movement.type === 'Ajustement'"
                          [class.text-slate-800]="movement.type === 'Périmé / Rebut'" [class.bg-slate-200]="movement.type === 'Périmé / Rebut'">
                          {{ t().movements.types[movement.type] }}
                        </span>
                      </td>
                      <td class="p-3 text-center font-medium" [class.text-green-600]="movement.type === 'Entrée' || movement.type === 'Ajustement'" [class.text-red-600]="movement.type === 'Sortie' || movement.type === 'Périmé / Rebut'">
                        {{ movement.quantity }}
                      </td>
                      <td class="p-3 text-slate-700">{{ movement.supplierDest }}</td>
                       <td class="p-3 text-slate-700">{{ movement.refDoc }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="p-4 text-center text-slate-500">{{t().articles.detail.noMovements}}</td></tr>
                  }
                </tbody>
              </table>
            </div>
             @if (articleMovements().length > movementItemsPerPage()) {
                <div class="mt-2">
                    <app-pagination
                        [currentPage]="movementCurrentPage()"
                        [totalItems]="articleMovements().length"
                        [itemsPerPage]="movementItemsPerPage()"
                        (pageChange)="onMovementPageChange($event)">
                    </app-pagination>
                </div>
            }
          </div>
        </div>
      }
    </app-modal>

    <!-- Movement Modal -->
    <app-modal [isOpen]="isMovementModalOpen()" [title]="t().movements.recordMovement" (close)="closeMovementModal()">
        <form [formGroup]="movementForm" (ngSubmit)="onAddMovementSubmit()" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block mb-2 text-sm font-medium text-slate-900">{{ t().movements.form.article.label }}</label>
                    <input type="text" [value]="article()?.name" readonly class="bg-slate-200 border border-slate-300 text-slate-900 text-sm rounded-lg block w-full p-2.5 cursor-not-allowed">
                </div>
                <div>
                    <label for="modal-type" class="block mb-2 text-sm font-medium text-slate-900">{{ t().movements.form.type.label }}</label>
                    <select id="modal-type" formControlName="type" class="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5">
                        @for (type of movementTypes; track type) {
                            <option [value]="type">{{ t().movements.types[type] || type }}</option>
                        }
                    </select>
                </div>
                <div>
                    <label for="modal-quantity" class="block mb-2 text-sm font-medium text-slate-900">{{ t().movements.form.quantity.label }}</label>
                    <input type="number" id="modal-quantity" formControlName="quantity" class="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5">
                </div>
                <div>
                    <label for="modal-date" class="block mb-2 text-sm font-medium text-slate-900">{{ t().movements.form.date.label }}</label>
                    <input type="date" id="modal-date" formControlName="date" [max]="today" class="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5">
                </div>
                <div>
                    <label for="modal-refDoc" class="block mb-2 text-sm font-medium text-slate-900">{{ t().movements.form.refDoc.label }}</label>
                    <input type="text" id="modal-refDoc" formControlName="refDoc" class="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5">
                </div>
                <div>
                    <label for="modal-supplierDest" class="block mb-2 text-sm font-medium text-slate-900">{{ movementForm.get('type')?.value === 'Entrée' ? t().movements.form.supplier.label : t().movements.form.destination.label }}</label>
                    <select id="modal-supplierDest" formControlName="supplierDest" class="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5">
                        <option value="">{{ movementForm.get('type')?.value === 'Entrée' ? t().movements.form.supplier.placeholder : t().movements.form.destination.placeholder }}</option>
                        @for (item of supplierDestinationsList(); track item) {
                            <option [value]="item">{{ item }}</option>
                        }
                    </select>
                </div>
                @if (movementForm.get('type')?.value === 'Sortie' || movementForm.get('type')?.value === 'Périmé / Rebut') {
                    <div class="col-span-1 md:col-span-2">
                        <label for="modal-subcategory" class="block mb-2 text-sm font-medium text-slate-900">{{ t().movements.form.subcategory.label }}</label>
                        <select id="modal-subcategory" formControlName="subcategory" class="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5">
                            <option value="">{{ t().movements.form.subcategory.placeholder }}</option>
                            @for (sub of outgoingSubcategories(); track sub) {
                                <option [value]="sub">{{ sub }}</option>
                            }
                        </select>
                    </div>
                }
                <div class="col-span-1 md:col-span-2">
                    <label for="modal-remarks" class="block mb-2 text-sm font-medium text-slate-900">{{ t().movements.form.remarks.label }}</label>
                    <textarea id="modal-remarks" formControlName="remarks" rows="2" class="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"></textarea>
                </div>
            </div>
            <div class="flex justify-end gap-2 pt-4">
                <button type="button" (click)="closeMovementModal()" class="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">{{ t().common.cancel }}</button>
                <button type="submit" [disabled]="movementForm.invalid" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
                    {{ t().movements.saveMovement }}
                </button>
            </div>
        </form>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleDetailComponent {
  private apiService = inject(ApiService);
  private translationService = inject(TranslationService);
  private notificationService = inject(NotificationService);
  // FIX: Add explicit type to injected FormBuilder to resolve type inference issue.
  private fb: FormBuilder = inject(FormBuilder);
  authService = inject(AuthService);

  t = this.translationService.currentTranslations;

  article = input<Article | null>();
  close = output<void>();

  isMovementModalOpen = signal(false);
  movementTypes: Movement['type'][] = ['Entrée', 'Sortie', 'Ajustement', 'Périmé / Rebut'];
  suppliers = computed(() => this.apiService.settings().suppliers);
  destinations = computed(() => this.apiService.settings().destinations);
  outgoingSubcategories = computed(() => this.apiService.settings().outgoingSubcategories);
  today = new Date().toISOString().split('T')[0];

  // Pagination for movements
  movementCurrentPage = signal(1);
  movementItemsPerPage = signal(10);

  allMovements = this.apiService.movements;
  articleMovements = computed(() => {
    const articleId = this.article()?.id;
    if (!articleId) return [];
    return this.allMovements()
      .filter(m => m.articleId === articleId)
      .sort((a, b) => b.id - a.id);
  });

  paginatedMovements = computed(() => {
    const movements = this.articleMovements();
    const page = this.movementCurrentPage();
    const perPage = this.movementItemsPerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return movements.slice(start, end);
  });

  movementForm = this.fb.group({
    type: ['Entrée' as Movement['type'], Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    date: [this.today, Validators.required],
    refDoc: [''],
    supplierDest: [''],
    subcategory: [''],
    remarks: ['']
  });

  movementType = signal<MovementType>(this.movementForm.get('type')!.value!);

  supplierDestinationsList = computed(() => {
    const type = this.movementType();
    if (type === 'Entrée') {
      return this.suppliers();
    } else {
      return this.destinations();
    }
  });

  constructor() {
    this.movementForm.get('type')?.valueChanges.subscribe(type => {
      if (type) {
        this.movementType.set(type);
      }
      this.updateFormValidators(type);
      this.movementForm.get('supplierDest')?.reset('');
    });

    effect(() => {
      if (this.article()) {
        this.movementCurrentPage.set(1);
      }
    });
  }

  onMovementPageChange(page: number) {
    this.movementCurrentPage.set(page);
  }

  private updateFormValidators(type: Movement['type'] | null | undefined) {
    const quantityControl = this.movementForm.get('quantity');
    const supplierDestControl = this.movementForm.get('supplierDest');
    const subcategoryControl = this.movementForm.get('subcategory');

    if (!quantityControl || !supplierDestControl || !subcategoryControl) return;

    if (type === 'Sortie' || type === 'Périmé / Rebut') {
      subcategoryControl.enable();
    } else {
      subcategoryControl.disable();
      subcategoryControl.reset('');
    }

    if (type === 'Ajustement') {
      quantityControl.setValidators([Validators.required, (control: AbstractControl) => control.value === 0 ? { 'zero': true } : null]);
      supplierDestControl.clearValidators();
      supplierDestControl.disable();
      supplierDestControl.reset('');
    } else {
      quantityControl.setValidators([Validators.required, Validators.min(1)]);
      supplierDestControl.enable();
    }
    quantityControl.updateValueAndValidity();
    supplierDestControl.updateValueAndValidity();
    subcategoryControl.updateValueAndValidity();
  }

  openMovementModal() {
    this.movementForm.reset({
      type: 'Entrée',
      quantity: 1,
      date: this.today,
      refDoc: '',
      supplierDest: '',
      subcategory: '',
      remarks: ''
    });
    this.movementType.set('Entrée');
    this.updateFormValidators('Entrée');
    this.isMovementModalOpen.set(true);
  }

  closeMovementModal() {
    this.isMovementModalOpen.set(false);
  }

  async onAddMovementSubmit() {
    if (this.movementForm.invalid || !this.article()) return;
    try {
      const formValue = this.movementForm.getRawValue();
      const newMovement: Omit<Movement, 'id'> = {
        articleId: this.article()!.id,
        userId: this.authService.currentUser()!.id,
        date: formValue.date!,
        refDoc: formValue.refDoc!,
        type: formValue.type!,
        quantity: formValue.quantity!,
        supplierDest: formValue.supplierDest!,
        subcategory: formValue.subcategory || undefined,
        remarks: formValue.remarks!
      };
      await this.apiService.addMovement(newMovement);
      this.notificationService.showSuccess(this.t().common.addSuccess);
      this.closeMovementModal();
    } catch (error: any) {
      if (error?._isApiError && error.key === 'INSUFFICIENT_STOCK') {
        this.notificationService.showError(this.translationService.translate('errors.insufficientStock', error.params));
      } else {
        this.notificationService.showError(this.translationService.translate('errors.failedToSaveMovement'));
      }
    }
  }
}