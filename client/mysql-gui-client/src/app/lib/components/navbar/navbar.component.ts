import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, inject, OnDestroy, OnInit, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { LogoComponent } from '../logo/logo.component';

import { AppTheme, ThemeService } from '@lib/services/theme';
import { Subject, takeUntil } from 'rxjs';

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
    @Output() aiEnabledEmitter = new EventEmitter<any>();

    private readonly _themeService = inject(ThemeService);

    ngOnInit(): void {
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

    toggleAI() {
        this.aiEnabled = !this.aiEnabled;
        this.aiEnabledEmitter.emit({ openAIEnabled: this.aiEnabled });
    }

    toggleTheme(): void {
        const activeTheme = this.currentTheme === 'system' ? this._themeService.systemTheme : this.currentTheme;
        const newTheme: AppTheme = activeTheme === 'light' ? 'dark' : 'light';
        this.handleThemeChange(newTheme);
    }

    isDarkTheme(): boolean {
        return this.currentTheme === 'dark' || (this.currentTheme === 'system' && this._themeService.systemTheme === 'dark');
    }

    handleThemeChange(theme: AppTheme): void {
        // Set the theme in the service, which will automatically update the current theme
        this._themeService.setTheme(theme);
    }
}
