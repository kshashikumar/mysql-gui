import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    inject,
    OnInit,
    Output,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { BackendService } from '@lib/services';
import { newTabData } from '@lib/utils/storage/storage.types';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterModule, HttpClientModule],
    templateUrl: './sidebar.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideBarComponent implements OnInit {
    private readonly _router = inject(Router);
    @Output() newTabEmitter = new EventEmitter<newTabData>();

    databases: any = {};
    isLoading: boolean = false;

    constructor(private dbService: BackendService, private cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        this.getDatabases();
    }

    getDatabases() {
        this.isLoading = true;
        this.dbService
            .getDatabases()
            .subscribe(
                (data) => {
                    this.databases = data;
                    this.cdr.detectChanges();
                },
                (error) => {
                    console.error('Error fetching databases', error);
                },
            )
            .add(() => {
                this.isLoading = false;
            });
    }

    openSections: { [key: string]: boolean } = {};

    toggleSection(section: string): void {
        this.openSections[section] = !this.openSections[section];
    }

    isOpen(section: string): boolean {
        return !!this.openSections[section];
    }

    openNewTab(dbName: string, tableName: string) {
        console.log(dbName);
        console.log(tableName);
        this.newTabEmitter.emit({ dbName: dbName, tableName: tableName });
    }
}
