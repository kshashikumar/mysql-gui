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
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BackendService } from '@lib/services';
import { newTabData, TableInfo } from '@lib/utils/storage/storage.types';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterModule, HttpClientModule, FormsModule],
    templateUrl: './sidebar.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideBarComponent implements OnInit {
    private readonly _router = inject(Router);
    @Output() newTabEmitter = new EventEmitter<newTabData>();
    @Output() initDBInfoEmitter = new EventEmitter<any>();

    databases: any = {};
    filteredDatabases: any = [];
    filterText: string = '';
    isLoading: boolean = false;
    isRefreshing: boolean = true;

    constructor(private dbService: BackendService, private cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        console.log('SidebarComponent initialized');
        this.getDatabases();
    }

    refresh() {
        this.isRefreshing = true;
        this.openSections = {};
        this.getDatabases();
    }

    getDatabases() {
        this.isLoading = true;

        this.dbService
            .getDatabases()
            .subscribe(
                (data) => {
                    this.databases = data;
                    this.filteredDatabases = data['databases'];
                    console.log(data);
                    this.initDBInfoEmitter.emit(this.filteredDatabases);
                    this.cdr.detectChanges();
                },
                (error) => {
                    console.error('Error fetching databases', error);
                },
            )
            .add(() => {
                this.isLoading = false;
                this.isRefreshing = false;
                this.cdr.detectChanges();
            });
    }

    filterDatabases() {
        console.log('hello');
        const filter = this.filterText.toLowerCase();

        if (!filter) {
            this.filteredDatabases = [...this.databases['databases']];
            this.openSections = {};
            this.cdr.detectChanges();
            return;
        }

        this.filteredDatabases = this.databases.databases
            .map((db: any) => {
                const filteredTables = db.tables.filter((table: any) => table.name.toLowerCase().includes(filter));

                if (db.name.toLowerCase().includes(filter) || filteredTables.length) {
                    return {
                        ...db,
                        tables: filteredTables,
                    };
                }
                return null;
            })
            .filter((db: any) => db !== null);

        this.cdr.detectChanges();
    }

    openSections: { [key: string]: boolean } = {};

    toggleSection(section: string): void {
        this.openSections[section] = !this.openSections[section];
    }

    findDatabase(dbName: string): any {
        const dataSource = this.filterText ? this.filteredDatabases : this.databases.databases;
        return dataSource?.find((db: any) => db.name === dbName);
    }

    getTableInfo(section: string): void {
        const [dbName, tableName] = section.split('_table_');

        const database = this.filteredDatabases?.find((db: any) => db.name === dbName);

        if (database) {
            const tableIndex = database.tables?.findIndex((t: any) => t.name === tableName);

            if (tableIndex > -1) {
                this.dbService.getTableInfo(dbName, tableName).subscribe(
                    (data: TableInfo) => {
                        database.tables = [...database.tables];
                        database.tables[tableIndex] = {
                            ...database.tables[tableIndex],
                            columns: data.columns || [],
                            indexes: data.indexes || [],
                            foreign_keys: data.foreign_keys || [],
                            triggers: data.triggers || [],
                        };
                        this.cdr.detectChanges();
                    },
                    (error) => {
                        console.error('Error fetching table information:', error);
                    },
                );
            } else {
                console.warn(`Table ${tableName} not found in database ${dbName}`);
            }
        } else {
            console.warn(`Database ${dbName} not found`);
        }

        this.openSections[section] = !this.openSections[section];
    }

    isOpen(section: string): boolean {
        return !!this.openSections[section];
    }

    openNewTab(dbName: string, tableName: string) {
        this.newTabEmitter.emit({ dbName: dbName, tableName: tableName });
    }
}
