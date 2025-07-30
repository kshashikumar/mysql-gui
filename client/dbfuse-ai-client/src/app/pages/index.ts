import { Routes } from '@angular/router';
import { AuthGuard } from '@lib/guards';

export const routes: Routes = [
    {path: '', redirectTo: 'landing', pathMatch: 'full'},
    {
        path: 'login',
        title: 'Login',
        loadComponent: async () => (await import('./login/login.component')).LoginComponent,
    },
    { 
        path: 'connection',
        title: 'LayoutHorizontal',
        loadComponent: async () => (await import('@lib/components/layouts/layout-horizontal/layout-horizontal.component')).LayoutHorizontalComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'landing',
        title: 'Landing',
        loadComponent: async () => (await import('./landing/landing.component')).LandingComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'config',
        title: 'Configuration',
        loadComponent: async () => (await import('@lib/components/config/config.component')).ConfigComponent,
        canActivate: [AuthGuard]
    }
];
