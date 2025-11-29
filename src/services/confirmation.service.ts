import { Injectable, signal } from '@angular/core';

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private defaultState: ConfirmationState = {
    isOpen: false,
    title: '',
    message: '',
    resolve: () => {},
  };
  state = signal<ConfirmationState>(this.defaultState);

  confirm(title: string, message: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state.set({
        isOpen: true,
        title,
        message,
        resolve,
      });
    });
  }

  private close(value: boolean) {
      this.state().resolve(value);
      this.state.set(this.defaultState);
  }

  onConfirm() {
    this.close(true);
  }

  onCancel() {
    this.close(false);
  }
}
