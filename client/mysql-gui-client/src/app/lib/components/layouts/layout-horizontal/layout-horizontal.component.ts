import { NavbarComponent } from '@lib/components';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SideBarComponent } from '@lib/components';
import { HomeComponent } from '@pages/home/home.component';
import { newTabData } from '@lib/utils/storage/storage.types';
import * as e from 'express';

@Component({
    selector: 'app-layout-horizontal',
    standalone: true,
    imports: [CommonModule, NavbarComponent, SideBarComponent, HomeComponent],
    templateUrl: './layout-horizontal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutHorizontalComponent {
    constructor() {}
    tabData: newTabData;
    handleNewTabData(event: newTabData) {
        this.tabData = event;
    }
}
