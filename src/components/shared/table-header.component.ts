import { ChangeDetectionStrategy, Component, input, output, inject, ElementRef, Renderer2, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'th[app-table-header]',
  imports: [],
  standalone: true,
  template: `
    <div class="flex items-center justify-center gap-2">
      <ng-content></ng-content>
      @if (sortKey()) {
        <span class="text-gray-400">
          @if (activeSortKey() === sortKey()) {
            @if (sortDirection() === 'asc') {
              <span>▲</span>
            } @else {
              <span>▼</span>
            }
          } @else {
            <span class="opacity-50">▲▼</span>
          }
        </span>
      }
    </div>
  `,
  host: {
    '[class.cursor-pointer]': 'sortKey()',
    '[class.hover:bg-gray-200]': 'sortKey()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableHeaderComponent implements OnInit, OnDestroy {
  sortKey = input<string>();
  activeSortKey = input.required<string>();
  sortDirection = input.required<'asc' | 'desc'>();
  sort = output<string>();

  private renderer = inject(Renderer2);
  private elementRef = inject(ElementRef);
  private clickListener!: () => void;

  ngOnInit() {
    if (this.sortKey()) {
      this.clickListener = this.renderer.listen(this.elementRef.nativeElement, 'click', () => {
        this.onSort();
      });
    }
  }

  ngOnDestroy() {
    if (this.clickListener) {
      this.clickListener();
    }
  }

  onSort() {
    if (this.sortKey()) {
      if (this.sortKey()) {
        this.sort.emit(this.sortKey()!);
      }
    }
  }
}