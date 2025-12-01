import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { TranslationService } from './services/translation.service';
import { AuthService } from './services/auth.service';
import { ConfirmationModalComponent } from './components/shared/confirmation-modal.component';
import { NotificationComponent } from './components/shared/notification.component';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmationModalComponent, NotificationComponent],
  standalone: true,
})
export class AppComponent {
  private translationService = inject(TranslationService);
  authService = inject(AuthService);
  private router: Router = inject(Router);

  t = this.translationService.currentTranslations;

  isMobileMenuOpen = signal(false);
  pageTitle = signal('');
  currentRoute = signal('');

  // Sidebar state
  isSidebarPinned = signal(true);
  isSidebarHovered = signal(false);
  isSidebarExpanded = computed(() => this.isSidebarPinned() || this.isSidebarHovered());

  private allNavItems = [
    { path: '/stock', label: 'Stock', icon: 'archive-box', adminOnly: false },
    { path: '/articles', label: 'Articles', icon: 'document-duplicate', adminOnly: false },
    { path: '/movements', label: 'Movements', icon: 'arrows-right-left', adminOnly: false },
    { path: '/reports', label: 'Reports', icon: 'chart-bar', adminOnly: false },
    { path: '/users', label: 'Users', icon: 'user-group', adminOnly: true },
    { path: '/settings', label: 'Settings', icon: 'cog-6-tooth', adminOnly: true },
  ];

  navItems = computed(() => {
    if (this.authService.isAdmin()) {
      return this.allNavItems;
    }
    return this.allNavItems.filter(item => !item.adminOnly);
  });

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => {
        let route = this.router.routerState.root;
        let title = '';
        while (route.firstChild) {
          route = route.firstChild;
        }
        if (route.snapshot.data['title']) {
          title = route.snapshot.data['title'];
        } else if (route.snapshot.title) {
          title = route.snapshot.title;
        }
        return title;
      })
    ).subscribe((title: string) => {
      if (title) {
        const key = title.replace(/\s+/g, '').toLowerCase();
        // FIX: Add an explicit type to the nav object to allow indexing by a dynamic string key.
        const navTranslations = this.t().nav as Record<string, any>;
        let translatedTitle = navTranslations[key] || title;

        // Handle nested objects (like settings)
        if (typeof translatedTitle === 'object' && translatedTitle !== null && 'title' in translatedTitle) {
          translatedTitle = translatedTitle.title;
        }

        this.pageTitle.set(translatedTitle);
      }
    });

    // Track current route
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute.set(event.urlAfterRedirects);
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getNavLabel(label: string): string {
    const key = label.toLowerCase().replace(' ', '');
    const nav = this.t().nav as Record<string, any>;
    const value = nav[key] || label;

    // Handle nested objects (like settings)
    if (typeof value === 'object' && value !== null && 'title' in value) {
      return value.title;
    }

    return value;
  }
}