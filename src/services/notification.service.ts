import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<Notification[]>([]);

  private addNotification(message: string, type: NotificationType) {
    const newNotification: Notification = {
      id: Date.now(),
      message,
      type,
    };
    this.notifications.update(current => [...current, newNotification]);
    setTimeout(() => this.removeNotification(newNotification.id), 5000);
  }

  removeNotification(id: number) {
    this.notifications.update(current => current.filter(n => n.id !== id));
  }

  showSuccess(message: string) {
    this.addNotification(message, 'success');
  }

  showError(message: string) {
    this.addNotification(message, 'error');
  }

  showInfo(message: string) {
    this.addNotification(message, 'info');
  }

  showWarning(message: string) {
    this.addNotification(message, 'warning');
  }
}
