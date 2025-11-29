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
        #inputElement
        type="text" 
        [placeholder]="placeholder()"
        class="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
        (input)="onSearch($event)"
        (focus)="onFocus()"
        autocomplete="off"
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
  private inputElement = viewChild.required<ElementRef<HTMLInputElement>>('inputElement');
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
    // When options change, update the input field value if there's a selection
    effect(() => {
      const currentOptions = this.options();
      const value = this.selectedValue;
      const selectedOption = currentOptions.find(opt => opt[this.optionValueField()] === value);

      if (selectedOption && this.inputElement()) {
        const inputEl = this.inputElement().nativeElement;
        inputEl.value = selectedOption[this.optionTextField()];
        this.searchTerm.set(selectedOption[this.optionTextField()]);
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
    const target = event.target as HTMLElement;
    const selfElement = this.elementRef().nativeElement;

    // Only close if the click is truly outside the component
    if (!selfElement.contains(target)) {
      this.isDropdownOpen.set(false);
    }
  }

  onFocus() {
    this.isDropdownOpen.set(true);
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);

    // Clear selection only if the typed value doesn't match the selected option
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
    const displayText = option[this.optionTextField()];
    this.searchTerm.set(displayText);

    // Update input field directly
    if (this.inputElement()) {
      this.inputElement().nativeElement.value = displayText;
    }

    this.onChange(this.selectedValue);
    this.onTouched();
  }

  writeValue(value: any): void {
    this.selectedValue = value;
    const currentOptions = this.options() || [];
    const selectedOption = currentOptions.find(opt => opt[this.optionValueField()] === value);

    if (selectedOption) {
      const displayText = selectedOption[this.optionTextField()];
      this.searchTerm.set(displayText);

      // Update input field directly
      if (this.inputElement()) {
        this.inputElement().nativeElement.value = displayText;
      }
    } else {
      this.searchTerm.set('');
      if (this.inputElement()) {
        this.inputElement().nativeElement.value = '';
      }
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
}