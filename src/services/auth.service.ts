import { Injectable, signal, computed, inject } from '@angular/core';
import { User } from '../models/user.model';
import { FirebaseAuthService } from './firebase-auth.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private firebaseAuth = inject(FirebaseAuthService);

  // Delegate to Firebase Auth service
  currentUser = this.firebaseAuth.currentUser;
  isLoading = this.firebaseAuth.isLoading;

  isLoggedIn = computed(() => !!this.currentUser());
  isAdmin = computed(() => this.currentUser()?.role === 'admin');
  isEditor = computed(() => this.currentUser()?.role === 'editor');
  isViewer = computed(() => this.currentUser()?.role === 'viewer');

  /**
   * Login with username (email) and password
   * For backward compatibility, we treat username as email
   */
  async login(username: string, password: string, rememberMe: boolean): Promise<User | null> {
    try {
      // Convert username to email format if it's not already
      const email = username.includes('@') ? username : `${username}@inventory-app.local`;
      const user = await this.firebaseAuth.signIn(email, password);
      return user;
    } catch (error: any) {
      console.error('Login error:', error);
      return null;
    }
  }

  /**
   * Sign up a new user
   */
  async signUp(username: string, password: string, userData: Omit<User, 'id'>): Promise<User> {
    // Convert username to email format if it's not already
    const email = username.includes('@') ? username : `${username}@inventory-app.local`;
    return this.firebaseAuth.signUp(email, password, userData);
  }

  async sendEmailVerification(user: any): Promise<void> {
    // This is handled inside signUp in FirebaseAuthService, but if we need to resend:
    // return this.firebaseAuth.sendEmailVerification(user);
    // For now, we don't need to expose it directly as it's automatic on signup
    return Promise.resolve();
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await this.firebaseAuth.signOut();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.firebaseAuth.isAuthenticated();
  }
}