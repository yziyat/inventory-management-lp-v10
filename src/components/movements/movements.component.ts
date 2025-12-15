import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Movement, MovementType } from '../../models/movement.model';
import { TableHeaderComponent } from '../shared/table-header.component';
import { ModalComponent } from '../shared/modal.component';
import { TranslationService } from '../../services/translation.service';
import { ExportService } from '../../services/export.service';
import { CustomDatePipe } from '../../pipes/custom-date.pipe';
import { ApiError } from '../../services/api-error';
import { ConfirmationService } from '../../services/confirmation.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { ArticleDetailComponent } from '../articles/article-detail.component';
import { Article } from '../../models/article.model';
import { PaginationComponent } from '../shared/pagination.component';
import { SearchableSelectComponent } from '../shared/searchable-select.component';

// FIX: Define a type for the bulk movement form row to ensure type safety.
interface BulkMovementRow {
  quantity: number;
  supplierDest: string;
  subcategory: string;
  remarks: string;
}

@Component({
  selector: 'app-movements',
  templateUrl: './movements.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TableHeaderComponent, ModalComponent, CustomDatePipe, ArticleDetailComponent, PaginationComponent, SearchableSelectComponent],
  standalone: true,
})
export class MovementsComponent {
  protected readonly Infinity = Infinity;
  private apiService = inject(ApiService);
  private fb: FormBuilder = inject(FormBuilder);
  private translationService = inject(TranslationService);
  private exportService = inject(ExportService);
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  authService = inject(AuthService);
  t = this.translationService.currentTranslations;

  articles = this.apiService.articles;
  stock = this.apiService.stock;
  suppliers = computed(() => this.apiService.settings().suppliers);
  destinations = computed(() => this.apiService.settings().destinations);
  allSuppliersAndDestinations = computed(() => [...this.suppliers(), ...this.destinations()].sort());
  outgoingSubcategories = computed(() => this.apiService.settings().outgoingSubcategories);
  movementTypes: Movement['type'][] = ['Entrée', 'Sortie', 'Ajustement', 'Périmé / Rebut'];
  today = new Date().toISOString().split('T')[0];

  isModalOpen = signal(false);
  editingMovement = signal<Movement | null>(null);

  // Article Detail Modal
  selectedArticle = signal<Article | null>(null);

  // Form visibility
  activeForm = signal<'single' | 'bulk' | 'fixed' | null>(null);

  isSingleFormVisible = computed(() => this.activeForm() === 'single');
  isBulkFormVisible = computed(() => this.activeForm() === 'bulk');
  isFixedBulkFormVisible = computed(() => this.activeForm() === 'fixed');

  // Sorting
  sortKey = signal('id');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Filtering
  filterForm = this.fb.group({
    startDate: [''],
    endDate: [''],
    type: [''],
    supplier: [''],
    destination: [''],
    articleSearch: ['']
  });

  activeFilters = signal(this.filterForm.value);

  // Pagination
  itemsPerPage = signal(100);
  currentPage = signal(1);

  movementForm = this.fb.group({
    id: [null as string | null],
    articleId: [null as string | null, Validators.required],
    type: ['Entrée' as Movement['type'], Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    date: [this.today, Validators.required],
    refDoc: [''],
    supplierDest: [''],
    subcategory: [''],
    remarks: ['']
  });

  singleMovementType = signal<MovementType>(this.movementForm.get('type')!.value!);
  singleFormArticleId = signal<string | null>(null);

  singleFormSelectedArticleStock = computed(() => {
    const articleId = this.singleFormArticleId();
    if (!articleId) return null;
    const stockItem = this.stock().find(s => s.id === articleId);
    return stockItem ? { stock: stockItem.currentStock, unit: stockItem.unit } : null;
  });

  private uniqueDestinationsValidator(control: AbstractControl): ValidationErrors | null {
    if (!(control instanceof FormArray)) {
      return null;
    }
    const values = control.controls.map(group => group.get('supplierDest')?.value);
    const uniqueValues = new Set(values.filter(v => v)); // filter out empty strings
    if (values.filter(v => v).length > uniqueValues.size) {
      return { duplicateDestinations: true };
    }
    return null;
  }

  bulkMovementForm = this.fb.group({
    articleId: [null as string | null, Validators.required],
    date: [this.today, Validators.required],
    type: ['Sortie' as Movement['type'], Validators.required],
    movements: this.fb.array(
      [this.createBulkMovementRow()],
      this.uniqueDestinationsValidator.bind(this)
    )
  });

  // Fixed Bulk Movement Form (destination and date fixed)
  fixedBulkMovementForm = this.fb.group({
    type: ['Sortie' as MovementType, Validators.required],
    date: [this.today, Validators.required],
    supplierDest: ['', Validators.required],
    subcategory: [''],
    refDoc: [''],
    movements: this.fb.array([this.createFixedBulkMovementRow()])
  });

  bulkMovementType = signal<MovementType>(this.bulkMovementForm.get('type')!.value!);
  bulkFormArticleId = signal<string | null>(null);

  bulkFormSelectedArticleStock = computed(() => {
    const articleId = this.bulkFormArticleId();
    if (!articleId) return null;
    const stockItem = this.stock().find(s => s.id === articleId);
    return stockItem ? { stock: stockItem.currentStock, unit: stockItem.unit } : null;
  });



  articleUnitMap = computed(() => {
    const map = new Map<string, string>();
    this.articles().forEach(a => map.set(a.id, a.unit));
    return map;
  });



  getSupplierOrDestinationLabel(type: MovementType): string {
    return type === 'Entrée' ? this.t().movements.form.supplier.label : this.t().movements.form.destination.label;
  }

  getSupplierOrDestinationPlaceholder(type: MovementType): string {
    return type === 'Entrée' ? this.t().movements.form.supplier.placeholder : this.t().movements.form.destination.placeholder;
  }

  getSupplierOrDestinationList(control: AbstractControl | null): string[] {
    if (!control) return [];
    const type = control.value as MovementType;
    return type === 'Entrée' ? this.suppliers() : this.destinations();
  }

  getArticleNameById(id: string | null): string {
    if (!id) return '';
    return this.articleNameMap().get(id) || '';
  }

  getArticleUnitById(id: string | null): string {
    if (!id) return '';
    return this.articleUnitMap().get(id) || '';
  }

  // Helper methods for bulk movement forms
  createBulkMovementRow(): FormGroup {
    return this.fb.group({
      supplierDest: ['', Validators.required],
      subcategory: [''],
      quantity: [1, [Validators.required, Validators.min(1)]],
      remarks: ['']
    });
  }

  createFixedBulkMovementRow(): FormGroup {
    return this.fb.group({
      articleId: [null as string | null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      remarks: ['']
    });
  }

  get bulkMovementsArray() {
    return this.bulkMovementForm.get('movements') as FormArray;
  }

  get fixedBulkMovementsArray() {
    return this.fixedBulkMovementForm.get('movements') as FormArray;
  }

  supplierDestinationsList = computed(() => {
    const type = this.singleMovementType();
    if (type === 'Entrée') {
      return this.suppliers();
    } else {
      return this.destinations();
    }
  });

  bulkSupplierDestinationsList = computed(() => {
    const type = this.bulkMovementType();
    if (type === 'Entrée') {
      return this.suppliers();
    } else {
      return this.destinations();
    }
  });

  articleNameMap = computed(() => {
    const map = new Map<string, string>();
    this.articles().forEach(a => map.set(a.id, `${a.name} (${a.code})`));
    return map;
  });

  searchableArticles = computed(() => this.articles().map(a => ({ id: a.id, name: `${a.name} (${a.code})` })));

  filteredMovements = computed(() => {
    const movements = this.apiService.movements();
    const articles = this.articles();
    const filters = this.activeFilters();
    const key = this.sortKey();
    const dir = this.sortDirection();
    const articleSearchTerm = (filters.articleSearch || '').toLowerCase();

    const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || '';

    return movements
      .filter(m => {
        const articleInfo = this.articleNameMap().get(m.articleId)?.toLowerCase() || '';
        const articleMatch = !articleSearchTerm || articleInfo.includes(articleSearchTerm);
        const startDateMatch = !filters.startDate || m.date >= filters.startDate;
        const endDateMatch = !filters.endDate || m.date <= filters.endDate;
        const typeMatch = !filters.type || m.type === filters.type;
        const supplierMatch = !filters.supplier || m.supplierDest === filters.supplier;
        const destinationMatch = !filters.destination || m.supplierDest === filters.destination;
        return articleMatch && startDateMatch && endDateMatch && typeMatch && supplierMatch && destinationMatch;
      })
      .sort((a, b) => {
        let valA, valB;
        if (key === 'articleName') {
          valA = getArticleName(a.articleId);
          valB = getArticleName(b.articleId);
        } else {
          valA = a[key as keyof Movement];
          valB = b[key as keyof Movement];
        }

        let comparison = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else {
          comparison = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
        }
        return dir === 'asc' ? comparison : -comparison;
      });
  });

  paginatedMovements = computed(() => {
    const items = this.filteredMovements();
    const page = this.currentPage();
    const perPage = this.itemsPerPage();
    if (perPage === Infinity) {
      return items;
    }
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return items.slice(start, end);
  });

  paginationShowingText = computed(() => {
    const total = this.filteredMovements().length;
    if (total === 0) return '';

    const page = this.currentPage();
    const perPage = this.itemsPerPage();

    if (perPage === Infinity) {
      return this.translationService.translate('movements.pagination.showingAll', {
        count: total
      });
    }

    const start = (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);

    return this.translationService.translate('movements.pagination.showing', {
      start,
      end,
      total
    });
  });

  constructor() {
    this.updateFormValidators(this.movementForm.get('type')?.value);

    this.movementForm.get('type')?.valueChanges.subscribe(type => {
      if (type) {
        this.singleMovementType.set(type);
      }
      this.updateFormValidators(type);
      this.movementForm.get('supplierDest')?.reset('');
    });

    this.bulkMovementForm.get('type')?.valueChanges.subscribe((type) => {
      if (type) {
        this.bulkMovementType.set(type);
      }
      this.updateBulkFormValidators(type);
      this.bulkMovementsArray.controls.forEach(control => {
        control.get('supplierDest')?.reset('');
        control.get('subcategory')?.reset('');
      });
    });

    this.fixedBulkMovementForm.get('type')?.valueChanges.subscribe(type => {
      this.updateFixedBulkFormValidators(type);
      this.fixedBulkMovementForm.get('supplierDest')?.reset('');
      this.fixedBulkMovementForm.get('subcategory')?.reset('');
    });

    this.movementForm.get('articleId')?.valueChanges.subscribe(id => {
      this.singleFormArticleId.set(id ? String(id) : null);
    });

    this.bulkMovementForm.get('articleId')?.valueChanges.subscribe(id => {
      this.bulkFormArticleId.set(id ? String(id) : null);
    });

    this.addBulkMovementRow();
  }

  private updateFormValidators(type: Movement['type'] | null | undefined) {
    const quantityControl = this.movementForm.get('quantity');
    const supplierDestControl = this.movementForm.get('supplierDest');
    const subcategoryControl = this.movementForm.get('subcategory');

    if (!quantityControl || !supplierDestControl || !subcategoryControl) return;

    if (type === 'Sortie' || type === 'Périmé / Rebut') {
      subcategoryControl.enable();
      if (type === 'Sortie') {
        subcategoryControl.setValidators(Validators.required);
        supplierDestControl.setValidators(Validators.required);
      } else {
        subcategoryControl.clearValidators();
        supplierDestControl.clearValidators();
      }
    } else {
      subcategoryControl.disable();
      subcategoryControl.clearValidators();
      subcategoryControl.reset('');

      if (type !== 'Ajustement') {
        supplierDestControl.setValidators(Validators.required);
      }
    }

    if (type === 'Ajustement') {
      quantityControl.setValidators([Validators.required, (control: AbstractControl) => control.value === 0 ? { 'zero': true } : null]);
      supplierDestControl.clearValidators();
      supplierDestControl.disable();
      if (!this.editingMovement()) {
        supplierDestControl.reset('');
      }
    } else {
      quantityControl.setValidators([Validators.required, Validators.min(1)]);
      supplierDestControl.enable();
    }
    quantityControl.updateValueAndValidity();
    supplierDestControl.updateValueAndValidity();
    subcategoryControl.updateValueAndValidity();
  }

  private updateBulkFormValidators(type: Movement['type'] | null | undefined) {
    if (!type) return;

    const isOutgoing = type === 'Sortie' || type === 'Périmé / Rebut';

    this.bulkMovementsArray.controls.forEach(control => {
      const subcategoryControl = control.get('subcategory');
      const supplierDestControl = control.get('supplierDest');

      if (isOutgoing) {
        subcategoryControl?.enable();
        if (type === 'Sortie') {
          subcategoryControl?.setValidators(Validators.required);
          supplierDestControl?.setValidators(Validators.required);
        } else {
          subcategoryControl?.clearValidators();
          supplierDestControl?.clearValidators();
        }
      } else {
        subcategoryControl?.disable();
        subcategoryControl?.clearValidators();
      }
      subcategoryControl?.updateValueAndValidity();
      supplierDestControl?.updateValueAndValidity();
    });
  }

  private updateFixedBulkFormValidators(type: Movement['type'] | null | undefined) {
    const subcategoryControl = this.fixedBulkMovementForm.get('subcategory');
    const supplierDestControl = this.fixedBulkMovementForm.get('supplierDest');

    if (!subcategoryControl || !supplierDestControl) return;

    if (type === 'Sortie' || type === 'Périmé / Rebut') {
      subcategoryControl.enable();
      if (type === 'Sortie') {
        subcategoryControl.setValidators(Validators.required);
        supplierDestControl.setValidators(Validators.required);
      } else {
        subcategoryControl.clearValidators();
        supplierDestControl.clearValidators();
      }
    } else if (type === 'Ajustement') {
      subcategoryControl.disable();
      subcategoryControl.clearValidators();
      supplierDestControl.disable();
      supplierDestControl.clearValidators();
    } else {
      // Entrée
      subcategoryControl.disable();
      subcategoryControl.clearValidators();
      supplierDestControl.enable();
      supplierDestControl.setValidators(Validators.required);
    }
    subcategoryControl.updateValueAndValidity();
    supplierDestControl.updateValueAndValidity();
  }

  setItemsPerPage(count: number) {
    this.itemsPerPage.set(count);
    this.currentPage.set(1);
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    window.scrollTo(0, 0);
  }

  openEditModal(movement: Movement) {
    this.editingMovement.set(movement);
    this.movementForm.patchValue(movement);
    this.singleMovementType.set(movement.type);
    this.singleFormArticleId.set(movement.articleId);
    this.updateFormValidators(movement.type);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingMovement.set(null);
    this.resetMovementForm();
  }

  openDetailModal(articleId: string) {
    const article = this.apiService.articles().find(a => a.id === articleId);
    if (article) {
      this.selectedArticle.set(article);
    }
  }

  closeDetailModal() {
    this.selectedArticle.set(null);
  }

  toggleSingleForm() {
    this.activeForm.update(current => current === 'single' ? null : 'single');
    if (this.isSingleFormVisible()) {
      this.resetMovementForm();
    }
  }

  toggleBulkForm() {
    this.activeForm.update(current => current === 'bulk' ? null : 'bulk');
    if (this.isBulkFormVisible()) {
      this.resetBulkForm();
    }
  }

  toggleFixedBulkForm() {
    this.activeForm.update(current => current === 'fixed' ? null : 'fixed');
    if (this.isFixedBulkFormVisible()) {
      this.resetFixedBulkForm();
    }
  }

  addBulkMovementRow() {
    const row = this.createBulkMovementRow();
    // Apply current validators to new row
    const type = this.bulkMovementForm.get('type')?.value;
    const subcategoryControl = row.get('subcategory');
    const supplierDestControl = row.get('supplierDest');

    if (type === 'Sortie' || type === 'Périmé / Rebut') {
      subcategoryControl?.enable();
      if (type === 'Sortie') {
        subcategoryControl?.setValidators(Validators.required);
        supplierDestControl?.setValidators(Validators.required);
      }
    } else {
      subcategoryControl?.disable();
    }

    this.bulkMovementsArray.push(row);
  }

  removeBulkMovementRow(index: number) {
    if (this.bulkMovementsArray.length > 1) {
      this.bulkMovementsArray.removeAt(index);
    }
  }

  addFixedBulkMovementRow() {
    this.fixedBulkMovementsArray.push(this.createFixedBulkMovementRow());
  }

  removeFixedBulkMovementRow(index: number) {
    if (this.fixedBulkMovementsArray.length > 1) {
      this.fixedBulkMovementsArray.removeAt(index);
    }
  }

  private resetMovementForm() {
    this.movementForm.reset({
      type: 'Entrée',
      quantity: 1,
      date: this.today,
      articleId: null,
      refDoc: '',
      supplierDest: '',
      subcategory: '',
      remarks: ''
    });
    this.singleMovementType.set('Entrée');
    this.singleFormArticleId.set(null);
    this.movementForm.get('articleId')?.markAsUntouched();
    this.updateFormValidators('Entrée');
  }

  private resetBulkForm() {
    this.bulkMovementForm.reset({
      articleId: null,
      date: this.today,
      type: 'Sortie',
      movements: []
    });
    this.bulkMovementType.set('Sortie');
    this.bulkFormArticleId.set(null);
    this.bulkMovementsArray.clear();
    this.addBulkMovementRow();
  }

  private resetFixedBulkForm() {
    this.fixedBulkMovementForm.reset({
      type: 'Sortie',
      date: this.today,
      supplierDest: '',
      subcategory: '',
      refDoc: '',
      movements: []
    });
    this.fixedBulkMovementsArray.clear();
    this.addFixedBulkMovementRow();
    this.updateFixedBulkFormValidators('Sortie'); // Default type is Sortie
  }

  handleSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set(key === 'id' ? 'desc' : 'asc');
    }
  }

  applyFilters() {
    this.activeFilters.set(this.filterForm.value);
    this.currentPage.set(1);
  }

  async onSingleSubmit() {
    if (this.movementForm.invalid) return;
    try {
      const formValue = this.movementForm.getRawValue();
      const movementData = {
        ...formValue,
        articleId: String(formValue.articleId),
        userId: this.authService.currentUser()!.id,
      };
      const { id, ...newMovement } = movementData;
      await this.apiService.addMovement(newMovement as Omit<Movement, 'id'>);
      this.notificationService.showSuccess(this.t().common.addSuccess);
      this.resetMovementForm();

    } catch (error: any) {
      console.error("Failed to save movement", error);
      if (error?._isApiError && error.key === 'INSUFFICIENT_STOCK') {
        this.notificationService.showError(this.translationService.translate('errors.insufficientStock', error.params));
      } else {
        this.notificationService.showError(this.translationService.translate('errors.failedToSaveMovement'));
      }
    }
  }

  async onModalSubmit() {
    if (this.movementForm.invalid) return;
    try {
      const formValue = this.movementForm.getRawValue();

      const movementData = {
        ...this.editingMovement(),
        ...formValue,
        articleId: String(formValue.articleId),
      };
      await this.apiService.updateMovement(movementData as Movement);
      this.notificationService.showSuccess(this.t().common.saveSuccess);
      this.closeModal();

    } catch (error: any) {
      console.error("Failed to save movement", error);
      if (error?._isApiError && error.key === 'INSUFFICIENT_STOCK') {
        this.notificationService.showError(this.translationService.translate('errors.insufficientStock', error.params));
      } else {
        this.notificationService.showError(this.translationService.translate('errors.failedToSaveMovement'));
      }
    }
  }

  async onBulkSubmit() {
    if (this.bulkMovementsArray.hasError('duplicateDestinations')) {
      this.notificationService.showWarning(this.t().movements.bulkForm.duplicateDestination);
      return;
    }

    if (this.bulkMovementForm.invalid) {
      this.notificationService.showWarning(this.t().movements.bulkForm.invalidForm);
      return;
    };

    const bulkFormValue = this.bulkMovementForm.getRawValue();
    const articleId = String(bulkFormValue.articleId);
    const article = this.apiService.articles().find(a => a.id === articleId);
    if (!article) return;

    // FIX: The value from getRawValue() is untyped. Cast to BulkMovementRow[] to satisfy TypeScript.
    const movements = (bulkFormValue.movements || []) as BulkMovementRow[];
    const totalQuantityToWithdraw = movements.reduce((sum, m) => sum + m.quantity, 0);

    if (bulkFormValue.type !== 'Entrée') {
      const stockItem = this.apiService.stock().find(s => s.id === articleId);
      const currentStock = stockItem?.currentStock || 0;
      if (currentStock < totalQuantityToWithdraw) {
        this.notificationService.showError(this.translationService.translate('errors.insufficientStock', {
          articleName: article.name,
          available: currentStock,
          required: totalQuantityToWithdraw
        }));
        return;
      }
    }

    try {
      let movementsAdded = 0;
      for (const m of movements) {
        if (m.quantity > 0 && m.supplierDest) {
          const newMovement: Omit<Movement, 'id'> = {
            articleId: articleId,
            userId: this.authService.currentUser()!.id,
            date: bulkFormValue.date!,
            type: bulkFormValue.type!,
            quantity: m.quantity,
            supplierDest: m.supplierDest,
            subcategory: m.subcategory,
            refDoc: '',
            remarks: m.remarks
          };
          await this.apiService.addMovement(newMovement);
          movementsAdded++;
        }
      }
      this.notificationService.showSuccess(this.translationService.translate('movements.bulkForm.success', { count: movementsAdded }));
      this.resetBulkForm();
    } catch (error) {
      this.notificationService.showError(this.translationService.translate('errors.failedToSaveMovement'));
    }
  }

  async onFixedBulkSubmit() {
    if (this.fixedBulkMovementForm.invalid) {
      this.notificationService.showWarning(this.t().movements.bulkForm.invalidForm);
      return;
    }

    const formValue = this.fixedBulkMovementForm.getRawValue();
    const movements = (formValue.movements || []) as Array<{ articleId: string | null, quantity: number, remarks?: string }>;

    // Filter valid movements
    const validMovements = movements.filter(m => m.articleId && m.quantity > 0);

    if (validMovements.length === 0) {
      this.notificationService.showWarning(this.t().movements.bulkForm.invalidForm);
      return;
    }

    // STRICT VALIDATION: Check stock for ALL articles BEFORE saving ANY
    if (formValue.type !== 'Entrée') {
      const stockErrors: string[] = [];

      for (const m of validMovements) {
        const article = this.articles().find(a => a.id === m.articleId);
        if (!article) continue;

        const stockItem = this.apiService.stock().find(s => s.id === m.articleId);
        const currentStock = stockItem?.currentStock || 0;

        if (currentStock < m.quantity) {
          stockErrors.push(`${article.name}: ${this.t().movements.form.inStock} ${currentStock}, requis ${m.quantity}`);
        }
      }

      // If ANY article has insufficient stock, BLOCK ALL
      if (stockErrors.length > 0) {
        this.notificationService.showError(
          (this.t().movements.fixedBulkForm?.insufficientStockTitle || 'Stock insuffisant') + ':\n' + stockErrors.join('\n')
        );
        return;
      }
    }

    // All validations passed, save all movements
    try {
      let movementsAdded = 0;

      for (const m of validMovements) {
        const newMovement: Omit<Movement, 'id'> = {
          articleId: m.articleId!,
          userId: this.authService.currentUser()!.id,
          date: formValue.date!,
          type: formValue.type!,
          quantity: m.quantity,
          supplierDest: formValue.supplierDest!,
          subcategory: formValue.subcategory || '',
          refDoc: formValue.refDoc || '',
          remarks: m.remarks || ''
        };

        await this.apiService.addMovement(newMovement);
        movementsAdded++;
      }

      this.notificationService.showSuccess(
        this.translationService.translate('movements.fixedBulkForm.success', { count: movementsAdded }) ||
        `${movementsAdded} mouvements ajoutés avec succès`
      );
      this.resetFixedBulkForm();
      this.activeForm.set(null);
    } catch (error) {
      console.error('Error adding fixed bulk movements:', error);
      this.notificationService.showError(this.t().common.error);
    }
  }

  async onDelete(movement: Movement) {
    const title = this.translationService.translate('common.deleteConfirmationTitle');
    const confirmationMessage = this.translationService.translate('movements.deleteConfirmation', { id: movement.id });

    const confirmed = await this.confirmationService.confirm(title, confirmationMessage);

    if (confirmed) {
      try {
        await this.apiService.deleteMovement(movement.id);
        this.notificationService.showSuccess(this.t().common.deleteSuccess);
      } catch (error: any) {
        console.error("Failed to delete movement", error);
        let errorMessage: string;
        if (error?._isApiError && error.key === 'INSUFFICIENT_STOCK_ON_DELETE') {
          errorMessage = this.translationService.translate('errors.insufficientStockOnDelete', error.params);
        } else {
          errorMessage = this.translationService.translate('errors.failedToDeleteMovement');
        }
        this.notificationService.showError(errorMessage);
      }
    }
  }

  resetFilters() {
    this.filterForm.reset({ startDate: '', endDate: '', type: '', supplier: '', destination: '', articleSearch: '' });
    this.applyFilters();
  }

  exportToExcel() {
    const movements = this.filteredMovements();
    if (movements.length === 0) {
      this.notificationService.showWarning(this.translationService.translate('common.noDataToExport'));
      return;
    }
    const t = this.t();
    const dataToExport = movements.map(m => ({
      ID: m.id,
      Article: this.articleNameMap().get(m.articleId),
      Date: m.date,
      Type: t.movements.types[m.type as keyof typeof t.movements.types] || m.type,
      Quantity: m.quantity,
      'Supplier/Destination': m.supplierDest,
      'Subcategory': m.subcategory,
      Reference: m.refDoc,
      Remarks: m.remarks
    }));

    this.exportService.exportToExcel(dataToExport, 'Movements');
  }
}
