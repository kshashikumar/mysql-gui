import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, OnDestroy, OnInit, Output, HostListener } from '@angular/core';
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
    private readonly _cdr = inject(ChangeDetectorRef);
    private readonly _destroy$ = new Subject();
    currentTheme: AppTheme | null = null;
    aiEnabled: boolean = false;
    isOpen: boolean = false;
    @Output() aiEnabledEmitter = new EventEmitter<boolean>();
    private readonly _themeService = inject(ThemeService);
    private readonly _authService = inject(AuthService);
    connected = !!sessionStorage.getItem('dbType');

    ngOnInit(): void {
        this._themeService.currentTheme$.pipe(takeUntil(this._destroy$)).subscribe((theme) => {
            this.currentTheme = theme;
            this._cdr.markForCheck();
        });
    }

    ngOnDestroy(): void {
        this._destroy$.complete();
        this._destroy$.unsubscribe();
    }

    // Close dropdown when clicking outside
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative') || target.closest('[role="menuitem"]')) {
            this.isOpen = false;
            this._cdr.markForCheck();
        }
    }

    // Close dropdown on escape key
    @HostListener('document:keydown.escape')
    onEscapeKey(): void {
        this.isOpen = false;
        this._cdr.markForCheck();
    }

    logout(): void {
        this._authService.logout().subscribe({
            next: () => {
                sessionStorage.clear();
                this._router.navigate(['/login'], { replaceUrl: true });
            },
            error: (err) => {
                console.error('Logout failed:', err);
                this._router.navigate(['/login'], { replaceUrl: true });
            }
        });
        this.isOpen = false;
        this._cdr.markForCheck();
    }

    toggleDropdown(): void {
        this.isOpen = !this.isOpen;
        this._cdr.markForCheck();
    }

    goToLanding(): void {
        this._router.navigate(['/landing']);
        this.isOpen = false;
        this._cdr.markForCheck();
    }

    goToConfig(): void {
        this._router.navigate(['/config']);
        this.isOpen = false;
        this._cdr.markForCheck();
    }

    toggleAI(): void {
        this.aiEnabled = !this.aiEnabled;
        this.aiEnabledEmitter.emit(this.aiEnabled);
        this._cdr.markForCheck();
    }

    toggleTheme(): void {
        const newTheme: AppTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this._themeService.setTheme(newTheme);
    }
}