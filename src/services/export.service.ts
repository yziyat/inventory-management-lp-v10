import { Injectable } from '@angular/core';

// This will use the global XLSX variable from the script tag in index.html
declare var XLSX: any;

@Injectable({ providedIn: 'root' })
export class ExportService {
  exportToExcel(data: any[], fileNamePrefix: string): void {
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-fit column widths
    this.autoFitColumns(ws, data);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const fileName = `${fileNamePrefix}_${this.getFormattedTimestamp()}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  private autoFitColumns(ws: any, data: any[]) {
    if (!data || data.length === 0) {
      return;
    }

    const objectMaxLength: { [key: string]: number } = {};
    const headers = Object.keys(data[0]);

    // Calculate max length of headers
    headers.forEach(header => {
      objectMaxLength[header] = header.length;
    });

    // Calculate max length of data in each column
    data.forEach(item => {
      headers.forEach(header => {
        const value = item[header];
        const valueLength = value ? String(value).length : 0;
        if (valueLength > objectMaxLength[header]) {
          objectMaxLength[header] = valueLength;
        }
      });
    });

    // Set column widths
    const colWidths = headers.map(header => ({
      wch: objectMaxLength[header] + 2, // Add a little padding
    }));

    ws['!cols'] = colWidths;
  }

  private getFormattedTimestamp(): string {
    const now = new Date();
    const pad = (num: number) => num.toString().padStart(2, '0');
    
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());

    return `${day}${month}${year}_${hours}${minutes}`;
  }
}