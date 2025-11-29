import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    title: 'Login'
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'stock', pathMatch: 'full' },
      {
        path: 'articles',
        loadComponent: () => import('./components/articles/articles.component').then(m => m.ArticlesComponent),
        title: 'Articles'
      },
      {
        path: 'movements',
        loadComponent: () => import('./components/movements/movements.component').then(m => m.MovementsComponent),
        title: 'Movements'
      },
      {
        path: 'stock',
        loadComponent: () => import('./components/stock/stock.component').then(m => m.StockComponent),
        title: 'Current Stock'
      },
      {
        path: 'reports',
        loadComponent: () => import('./components/reports/reports.component').then(m => m.ReportsComponent),
        title: 'Reports'
      },
      {
        path: 'users',
        loadComponent: () => import('./components/users/users.component').then(m => m.UsersComponent),
        title: 'Users',
        canActivate: [adminGuard]
      },
      {
        path: 'settings',
        loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent),
        title: 'Settings',
        canActivate: [adminGuard]
      },
      { path: '**', redirectTo: 'stock' }
    ]
  },
];