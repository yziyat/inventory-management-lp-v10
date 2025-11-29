import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  standalone: true,
})
export class LoginComponent {
  // FIX: Add explicit types to injected FormBuilder and Router.
  private fb: FormBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router: Router = inject(Router);
  private translationService = inject(TranslationService);
  t = this.translationService.currentTranslations;

  loginForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    rememberMe: [false]
  });

  loginError = signal<string | null>(null);
  isLoading = signal(false);

  async onSubmit(): Promise<void> {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      this.loginError.set(null);

      const { username, password, rememberMe } = this.loginForm.value;

      try {
        const user = await this.authService.login(username!, password!, rememberMe!);
        if (user) {
          this.router.navigate(['/stock']);
        } else {
          this.loginError.set(this.t().login.authFailed);
        }
      } catch (error: any) {
        this.loginError.set(error.message || this.t().login.authFailed);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  async registerAdmin(): Promise<void> {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      this.loginError.set(null);

      const { username, password } = this.loginForm.value;

      try {
        // Create admin user data
        const newAdmin = {
          username: username!,
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin' as const,
        };

        await this.authService.signUp(username!, password!, newAdmin); // username is treated as email here
        this.router.navigate(['/stock']);
      } catch (error: any) {
        this.loginError.set(error.message || 'Registration failed');
      } finally {
        this.isLoading.set(false);
      }
    } else {
      this.loginError.set('Please fill in username (email) and password');
    }
  }
}
