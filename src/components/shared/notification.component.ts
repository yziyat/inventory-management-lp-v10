import { ChangeDetectionStrategy, Component, inject, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NotificationService, NotificationType } from '../../services/notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [],
  template: `
    <div class="fixed top-5 left-1/2 -translate-x-1/2 z-[100] space-y-3 w-full max-w-md px-4">
      @for (notification of notificationService.notifications(); track notification.id) {
        <div 
          class="flex items-start p-4 w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden animate-fade-in-down"
          [class]="getBackgroundColor(notification.type)">
          <div class="flex-shrink-0" [innerHTML]="getIcon(notification.type)">
          </div>
          <div class="ml-3 w-0 flex-1 pt-0.5">
            <p class="text-sm font-medium text-gray-900 break-words">{{ notification.message }}</p>
          </div>
          <div class="ml-4 flex-shrink-0">
            <button (click)="notificationService.removeNotification(notification.id)" class="inline-flex rounded-md bg-transparent text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <span class="sr-only">Close</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>
      }
    </div>
    <style>
      @keyframes fade-in-down {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-fade-in-down {
        animation: fade-in-down 0.3s ease-out forwards;
      }
    </style>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationComponent {
  notificationService = inject(NotificationService);
  // FIX: Add explicit type to `sanitizer` to fix type inference issue with `inject`.
  private sanitizer: DomSanitizer = inject(DomSanitizer);

  getBackgroundColor(type: NotificationType): string {
    switch (type) {
      case 'success': return 'bg-green-50';
      case 'error': return 'bg-red-50';
      case 'warning': return 'bg-yellow-50';
      case 'info': return 'bg-blue-50';
      default: return 'bg-gray-50';
    }
  }

  private getTextColor(type: NotificationType): string {
     switch (type) {
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  }

  getIcon(type: NotificationType): any {
    const iconColor = this.getTextColor(type);
    let iconSvg: string;
    switch (type) {
      case 'success': 
        iconSvg = `<svg class="h-6 w-6 ${iconColor}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
        break;
      case 'error': 
        iconSvg = `<svg class="h-6 w-6 ${iconColor}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>`;
        break;
      case 'warning': 
        iconSvg = `<svg class="h-6 w-6 ${iconColor}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>`;
        break;
      case 'info': 
        iconSvg = `<svg class="h-6 w-6 ${iconColor}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
        break;
      default: 
        iconSvg = '';
    }
    return this.sanitizer.bypassSecurityTrustHtml(iconSvg);
  }
}
