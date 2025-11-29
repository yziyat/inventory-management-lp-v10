import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormGroup } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Article } from '../../models/article.model';
import { ModalComponent } from '../shared/modal.component';
import { TableHeaderComponent } from '../shared/table-header.component';
import { TranslationService } from '../../services/translation.service';
import { ExportService } from '../../services/export.service';
import { ApiError } from '../../services/api-error';
import { ConfirmationService } from '../../services/confirmation.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { ArticleDetailComponent } from './article-detail.component';
import { CustomDatePipe } from '../../pipes/custom-date.pipe';
import { PaginationComponent } from '../shared/pagination.component';

declare var XLSX: any;

type ArticleForImport = Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'priceHistory'>;

@Component({
  selector: 'app-articles',
  templateUrl: './articles.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, TableHeaderComponent, ArticleDetailComponent, CustomDatePipe, PaginationComponent],
  standalone: true,
})
export class ArticlesComponent {
  protected readonly Infinity = Infinity;
  private apiService = inject(ApiService);
  private fb: FormBuilder = inject(FormBuilder);
  private translationService = inject(TranslationService);
  private exportService = inject(ExportService);
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  authService = inject(AuthService);
  t = this.translationService.currentTranslations;

  isModalOpen = signal(false);
  editingArticle = signal<Article | null>(null);

  // Article Detail Modal
  selectedArticle = signal<Article | null>(null);
  isDetailModalOpen = computed(() => !!this.selectedArticle());

  // Import Modal
  isImportModalOpen = signal(false);
  importFileName = signal('');

  importForm = this.fb.group({
    articles: this.fb.array([])
  });

  get importArticlesArray() {
    return this.importForm.get('articles') as FormArray;
  }

  // Sorting
  sortKey = signal('name');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Filtering
  searchTerm = signal('');
  filterCategory = signal('');

  // Pagination
  itemsPerPage = signal(100);
  currentPage = signal(1);

  categories = computed(() => this.apiService.settings().categories);
  articles = this.apiService.articles;

  filteredArticles = computed(() => {
    const articles = this.articles();
    const term = this.searchTerm().toLowerCase();
    const category = this.filterCategory();
    const key = this.sortKey();
    const dir = this.sortDirection();

    return articles
      .filter(a =>
        (a.name.toLowerCase().includes(term) || a.code.toLowerCase().includes(term)) &&
        (category === '' || a.category === category)
      )
      .sort((a, b) => {
        const valA = a[key as keyof Article];
        const valB = b[key as keyof Article];
        let comparison = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else {
          comparison = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
        }
        return dir === 'asc' ? comparison : -comparison;
      });
  });

  paginatedArticles = computed(() => {
    const items = this.filteredArticles();
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
    const total = this.filteredArticles().length;
    if (total === 0) return '';

    const page = this.currentPage();
    const perPage = this.itemsPerPage();

    if (perPage === Infinity) {
      return this.translationService.translate('articles.pagination.showingAll', {
        count: total
      });
    }

    const start = (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);

    return this.translationService.translate('articles.pagination.showing', {
      start,
      end,
      total
    });
  });

  articleForm = this.fb.group({
    id: [null as number | null],
    name: ['', Validators.required],
    code: ['', Validators.required],
    category: ['', Validators.required],
    unit: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    alert: [0, [Validators.required, Validators.min(0)]],
    description: [''],
  });

  constructor() {
    effect(() => {
      const article = this.editingArticle();
      if (article) {
        this.articleForm.patchValue(article);
        this.isModalOpen.set(true);
      }
    });
  }

  setItemsPerPage(count: number) {
    this.itemsPerPage.set(count);
    this.currentPage.set(1);
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    window.scrollTo(0, 0);
  }

  openAddModal() {
    this.editingArticle.set(null);
    this.articleForm.reset({ price: 0, alert: 0, category: '', unit: '' });
    this.isModalOpen.set(true);
  }

  openEditModal(article: Article) {
    this.editingArticle.set(article);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingArticle.set(null);
    this.articleForm.reset();
  }

  openDetailModal(article: Article) {
    this.selectedArticle.set(article);
  }

  closeDetailModal() {
    this.selectedArticle.set(null);
  }

  handleSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
  }

  onFilterTermChange(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  onFilterCategoryChange(event: Event) {
    this.filterCategory.set((event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
  }

  resetCategoryFilter() {
    this.filterCategory.set('');
    this.currentPage.set(1);
  }

  async onSubmit() {
    if (this.articleForm.invalid) return;

    try {
      const formValue = this.articleForm.value;

      if (this.editingArticle()) {
        const articleData = {
          ...this.editingArticle(),
          ...formValue
        } as Article;
        this.apiService.updateArticle(articleData);
        this.notificationService.showSuccess(this.t().common.saveSuccess);
      } else {
        // New article logic with name check
        const potentialName = formValue.name || '';
        const existingArticleWithSameName = this.apiService.articles().find(a =>
          this.apiService.normalizeString(a.name) === this.apiService.normalizeString(potentialName)
        );

        if (existingArticleWithSameName) {
          const title = this.t().articles.nameExistsConfirmationTitle;
          const message = this.translationService.translate('articles.nameExistsConfirmationMessage', { name: potentialName });
          const confirmed = await this.confirmationService.confirm(title, message);
          if (!confirmed) {
            return; // User cancelled
          }
        }

        const { id, createdAt, updatedAt, priceHistory, ...newArticle } = formValue as Article;
        this.apiService.addArticle(newArticle as Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'priceHistory'>);
        this.notificationService.showSuccess(this.t().common.addSuccess);
      }
      this.closeModal();
    } catch (error: any) {
      console.error("Failed to save article", error);
      let errorMessage: string;
      if (error?._isApiError) {
        switch (error.key) {
          case 'ARTICLE_CODE_EXISTS':
            errorMessage = this.translationService.translate('errors.articleCodeExists');
            break;
          case 'ARTICLE_NAME_UNIT_EXISTS':
            errorMessage = this.translationService.translate('errors.articleNameUnitExists');
            break;
          default:
            errorMessage = this.translationService.translate('errors.failedToSaveArticle');
        }
      } else {
        errorMessage = this.translationService.translate('errors.failedToSaveArticle');
      }
      this.notificationService.showError(errorMessage);
    }
  }

  async onDelete(article: Article) {
    const title = this.translationService.translate('common.deleteConfirmationTitle');
    const message = this.translationService.translate('articles.deleteConfirmation', { name: article.name });

    const confirmed = await this.confirmationService.confirm(title, message);

    if (confirmed) {
      try {
        this.apiService.deleteArticle(article.id);
        this.notificationService.showSuccess(this.t().common.deleteSuccess);
      } catch (error: any) {
        console.error("Failed to delete article", error);
        let errorMessage: string;
        if (error?._isApiError && error.key === 'ARTICLE_IN_USE') {
          errorMessage = this.translationService.translate('errors.articleInUse');
        } else {
          errorMessage = this.translationService.translate('errors.failedToDeleteArticle');
        }
        this.notificationService.showError(errorMessage);
      }
    }
  }

  exportToExcel() {
    const articles = this.filteredArticles();
    if (articles.length === 0) {
      this.notificationService.showWarning(this.translationService.translate('common.noDataToExport'));
      return;
    }
    const dataToExport = articles.map(({ id, createdAt, updatedAt, priceHistory, ...rest }) => rest);
    this.exportService.exportToExcel(dataToExport, 'Articles');
  }

  // --- Import Logic ---
  onFileChange(event: any) {
    const target = event.target;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        this.importFileName.set(file.name);
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const bstr = e.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          this.processImportData(data);
        };
        reader.readAsBinaryString(file);
      } else {
        this.notificationService.showError(this.t().errors.invalidFileFormat);
      }
    }
    target.value = ''; // Reset file input
  }

  private processImportData(data: any[][]) {
    this.importArticlesArray.clear();
    if (data.length < 2) {
      this.isImportModalOpen.set(true);
      return;
    }
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const requiredHeaders = ['name', 'code', 'category', 'unit', 'price', 'alert'];

    const missingHeaders = requiredHeaders.filter(rh => !headers.includes(rh));
    if (missingHeaders.length > 0) {
      this.notificationService.showError(`Missing columns in Excel file: ${missingHeaders.join(', ')}`);
      return;
    }

    const nameIndex = headers.indexOf('name');
    const codeIndex = headers.indexOf('code');
    const categoryIndex = headers.indexOf('category');
    const unitIndex = headers.indexOf('unit');
    const priceIndex = headers.indexOf('price');
    const alertIndex = headers.indexOf('alert');
    const descriptionIndex = headers.indexOf('description');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && (row[nameIndex] != null && String(row[nameIndex]).trim() !== '') && (row[codeIndex] != null && String(row[codeIndex]).trim() !== '')) {
        const articleGroup = this.fb.group({
          name: [String(row[nameIndex]).trim(), Validators.required],
          code: [String(row[codeIndex]).trim(), Validators.required],
          category: [String(row[categoryIndex] || 'Autres').trim(), Validators.required],
          unit: [String(row[unitIndex] || 'Unité').trim(), Validators.required],
          price: [parseFloat(String(row[priceIndex] || '0').replace(',', '.')) || 0, [Validators.required, Validators.min(0)]],
          alert: [parseInt(String(row[alertIndex] || '0'), 10) || 0, [Validators.required, Validators.min(0)]],
          description: [String(row[descriptionIndex] || '').trim()],
        });
        this.importArticlesArray.push(articleGroup);
      }
    }
    this.isImportModalOpen.set(true);
  }

  confirmImport() {
    if (this.importForm.invalid) {
      this.notificationService.showError("Please correct the errors in the import preview.");
      return;
    }
    try {
      const articlesToImport = this.importArticlesArray.value;
      this.apiService.addArticles(articlesToImport);
      this.notificationService.showSuccess(`${articlesToImport.length} articles imported successfully.`);
      this.closeImportModal();
    } catch (e: any) {
      console.error("Failed to import articles", e);
      let errorMessage: string;
      if (e?._isApiError) {
        switch (e.key) {
          case 'ARTICLE_CODE_EXISTS':
            errorMessage = this.translationService.translate('errors.articleCodeExists');
            break;
          case 'ARTICLE_NAME_UNIT_EXISTS':
            errorMessage = this.translationService.translate('errors.articleNameUnitExists');
            break;
          default:
            errorMessage = this.translationService.translate('errors.importFailed');
        }
      } else {
        errorMessage = this.translationService.translate('errors.importFailed');
      }
      this.notificationService.showError(errorMessage);
    }
  }

  closeImportModal() {
    this.isImportModalOpen.set(false);
    this.importArticlesArray.clear();
    this.importFileName.set('');
  }
}