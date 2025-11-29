import { ChangeDetectionStrategy, Component, computed, inject, signal, ElementRef, viewChild, effect, AfterViewInit, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { TranslationService } from '../../services/translation.service';
import { SearchableSelectComponent } from '../shared/searchable-select.component';
import { Movement } from '../../models/movement.model';

declare var d3: any;

@Component({
  selector: 'app-dashboard',
  imports: [ReactiveFormsModule, SearchableSelectComponent],
  standalone: true,
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements AfterViewInit, OnInit {
  private apiService = inject(ApiService);
  // FIX: Add explicit type to injected FormBuilder.
  private fb: FormBuilder = inject(FormBuilder);
  private translationService = inject(TranslationService);

  t = this.translationService.currentTranslations;

  outgoingByDestChart = viewChild<ElementRef>('outgoingByDestChart');
  incomingBySupChart = viewChild<ElementRef>('incomingBySupChart');

  // --- Form Groups for each widget ---
  dailyLogFiltersForm = this.fb.group({
    date: [new Date().toISOString().split('T')[0]],
    articleId: [''],
    supplier: [''],
    destination: [''],
  });

  topItemsFiltersForm = this.fb.group({
    startDate: [this.getFirstDayOfMonth()],
    endDate: [this.getLastDayOfMonth()],
    category: [''],
  });

  analysisFiltersForm = this.fb.group({
    startDate: [this.getFirstDayOfMonth()],
    endDate: [this.getLastDayOfMonth()],
    category: [''],
    articleId: [''],
  });

  // --- Signals for applied filters ---
  appliedDailyLogFilters = signal(this.dailyLogFiltersForm.value);
  appliedTopItemsFilters = signal(this.topItemsFiltersForm.value);
  appliedAnalysisFilters = signal(this.analysisFiltersForm.value);

  // --- Base Data Signals ---
  articles = this.apiService.articles;
  movements = this.apiService.movements;

  articleMap = computed(() => new Map(this.articles().map(a => [a.id, a])));

  // --- Helper signals for filters ---
  searchableArticles = computed(() => {
    // FIX: Corrected translation key from 'dashboard' to 'reports'.
    const allArticlesOption = { id: '', name: this.t().reports.dailyLog.allArticles };
    const formattedArticles = this.articles().map(a => ({ id: a.id, name: `${a.name} (${a.code})` }));
    return [allArticlesOption, ...formattedArticles];
  });
  allCategories = computed(() => this.apiService.settings().categories);
  allSuppliers = computed(() => this.apiService.settings().suppliers);
  allDestinations = computed(() => this.apiService.settings().destinations);


  // --- Widget 1: Daily Log Data ---
  dailyLogData = computed(() => {
    const filters = this.appliedDailyLogFilters();
    if (!filters.date) return [];

    return this.movements()
      .filter(m => {
        const dateMatch = m.date === filters.date;
        const articleMatch = !filters.articleId || m.articleId === filters.articleId;

        const supplier = filters.supplier;
        const destination = filters.destination;

        let supplierDestMatch = true;
        if (supplier) {
          supplierDestMatch = m.type === 'Entrée' && m.supplierDest === supplier;
        }
        if (destination) {
          // If a supplier filter is also active, this condition should be OR'd
          const destinationMatch = (m.type === 'Sortie' || m.type === 'Périmé / Rebut') && m.supplierDest === destination;
          supplierDestMatch = supplier ? supplierDestMatch || destinationMatch : destinationMatch;
        }

        return dateMatch && articleMatch && supplierDestMatch;
      })
      .sort((a, b) => b.id.localeCompare(a.id));
  });

  // --- Widget 2: Top Moved Items Data ---
  topMovedItemsData = computed(() => {
    const filters = this.appliedTopItemsFilters();
    const articleMap = this.articleMap();
    if (!filters.startDate || !filters.endDate) return [];

    const items: { [id: string]: { name: string, quantity: number } } = {};

    this.movements().forEach(m => {
      if (m.date >= filters.startDate! && m.date <= filters.endDate!) {
        const article = articleMap.get(m.articleId);
        if (article && (!filters.category || article.category === filters.category)) {
          if (m.type === 'Sortie' || m.type === 'Périmé / Rebut') {
            if (!items[m.articleId]) {
              items[m.articleId] = { name: article.name, quantity: 0 };
            }
            items[m.articleId].quantity += m.quantity;
          }
        }
      }
    });

    return Object.values(items)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // --- Widget 3: Analysis Data ---
  private analysisMovements = computed(() => {
    const filters = this.appliedAnalysisFilters();
    const articleMap = this.articleMap();
    if (!filters.startDate || !filters.endDate) return [];

    return this.movements().filter(m => {
      const article = articleMap.get(m.articleId);
      if (!article) return false;

      const dateMatch = m.date >= filters.startDate! && m.date <= filters.endDate!;
      const categoryMatch = !filters.category || article.category === filters.category;
      const articleMatch = !filters.articleId || m.articleId === filters.articleId;

      return dateMatch && categoryMatch && articleMatch;
    });
  });

  outgoingByDestData = computed(() => {
    const dataByDest: { [dest: string]: number } = {};
    this.analysisMovements().forEach(m => {
      if ((m.type === 'Sortie' || m.type === 'Périmé / Rebut') && m.supplierDest) {
        dataByDest[m.supplierDest] = (dataByDest[m.supplierDest] || 0) + m.quantity;
      }
    });
    return Object.entries(dataByDest).map(([name, value]) => ({ name, value }));
  });

  incomingBySupData = computed(() => {
    const dataBySup: { [sup: string]: number } = {};
    this.analysisMovements().forEach(m => {
      if (m.type === 'Entrée' && m.supplierDest) {
        dataBySup[m.supplierDest] = (dataBySup[m.supplierDest] || 0) + m.quantity;
      }
    });
    return Object.entries(dataBySup).map(([name, value]) => ({ name, value }));
  });


  constructor() {
    // Intentionally left blank. Initialization moved to ngOnInit.
  }

  ngOnInit(): void {
    this.applyAllFilters();
  }

  ngAfterViewInit(): void {
    effect(() => this.drawOutgoingByDestChart(this.outgoingByDestData()));
    effect(() => this.drawIncomingBySupChart(this.incomingBySupData()));
  }

  applyAllFilters() {
    this.applyDailyLogFilters();
    this.applyTopItemsFilters();
    this.applyAnalysisFilters();
  }

  applyDailyLogFilters() { this.appliedDailyLogFilters.set(this.dailyLogFiltersForm.value); }
  applyTopItemsFilters() { this.appliedTopItemsFilters.set(this.topItemsFiltersForm.value); }
  applyAnalysisFilters() { this.appliedAnalysisFilters.set(this.analysisFiltersForm.value); }

  // --- D3 Chart Drawing ---
  private drawOutgoingByDestChart(data: { name: string, value: number }[]) {
    const container = this.outgoingByDestChart()?.nativeElement;
    if (!container) return;

    d3.select(container).select('svg').remove();
    if (!data || data.length === 0) return;

    const width = container.clientWidth;
    const height = 300;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select(container).append('svg')
      .attr('width', width).attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const pie = d3.pie().value((d: any) => d.value).sort(null);
    const data_ready = pie(data);

    const arc = d3.arc().innerRadius(radius * 0.5).outerRadius(radius);

    svg.selectAll('path')
      .data(data_ready)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d: any) => color(d.data.name))
      .attr('stroke', 'white').style('stroke-width', '2px')
      .append('title')
      .text((d: any) => `${d.data.name}: ${d.data.value}`);
  }

  private drawIncomingBySupChart(data: { name: string, value: number }[]) {
    const container = this.incomingBySupChart()?.nativeElement;
    if (!container) return;

    d3.select(container).select('svg').remove();
    if (!data || data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 80, left: 40 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(container).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map((d: any) => d.name))
      .padding(0.3);

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x))
      .selectAll('text').attr('transform', 'translate(-10,0)rotate(-45)').style('text-anchor', 'end');

    const y = d3.scaleLinear().domain([0, d3.max(data, (d: any) => d.value)]).range([height, 0]);
    svg.append('g').call(d3.axisLeft(y));

    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d: any) => x(d.name))
      .attr('y', (d: any) => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', (d: any) => height - y(d.value))
      .attr('fill', '#60a5fa');
  }

  private getFirstDayOfMonth(): string {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }

  private getLastDayOfMonth(): string {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  }
}
