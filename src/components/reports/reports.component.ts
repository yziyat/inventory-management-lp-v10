import { ChangeDetectionStrategy, Component, computed, inject, signal, ElementRef, viewChildren, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Movement } from '../../models/movement.model';
import { TranslationService } from '../../services/translation.service';
import { ExportService } from '../../services/export.service';
import { CustomDatePipe } from '../../pipes/custom-date.pipe';
import { NotificationService } from '../../services/notification.service';
import { SearchableSelectComponent } from '../shared/searchable-select.component';
import { ModalComponent } from '../shared/modal.component';

interface DetailedReportRow {
  articleId: string;
  articleName: string;
  articleCode: string;
  stockInitial: number;
  totalIn: number;
  totalOut: number;
  totalExpired: number;
  totalAdjustment: number;
  stockFinal: number;
  destinations: { [key: string]: number };
}

type ReportFilters = {
  articleName: Set<string>;
  articleCode: Set<string>;
  stockInitial: Set<number>;
  stockFinal: Set<number>;
}

import { NgClass } from '@angular/common';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CustomDatePipe, SearchableSelectComponent, ModalComponent, NgClass],
  standalone: true,
})
export class ReportsComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private fb: FormBuilder = inject(FormBuilder);
  private translationService = inject(TranslationService);
  private exportService = inject(ExportService);
  private notificationService = inject(NotificationService);
  private renderer = inject(Renderer2);
  private documentClickListener!: () => void;

  t = this.translationService.currentTranslations;

  articles = this.apiService.articles;
  rawReportData = signal<DetailedReportRow[] | null>(null);

  // Movement details modal
  isDetailModalOpen = signal(false);
  modalTitle = signal('');
  modalMovements = signal<Movement[]>([]);

  filterForm = this.fb.group({
    startDate: [this.getFirstDayOfMonth(), Validators.required],
    endDate: [this.getLastDayOfMonth(), Validators.required],
    articleId: [''],
    showOnlyMoved: [true]
  });

  today = new Date().toISOString().split('T')[0];

  // Daily Log properties
  dailyLogFiltersForm = this.fb.group({
    date: [this.today, Validators.required],
    articleId: [''],
    type: [''],
    supplier: [''],
    destination: [''],
  });
  appliedDailyLogFilters = signal(this.dailyLogFiltersForm.value);


  // Column filtering state
  activeFilterDropdown = signal<string | null>(null);
  reportFilters = signal<ReportFilters>({
    articleName: new Set(),
    articleCode: new Set(),
    stockInitial: new Set(),
    stockFinal: new Set()
  });
  filterContainers = viewChildren<ElementRef>('filterContainer');

  ngOnInit(): void {
    this.documentClickListener = this.renderer.listen('document', 'click', (event: MouseEvent) => {
      this.onDocumentClick(event);
    });
    this.applyDailyLogFilters();
  }

  ngOnDestroy(): void {
    if (this.documentClickListener) {
      this.documentClickListener();
    }
  }

  onDocumentClick(event: MouseEvent) {
    if (this.activeFilterDropdown()) {
      const clickedInside = this.filterContainers().some(ref => ref.nativeElement.contains(event.target));
      if (!clickedInside) {
        this.activeFilterDropdown.set(null);
      }
    }
  }

  reportDestinations = computed(() => {
    return this.apiService.settings().destinations;
  });

  userNameMap = computed(() => {
    const map = new Map<string, string>();
    this.apiService.users().forEach(u => map.set(u.id, `${u.firstName} ${u.lastName}`));
    return map;
  });

  articleMap = computed(() => new Map(this.articles().map(a => [a.id, a])));
  allSuppliers = computed(() => this.apiService.settings().suppliers);
  allDestinations = computed(() => this.apiService.settings().destinations);

  searchableArticlesForReport = computed(() => {
    const allArticlesOption = { id: '', name: this.t().reports.allArticles };
    const formattedArticles = this.articles().map(a => ({ id: a.id, name: `${a.name} (${a.code})` }));
    return [allArticlesOption, ...formattedArticles];
  });

  searchableArticlesForDailyLog = computed(() => {
    const allArticlesOption = { id: '', name: this.t().reports.dailyLog.allArticles };
    const formattedArticles = this.articles().map(a => ({ id: a.id, name: `${a.name} (${a.code})` }));
    return [allArticlesOption, ...formattedArticles];
  });

  displayReportData = computed(() => {
    let data = this.rawReportData();
    if (!data) return null;

    if (this.filterForm.get('showOnlyMoved')?.value) {
      data = data.filter(row => row.stockInitial > 0 || row.totalIn > 0 || row.totalOut > 0 || row.stockFinal > 0);
    }

    const filters = this.reportFilters();
    const hasActiveFilter = Object.values(filters).some(s => s.size > 0);
    if (!hasActiveFilter) {
      return data;
    }

    return data.filter(row => {
      const nameMatch = filters.articleName.size === 0 || filters.articleName.has(row.articleName);
      const codeMatch = filters.articleCode.size === 0 || filters.articleCode.has(row.articleCode);
      const initialMatch = filters.stockInitial.size === 0 || filters.stockInitial.has(row.stockInitial);
      const finalMatch = filters.stockFinal.size === 0 || filters.stockFinal.has(row.stockFinal);
      return nameMatch && codeMatch && initialMatch && finalMatch;
    });
  });

  dailyLogData = computed(() => {
    const filters = this.appliedDailyLogFilters();
    if (!filters.date) return [];

    return this.apiService.movements()
      .filter(m => {
        const dateMatch = m.date === filters.date;
        const articleMatch = !filters.articleId || m.articleId === filters.articleId;
        const typeMatch = !filters.type || m.type === filters.type;

        const supplier = filters.supplier;
        const destination = filters.destination;

        let supplierDestMatch = true;
        if (supplier && destination) {
          const supplierMatch = m.type === 'Entrée' && m.supplierDest === supplier;
          const destinationMatch = (m.type === 'Sortie' || m.type === 'Périmé / Rebut') && m.supplierDest === destination;
          supplierDestMatch = supplierMatch || destinationMatch;
        } else if (supplier) {
          supplierDestMatch = m.type === 'Entrée' && m.supplierDest === supplier;
        } else if (destination) {
          supplierDestMatch = (m.type === 'Sortie' || m.type === 'Périmé / Rebut') && m.supplierDest === destination;
        }


        return dateMatch && articleMatch && typeMatch && supplierDestMatch;
      })
      .sort((a, b) => b.id.localeCompare(a.id));
  });

  applyDailyLogFilters() { this.appliedDailyLogFilters.set(this.dailyLogFiltersForm.value); }

  resetDailyLogFilters() {
    this.dailyLogFiltersForm.reset({
      date: this.today,
      articleId: '',
      type: '',
      supplier: '',
      destination: ''
    });
    this.applyDailyLogFilters();
  }

  uniqueValues = computed(() => {
    const data = this.rawReportData();
    if (!data) return { articleName: [], articleCode: [], stockInitial: [], stockFinal: [] };

    return {
      articleName: [...new Set(data.map(r => r.articleName))].sort((a, b) => a.localeCompare(b)),
      articleCode: [...new Set(data.map(r => r.articleCode))].sort((a, b) => a.localeCompare(b)),
      stockInitial: [...new Set(data.map(r => r.stockInitial))].sort((a, b) => a - b),
      stockFinal: [...new Set(data.map(r => r.stockFinal))].sort((a, b) => a - b)
    };
  });


  constructor() {
    this.generateReport();
  }

  private getFirstDayOfMonth(): string {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }

  private getLastDayOfMonth(): string {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  generateReport() {
    if (this.filterForm.invalid) return;
    this.reportFilters.set({ articleName: new Set(), articleCode: new Set(), stockInitial: new Set(), stockFinal: new Set() }); // Reset column filters

    const { startDate, endDate, articleId } = this.filterForm.value;
    const allMovements = this.apiService.movements();
    const allArticles = this.apiService.articles();
    const destinations = this.reportDestinations();

    const selectedArticleId = articleId ? String(articleId) : null;

    const filteredArticles = selectedArticleId
      ? allArticles.filter(a => a.id === selectedArticleId)
      : allArticles;

    const report: DetailedReportRow[] = filteredArticles.map(article => {
      const articleMovements = allMovements.filter(m => m.articleId === article.id);

      const stockInitial = articleMovements
        .filter(m => m.date < startDate!)
        .reduce((acc, m) => acc + this.getSignedQuantity(m), 0);

      const movementsInPeriod = articleMovements.filter(m => m.date >= startDate! && m.date <= endDate!);

      // Entrées uniquement (pas d'ajustement)
      const totalIn = movementsInPeriod
        .filter(m => m.type === 'Entrée')
        .reduce((sum, m) => sum + m.quantity, 0);

      // Sorties uniquement (sans périmé)
      const totalOut = movementsInPeriod
        .filter(m => m.type === 'Sortie')
        .reduce((sum, m) => sum + m.quantity, 0);

      // Périmé / Rebut
      const totalExpired = movementsInPeriod
        .filter(m => m.type === 'Périmé / Rebut')
        .reduce((sum, m) => sum + m.quantity, 0);

      // Ajustements (peuvent être positifs ou négatifs)
      const totalAdjustment = movementsInPeriod
        .filter(m => m.type === 'Ajustement')
        .reduce((sum, m) => sum + m.quantity, 0);

      const destinationBreakdown: { [key: string]: number } = {};
      destinations.forEach(dest => {
        destinationBreakdown[dest] = movementsInPeriod
          .filter(m => (m.type === 'Sortie' || m.type === 'Périmé / Rebut') && m.supplierDest === dest)
          .reduce((sum, m) => sum + m.quantity, 0);
      });

      // Formule correcte: Stock initial + Entrée - Périmé - Sorties + Ajustement
      const stockFinal = stockInitial + totalIn - totalExpired - totalOut + totalAdjustment;

      return {
        articleId: article.id,
        articleName: article.name,
        articleCode: article.code,
        stockInitial,
        totalIn,
        totalOut,
        totalExpired,
        totalAdjustment,
        stockFinal,
        destinations: destinationBreakdown,
      };
    });

    report.sort((a, b) => a.articleName.localeCompare(b.articleName));
    this.rawReportData.set(report);
  }

  private getSignedQuantity(movement: Movement): number {
    if (movement.type === 'Entrée' || movement.type === 'Ajustement') {
      return movement.quantity;
    }
    return -movement.quantity;
  }

  resetFilters() {
    this.filterForm.reset({
      startDate: this.getFirstDayOfMonth(),
      endDate: this.getLastDayOfMonth(),
      articleId: '',
      showOnlyMoved: true
    });
    this.generateReport();
  }

  exportToExcel() {
    const mainReport = this.displayReportData();

    if (mainReport && mainReport.length > 0) {
      this.exportMainReport(mainReport);
    } else {
      this.notificationService.showWarning(this.translationService.translate('common.noDataToExport'));
    }
  }

  private exportMainReport(data: DetailedReportRow[]) {
    const destinations = this.reportDestinations();
    const t = this.t();
    const dataToExport = data.map(row => {
      const exportedRow: any = {
        [t.reports.table.article]: row.articleName,
        [t.reports.table.code]: row.articleCode,
        [t.reports.table.initialStock]: row.stockInitial,
        [t.reports.table.totalIn]: row.totalIn,
        [t.reports.table.totalOut]: row.totalOut,
        [t.reports.table.totalExpired]: row.totalExpired,
      };
      destinations.forEach(dest => {
        exportedRow[dest] = row.destinations[dest] || 0;
      });
      exportedRow[t.reports.table.totalAdjustment] = row.totalAdjustment;
      exportedRow[t.reports.table.finalStock] = row.stockFinal;
      return exportedRow;
    });
    this.exportService.exportToExcel(dataToExport, 'Report_Stock_Movement');
  }

  toggleFilterDropdown(column: keyof ReportFilters | null) {
    this.activeFilterDropdown.update(current => current === column ? null : column);
  }

  handleFilterChange(column: keyof ReportFilters, value: string | number, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.reportFilters.update(filters => {
      if (column === 'articleName' || column === 'articleCode') {
        const newSet = new Set(filters[column]);
        if (isChecked) {
          newSet.add(value as string);
        } else {
          newSet.delete(value as string);
        }
        return { ...filters, [column]: newSet };
      } else {
        const newSet = new Set(filters[column]);
        if (isChecked) {
          newSet.add(value as number);
        } else {
          newSet.delete(value as number);
        }
        return { ...filters, [column]: newSet };
      }
    });
  }

  clearFilter(column: keyof ReportFilters, event: Event) {
    event.stopPropagation();
    this.reportFilters.update(filters => ({ ...filters, [column]: new Set() }));
    this.activeFilterDropdown.set(null);
  }

  isAllSelected(column: keyof ReportFilters): boolean {
    const unique = this.uniqueValues()[column];
    const selected = this.reportFilters()[column];
    return unique.length > 0 && selected.size === unique.length;
  }

  toggleSelectAll(column: keyof ReportFilters) {
    if (this.isAllSelected(column)) {
      this.reportFilters.update(filters => ({ ...filters, [column]: new Set() }));
    } else {
      const allValuesArray = this.uniqueValues()[column];
      let newSet: Set<string> | Set<number>;
      if (column === 'articleName' || column === 'articleCode') {
        newSet = new Set(allValuesArray as string[]);
      } else {
        newSet = new Set(allValuesArray as number[]);
      }
      this.reportFilters.update(filters => ({ ...filters, [column]: newSet }));
    }
  }

  openMovementDetailModal(row: DetailedReportRow, type: 'in' | 'out', destination?: string) {
    const { startDate, endDate } = this.filterForm.value;
    const allMovements = this.apiService.movements();
    let relevantMovements: Movement[] = [];

    if (type === 'in') {
      this.modalTitle.set(`${this.t().reports.table.totalIn} - ${row.articleName}`);
      relevantMovements = allMovements.filter(m =>
        m.articleId === row.articleId &&
        m.date >= startDate! && m.date <= endDate! &&
        (m.type === 'Entrée' || m.type === 'Ajustement')
      );
    } else if (type === 'out' && destination) {
      this.modalTitle.set(`${destination} - ${row.articleName}`);
      relevantMovements = allMovements.filter(m =>
        m.articleId === row.articleId &&
        m.date >= startDate! && m.date <= endDate! &&
        (m.type === 'Sortie' || m.type === 'Périmé / Rebut') &&
        m.supplierDest === destination
      );
    }

    this.modalMovements.set(relevantMovements.sort((a, b) => b.id.localeCompare(a.id)));
    this.isDetailModalOpen.set(true);
  }

  closeMovementDetailModal() {
    this.isDetailModalOpen.set(false);
    this.modalMovements.set([]);
    this.modalTitle.set('');
  }
}