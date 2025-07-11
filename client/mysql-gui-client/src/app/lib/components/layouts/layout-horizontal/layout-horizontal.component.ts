import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { HomeComponent } from '@lib/components/home/home.component';
import { NavbarComponent } from '@lib/components/navbar/navbar.component';
import { SideBarComponent } from '@lib/components/sidebar/sidebar.component';
import { newTabData, openAIEvent } from '@lib/utils/storage/storage.types';

@Component({
    selector: 'app-layout-horizontal',
    standalone: true,
    imports: [CommonModule, NavbarComponent, SideBarComponent, HomeComponent],
    templateUrl: './layout-horizontal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutHorizontalComponent implements OnInit {
    constructor() {}
    tabData: newTabData;
    databases: any = {};
    openAIEnabledFlag: openAIEvent;

    ngOnInit(): void {
        // Any initialization logic can go here
        console.log('LayoutHorizontalComponent initialized');
    }

    handleNewTabData(event: newTabData) {
        this.tabData = event;
    }
    handleInitData(event: newTabData) {
        this.databases = event;
    }
    handleOpenAIEvent(event: openAIEvent) {
        this.openAIEnabledFlag = event;
    }
}
