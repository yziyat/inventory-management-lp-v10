import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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

  loginError: string | null = null;

  onSubmit(): void {
    if (this.loginForm.valid) {
      const { username, password, rememberMe } = this.loginForm.value;
      const user = this.authService.login(username!, password!, rememberMe!);
      if (user) {
        this.router.navigate(['/stock']);
      } else {
        this.loginError = this.t().login.authFailed;
      }
    }
  }
}
