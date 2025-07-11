import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, RouterModule, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
    providers: [importProvidersFrom(RouterModule.forRoot(routes
        // , { enableTracing: true }
    )), provideHttpClient(withFetch())],
};
