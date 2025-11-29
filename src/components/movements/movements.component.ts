import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
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
  isSingleFormVisible = signal(false);
  isBulkFormVisible = signal(false);

  // Sorting
  sortKey = signal('id');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Filtering
  filterForm = this.fb.group({
    startDate: [''],
    endDate: [''],
    type: [''],
    supplierDest: [''],
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
    movements: this.fb.array([], [Validators.required, this.uniqueDestinationsValidator]),
  });

  bulkMovementType = signal<MovementType>(this.bulkMovementForm.get('type')!.value!);
  bulkFormArticleId = signal<string | null>(null);

  bulkFormSelectedArticleStock = computed(() => {
    const articleId = this.bulkFormArticleId();
    if (!articleId) return null;
    const stockItem = this.stock().find(s => s.id === articleId);
    return stockItem ? { stock: stockItem.currentStock, unit: stockItem.unit } : null;
  });


  get bulkMovementsArray() {
    return this.bulkMovementForm.get('movements') as FormArray;
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
        const destMatch = !filters.supplierDest || m.supplierDest === filters.supplierDest;
        return articleMatch && startDateMatch && endDateMatch && typeMatch && destMatch;
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
      this.bulkMovementsArray.controls.forEach(control => {
        control.get('supplierDest')?.reset('');
      });
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
    } else {
      subcategoryControl.disable();
      subcategoryControl.reset('');
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
    this.isSingleFormVisible.update(v => !v);
    this.isBulkFormVisible.set(false);
    if (this.isSingleFormVisible()) {
      this.resetMovementForm();
    }
  }

  toggleBulkForm() {
    this.isBulkFormVisible.update(v => !v);
    this.isSingleFormVisible.set(false);
    if (this.isBulkFormVisible()) {
      this.resetBulkForm();
    }
  }

  addBulkMovementRow() {
    const movementGroup = this.fb.group({
      quantity: [1, [Validators.required, Validators.min(1)]],
      supplierDest: ['', Validators.required],
      remarks: ['']
    });
    this.bulkMovementsArray.push(movementGroup);
  }

  removeBulkMovementRow(index: number) {
    this.bulkMovementsArray.removeAt(index);
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
    this.filterForm.reset({ startDate: '', endDate: '', type: '', supplierDest: '', articleSearch: '' });
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
