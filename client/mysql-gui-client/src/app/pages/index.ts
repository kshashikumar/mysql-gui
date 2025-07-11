import { Routes } from '@angular/router';
import { AuthGuard } from '@lib/guards';

export const routes: Routes = [
    {
        path: 'login',
        title: 'Login',
        loadComponent: async () => (await import('./login/login.component')).LoginComponent,
    },
    {
    path: '',
    title: 'Landing',
    loadComponent: async () => (await import('./landing/landing.component')).LandingComponent,
    canActivate: [AuthGuard]
}
];
