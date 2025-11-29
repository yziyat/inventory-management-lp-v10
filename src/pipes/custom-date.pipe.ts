import { Pipe, PipeTransform, inject } from '@angular/core';
import { SettingsService } from '../services/settings.service';

@Pipe({
  name: 'customDate',
  standalone: true,
})
export class CustomDatePipe implements PipeTransform {
  private settingsService = inject(SettingsService);

  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    try {
      const date = new Date(value);
      // Adjust for timezone offset to prevent date changes
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(date.getTime() + userTimezoneOffset);

      const year = adjustedDate.getFullYear();
      const month = (adjustedDate.getMonth() + 1).toString().padStart(2, '0');
      const day = adjustedDate.getDate().toString().padStart(2, '0');
      
      const format = this.settingsService.dateFormat();
      
      if (format === 'DD/MM/YYYY') {
        return `${day}/${month}/${year}`;
      }
      // Default to YYYY-MM-DD
      return `${year}-${month}-${day}`;

    } catch (error) {
      console.error('Invalid date value for pipe:', value);
      return String(value);
    }
  }
}
