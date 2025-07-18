import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ThemeService } from '@lib/services/theme';
import { LayoutHorizontalComponent } from './lib/components/layouts/layout-horizontal/layout-horizontal.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
    private readonly _themeService = inject(ThemeService);
    private readonly _router = inject(Router);

    ngOnInit(): void {}
}
