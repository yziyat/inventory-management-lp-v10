import { Injectable, signal, computed, inject } from '@angular/core';
import { User } from '../models/user.model';
import { ApiService } from './api.service';

const SESSION_STORAGE_KEY = 'inventory_user_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiService = inject(ApiService);
  
  currentUser = signal<User | null>(this.getInitialUser());

  isLoggedIn = computed(() => !!this.currentUser());
  isAdmin = computed(() => this.currentUser()?.role === 'admin');
  isEditor = computed(() => this.currentUser()?.role === 'editor');
  isViewer = computed(() => this.currentUser()?.role === 'viewer');

  private getInitialUser(): User | null {
    try {
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      return savedSession ? JSON.parse(savedSession) : null;
    } catch (e) {
      return null;
    }
  }

  login(username: string, password_provided: string, rememberMe: boolean): User | null {
    const user = this.apiService.authenticate(username, password_provided);
    if (user) {
      this.currentUser.set(user);
      if (rememberMe) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      } else {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    return user;
  }

  logout() {
    this.currentUser.set(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}