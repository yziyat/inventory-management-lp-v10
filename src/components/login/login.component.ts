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
  private fb: FormBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router: Router = inject(Router);
  private translationService = inject(TranslationService);
  t = this.translationService.currentTranslations;

  isRegistering = signal(false);
  registrationSuccess = signal(false);

  loginForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    rememberMe: [false]
  });

  registerForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  });

  loginError = signal<string | null>(null);
  isLoading = signal(false);

  toggleRegister() {
    this.isRegistering.update(v => !v);
    this.loginError.set(null);
    this.registrationSuccess.set(false);
    this.loginForm.reset();
    this.registerForm.reset();
  }

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

  async onRegister(): Promise<void> {
    if (this.registerForm.valid) {
      const { firstName, lastName, email, password, confirmPassword } = this.registerForm.value;

      if (password !== confirmPassword) {
        this.loginError.set('Passwords do not match');
        return;
      }

      this.isLoading.set(true);
      this.loginError.set(null);

      try {
        const newUser = {
          username: email!,
          firstName: firstName!,
          lastName: lastName!,
          role: 'viewer' as const, // Default role, will be overridden by service but good for type safety
        };

        await this.authService.signUp(email!, password!, newUser);
        this.registrationSuccess.set(true);
        this.isRegistering.set(false);
      } catch (error: any) {
        this.loginError.set(error.message || 'Registration failed');
      } finally {
        this.isLoading.set(false);
      }
    }
  }
}
