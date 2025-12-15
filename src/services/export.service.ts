import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({ providedIn: 'root' })
export class ExportService {
  exportToExcel(data: any[], fileNamePrefix: string): void {
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-fit column widths
    this.autoFitColumns(ws, data);

    // Set page orientation to landscape
    ws['!pageSetup'] = { orientation: 'landscape' };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const fileName = `${fileNamePrefix}_${this.getFormattedTimestamp()}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  exportToPdf(data: any[], fileNamePrefix: string, options?: { title?: string; user?: string; period?: string }): void {
    if (!data || data.length === 0) return;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const headers = Object.keys(data[0]);
    const body = data.map(row => Object.values(row).map(val => val == null ? '' : String(val)));
    const now = new Date().toLocaleString('fr-FR');

    // Helper to add header and footer
    const addHeaderFooter = (data: any) => {
      const pageSize = doc.internal.pageSize;
      const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();

      // Header
      doc.setFontSize(16);
      doc.setTextColor(40);
      const title = options?.title || 'Inventory Report';
      doc.text(title, 14, 15);

      doc.setFontSize(10);
      doc.setTextColor(100);

      let yMeta = 22;
      doc.text(`Édité le: ${now}`, 14, yMeta);

      if (options?.user) {
        // Move to right side for user
        const userText = `Utilisateur: ${options.user}`;
        const userTextWidth = doc.getTextWidth(userText);
        doc.text(userText, pageWidth - 14 - userTextWidth, 15);
      }

      if (options?.period) {
        // Period below title
        yMeta += 5;
        doc.text(`Période: ${options.period}`, 14, yMeta);
      }

      // Footer
      const pageNumber = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(150);
      const footerText = `Page ${pageNumber}`;
      doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    autoTable(doc, {
      head: [headers],
      body: body,
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [22, 163, 74],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244] // Very light green
      },
      startY: 35,
      margin: { top: 35, bottom: 20 },
      didDrawPage: addHeaderFooter,
    });

    const fileName = `${fileNamePrefix}_${this.getFormattedTimestamp()}.pdf`;
    doc.save(fileName);
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