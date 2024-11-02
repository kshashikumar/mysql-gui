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
    tables: any = {};
    columns: any = {};
    isLoading: boolean = false;

    constructor(private dbService: BackendService, private cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        this.getDatabaseNames();
    }

    refresh() {
        this.getDatabaseNames();
    }

    // Fetch databases initially
    getDatabaseNames() {
        this.isLoading = true;
        this.dbService.getDatabaseNames().subscribe(
            (data) => {
                this.databases = data;
                console.log("Databases: "+this.databases);
                this.cdr.detectChanges();
            },
            (error) => {
                console.error('Error fetching databases', error);
            },
            () => {
                this.isLoading = false;
            }
        );
    }

    // Cache object to avoid redundant requests
    private cache: { [key: string]: { tables?: any, views?: any, procedures?: any, functions?: any } } = {};

    getTables(dbName: string) {
        if (this.cache[dbName]?.tables) return; // Use cache if available

        this.dbService.getTables(dbName).subscribe(
            (tables) => {
                this.tables =  tables;
                console.log("Tables called: "+tables);
                this.cdr.detectChanges();
            },
            (error) => {
                console.error('Error fetching tables:', error);
            }
        );
    }

    getColumns(dbName: string, tableName: string) {

        this.dbService.getColumns(dbName, tableName).subscribe(
            (columns) => {
                this.columns =  columns;
                console.log("Columns called: "+columns);
                this.cdr.detectChanges();
            },
            (error) => {
                console.error('Error fetching tables:', error);
            }
        );
    }

    getViews(dbName: string) {
        if (this.cache[dbName]?.views) return;

        this.dbService.getViews(dbName).subscribe(
            (views) => {
                this.cache[dbName] = { ...this.cache[dbName], views };
                this.cdr.detectChanges();
            },
            (error) => {
                console.error('Error fetching views:', error);
            }
        );
    }

    getProcedures(dbName: string) {
        if (this.cache[dbName]?.procedures) return;

        this.dbService.getProcedures(dbName).subscribe(
            (procedures) => {
                this.cache[dbName] = { ...this.cache[dbName], procedures };
                this.cdr.detectChanges();
            },
            (error) => {
                console.error('Error fetching procedures:', error);
            }
        );
    }

    getFunctions(dbName: string) {
        if (this.cache[dbName]?.functions) return;

        this.dbService.getFunctions(dbName).subscribe(
            (functions) => {
                this.cache[dbName] = { ...this.cache[dbName], functions };
                this.cdr.detectChanges();
            },
            (error) => {
                console.error('Error fetching functions:', error);
            }
        );
    }

    sectionData: { [key: string]: any } = {};  // Store data for each section by unique keys
    openSections: { [key: string]: boolean } = {};  // Track which sections are open


    toggleSection(sectionName: string) {
        // Check if data for this section has not been loaded
        console.log("Section: "+sectionName);
        if (!this.sectionData[sectionName]) {
          if (sectionName.endsWith("_tables")) {
            console.log("Tables clicked: "+ sectionName);
            this.loadTables(sectionName.substring(0, sectionName.length - 7));
          } else if (sectionName.endsWith("_columns")) {
            const regex = /^(.*?)_table_(.*?)_columns$/;
            const match = sectionName.match(regex);
            if (match) {
                const databaseName = match[1];
                const tableName = match[2];

                console.log("Columns clicked");
                console.log("Database Name: "+ databaseName);
                console.log("Table Name: "+tableName);
                this.loadColumns(databaseName, tableName);
            }
          } else if (sectionName.endsWith("_views")) {
            this.loadViews(sectionName);
          } else if (sectionName.endsWith("_procedures")) {
            this.loadProcedures(sectionName);
          } else if (sectionName.endsWith("_functions")) {
            this.loadFunctions(sectionName);
          }
        }
        // Toggle visibility state of the section
        this.openSections[sectionName] = !this.openSections[sectionName];
      }
      
      loadTables(databaseName: string) {
        let data = this.getTables(databaseName);
        this.sectionData[databaseName + "_tables"] = data;
      }

      loadColumns(databaseName: string, tableName: string) {
        let data = this.getColumns(databaseName, tableName);
        this.sectionData[databaseName +'_table_'+ tableName + "_columns"] = data;
      }

      loadViews(databaseName: string) {
        this.dbService.getViews(databaseName).subscribe(data => {
          this.sectionData[databaseName + "_views"] = data;
        });
      }
      
      loadProcedures(databaseName: string) {
        this.dbService.getProcedures(databaseName).subscribe(data => {
          this.sectionData[databaseName + "_procedures"] = data;
        });
      }
      
      loadFunctions(databaseName: string) {
        this.dbService.getFunctions(databaseName).subscribe(data => {
          this.sectionData[databaseName + "_functions"] = data;
        });
      }
      

    isOpen(section: string): boolean {
        return !!this.openSections[section];
    }

    openNewTab(dbName: string, tableName: string) {
        this.newTabEmitter.emit({ dbName, tableName });
    }
}
