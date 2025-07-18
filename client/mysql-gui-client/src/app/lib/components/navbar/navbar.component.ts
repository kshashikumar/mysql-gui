import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, inject, OnDestroy, OnInit, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { LogoComponent } from '../logo/logo.component';

import { AppTheme, ThemeService } from '@lib/services/theme';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@lib/services';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [CommonModule, RouterModule, LogoComponent],
    templateUrl: './navbar.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent implements OnInit, OnDestroy {
    private readonly _router = inject(Router);
    private readonly _destroy$ = new Subject();
    currentTheme!: AppTheme | null;
    aiEnabled: boolean = false;
    isOpen: boolean = false;
    @Output() aiEnabledEmitter = new EventEmitter<any>();

    private readonly _themeService = inject(ThemeService);
    private readonly _authService = inject(AuthService);
    connected = sessionStorage.getItem('dbType');

    ngOnInit(): void {
        console.log('NavbarComponent initialized');
        // Subscribe to the theme service to get the initial theme value
        this._themeService.currentTheme$.pipe(takeUntil(this._destroy$)).subscribe((theme) => {
            // Ensure the currentTheme is set correctly
            this.currentTheme = theme;
        });
    }

    ngOnDestroy(): void {
        this._destroy$.complete();
        this._destroy$.unsubscribe();
    }

    logout() {
        console.log("Logging out...");
        sessionStorage.clear();
        this._authService.logout().subscribe({
            next: () => {
                console.log("Logout successful");
                this._router.navigate(['/login'], { replaceUrl: true }); // Absolute path with replaceUrl
            },
            error: (err) => {
                console.error("Logout failed:", err);
                this._router.navigate(['/login'], { replaceUrl: true }); // Absolute path with replaceUrl
            }
        });
    }

    toggleDropdown() {
        this.isOpen = !this.isOpen;
    }

    goToLanding() {
        this._router.navigate(['/landing']);
    }

    toggleAI() {
        this.aiEnabled = !this.aiEnabled;
        this.aiEnabledEmitter.emit({ openAIEnabled: this.aiEnabled });
    }

    toggleTheme(): void {
        // Toggle between light and dark based on the current theme
        const newTheme: AppTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.handleThemeChange(newTheme);
    }

    handleThemeChange(theme: AppTheme): void {
        // Set the theme in the service, which will automatically update the current theme
        this._themeService.setTheme(theme);
    }
}
