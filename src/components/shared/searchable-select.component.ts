// FIX: Import `computed` from `@angular/core` to resolve compilation error.
import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, signal, viewChild, effect, inject, Renderer2, OnInit, OnDestroy, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [],
  template: `
    <div class="relative" #self>
      <input 
        #input
        type="text" 
        [placeholder]="placeholder()"
        class="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
        [value]="searchTerm()"
        (input)="onSearch($event)"
        (focus)="isDropdownOpen.set(true)"
      >
      @if (isDropdownOpen()) {
        <div class="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto border">
          <ul class="py-1">
            @for (option of filteredOptions(); track option[optionValueField()]) {
              <li 
                class="px-4 py-2 text-sm text-gray-700 hover:bg-indigo-100 cursor-pointer"
                (click)="selectOption(option)">
                {{ option[optionTextField()] }}
              </li>
            } @empty {
              <li class="px-4 py-2 text-sm text-gray-500">No results found</li>
            }
          </ul>
        </div>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchableSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private elementRef = viewChild.required<ElementRef>('self');
  private renderer = inject(Renderer2);
  private documentClickListener!: () => void;

  options = input.required<any[]>();
  optionTextField = input<string>('name');
  optionValueField = input<string>('id');
  placeholder = input<string>('Select an option');

  searchTerm = signal('');
  isDropdownOpen = signal(false);

  private selectedValue: any = null;

  onChange: (value: any) => void = () => { };
  onTouched: () => void = () => { };

  filteredOptions = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const currentOptions = this.options() || [];
    if (!term) {
      return currentOptions;
    }
    return currentOptions.filter(option =>
      option[this.optionTextField()].toLowerCase().includes(term)
    );
  });


  constructor() {
    // When options change, re-evaluate the search term display value
    effect(() => {
      const currentOptions = this.options();
      // Use untracked to avoid creating a signal dependency cycle
      const value = this.selectedValue;
      const selectedOption = currentOptions.find(opt => opt[this.optionValueField()] === value);

      if (selectedOption) {
        this.searchTerm.set(selectedOption[this.optionTextField()]);
      } else if (this.searchTerm() !== '') {
        this.searchTerm.set('');
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.documentClickListener = this.renderer.listen('document', 'click', (event: Event) => {
      this.clickout(event);
    });
  }

  ngOnDestroy(): void {
    if (this.documentClickListener) {
      this.documentClickListener();
    }
  }

  clickout(event: Event) {
    if (!this.elementRef().nativeElement.contains(event.target)) {
      this.isDropdownOpen.set(false);
    }
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.isDropdownOpen.set(true);

    // When user types, we should clear the selection as it no longer matches
    if (this.selectedValue !== null) {
      const selectedOption = this.options()?.find(opt => opt[this.optionValueField()] === this.selectedValue);
      if (!selectedOption || selectedOption[this.optionTextField()] !== value) {
        this.selectedValue = null;
        this.onChange(null);
      }
    }
  }

  selectOption(option: any) {
    this.isDropdownOpen.set(false);
    this.selectedValue = option[this.optionValueField()];
    this.searchTerm.set(option[this.optionTextField()]);
    this.onChange(this.selectedValue);
    this.onTouched();
  }

  writeValue(value: any): void {
    this.selectedValue = value;
    const currentOptions = this.options() || [];
    const selectedOption = currentOptions.find(opt => opt[this.optionValueField()] === value);

    if (selectedOption) {
      this.searchTerm.set(selectedOption[this.optionTextField()]);
    } else {
      this.searchTerm.set('');
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
}