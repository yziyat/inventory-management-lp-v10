import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  // FIX: Add explicit type to injected Router to resolve type inference issue.
  const router: Router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }
  
  router.navigate(['/stock']);
  return false;
};