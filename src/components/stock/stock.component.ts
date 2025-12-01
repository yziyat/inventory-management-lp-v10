import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { TableHeaderComponent } from '../shared/table-header.component';
import { TranslationService } from '../../services/translation.service';
import { ExportService } from '../../services/export.service';
import { NotificationService } from '../../services/notification.service';
import { Article } from '../../models/article.model';
import { ArticleDetailComponent } from '../articles/article-detail.component';
import { StockItem } from '../../models/stock-item.model';
import { PaginationComponent } from '../shared/pagination.component';
import { SearchableSelectComponent } from '../shared/searchable-select.component';

@Component({
  selector: 'app-stock',
  templateUrl: './stock.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableHeaderComponent, ArticleDetailComponent, PaginationComponent, SearchableSelectComponent],
  standalone: true,
})
export class StockComponent {
  protected readonly Infinity = Infinity;
  private apiService = inject(ApiService);
  private translationService = inject(TranslationService);
  private exportService = inject(ExportService);
  private notificationService = inject(NotificationService);
  t = this.translationService.currentTranslations;

  stock = this.apiService.stock;
  categories = computed(() => this.apiService.settings().categories);

  // Article Detail Modal
  selectedArticle = signal<Article | null>(null);
  isDetailModalOpen = computed(() => !!this.selectedArticle());

  // KPIs
  totalArticles = computed(() => this.apiService.articles().length);
  lowStockItems = computed(() => this.stock().filter(item => item.currentStock <= item.alert && item.alert > 0).length);
  outOfStockItems = computed(() => this.stock().filter(item => item.currentStock === 0).length);
  totalStockValue = computed(() => this.stock().reduce((acc, item) => acc + (item.currentStock * item.price), 0));

  formattedTotalStockValue = computed(() => {
    const value = this.totalStockValue();
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  });

  // Sorting
  sortKey = signal('name');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Filtering
  searchTerm = signal('');
  filterCategory = signal('');
  showLowStockOnly = signal(false);
  showOutOfStockOnly = signal(false);

  // Pagination
  itemsPerPage = signal(100);
  currentPage = signal(1);

  filteredStock = computed(() => {
    const stock = this.stock();
    const term = this.searchTerm().toLowerCase();
    const category = this.filterCategory();
    const lowStockOnly = this.showLowStockOnly();
    const outOfStockOnly = this.showOutOfStockOnly();
    const key = this.sortKey();
    const dir = this.sortDirection();

    const stockStatusFilterActive = lowStockOnly || outOfStockOnly;

    return stock
      .filter(s =>
        (s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term)) &&
        (category === '' || s.category === category) &&
        (!stockStatusFilterActive ||
          (lowStockOnly && s.currentStock <= s.alert && s.alert > 0) ||
          (outOfStockOnly && s.currentStock === 0))
      )
      .sort((a, b) => {
        const valA = a[key as keyof typeof a];
        const valB = b[key as keyof typeof b];
        let comparison = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else {
          comparison = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
        }
        return dir === 'asc' ? comparison : -comparison;
      });
  });

  paginatedStock = computed(() => {
    const items = this.filteredStock();
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
    const total = this.filteredStock().length;
    if (total === 0) return '';

    const page = this.currentPage();
    const perPage = this.itemsPerPage();

    if (perPage === Infinity) {
      return this.translationService.translate('stock.pagination.showingAll', {
        count: total
      });
    }

    const start = (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);

    return this.translationService.translate('stock.pagination.showing', {
      start,
      end,
      total
    });
  });

  setItemsPerPage(count: number) {
    this.itemsPerPage.set(count);
    this.currentPage.set(1);
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    window.scrollTo(0, 0);
  }

  handleSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
  }

  openDetailModal(article: Article) {
    this.selectedArticle.set(article);
  }

  closeDetailModal() {
    this.selectedArticle.set(null);
  }

  onFilterTermChange(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  onFilterCategoryChange(event: Event) {
    this.filterCategory.set((event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
  }

  onLowStockToggle(event: Event) {
    this.showLowStockOnly.set((event.target as HTMLInputElement).checked);
    this.currentPage.set(1);
  }

  onOutOfStockToggle(event: Event) {
    this.showOutOfStockOnly.set((event.target as HTMLInputElement).checked);
    this.currentPage.set(1);
  }

  resetFilters() {
    this.searchTerm.set('');
    this.filterCategory.set('');
    this.showLowStockOnly.set(false);
    this.showOutOfStockOnly.set(false);
    this.currentPage.set(1);

    const lowStockCheckbox = document.getElementById('low-stock-checkbox') as HTMLInputElement;
    if (lowStockCheckbox) lowStockCheckbox.checked = false;

    const outOfStockCheckbox = document.getElementById('out-of-stock-checkbox') as HTMLInputElement;
    if (outOfStockCheckbox) outOfStockCheckbox.checked = false;
  }

  exportToExcel() {
    const stockItems = this.filteredStock();
    if (stockItems.length === 0) {
      this.notificationService.showWarning(this.translationService.translate('common.noDataToExport'));
      return;
    }

    const t = this.t();
    const dataToExport = stockItems.map(item => ({
      ID: item.id,
      Name: item.name,
      Code: item.code,
      Category: item.category,
      'Current Stock': item.currentStock,
      'Alert Threshold': item.alert,
      Unit: item.unit,
      Price: item.price,
      'Stock Value': item.currentStock * item.price,
      Status: (item.currentStock <= item.alert && item.alert > 0) ? t.stock.status.low : t.stock.status.ok
    }));

    this.exportService.exportToExcel(dataToExport, 'Stock');
  }
}
