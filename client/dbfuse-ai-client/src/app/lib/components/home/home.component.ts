import {
    AfterViewChecked,
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    Input,
    OnChanges,
    OnInit,
    SimpleChanges,
    ViewChild,
    OnDestroy,
    inject,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DatabaseType, DbMeta, MultipleTablesInfo, newTabData, openAIEvent } from '@lib/utils/storage/storage.types';
import { ResultGridComponent } from '@pages/resultgrid/resultgrid.component';
import * as ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/ext-language_tools';
import { BackendService } from '@lib/services';
import { DragDropTabDirective } from '@lib/providers/drag-drop.directive';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, ResultGridComponent, DragDropTabDirective],
    templateUrl: './home.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnChanges, AfterViewInit, AfterViewChecked, OnDestroy {
    @Input() tabData!: newTabData;
    @Input() openAIEnabled!: openAIEvent;
    @Input() InitDBInfo!: any;
    @ViewChild('editor', { static: false }) editor: ElementRef;
    @ViewChild('tabContainer', { static: false }) tabContainer: ElementRef;
    @ViewChild(ResultGridComponent) resultGrid!: ResultGridComponent;

    tabs: { id: string; dbName: string; tableName: string; displayName: string }[] = [];
    selectedTab = -1;
    tabContent: string[] = [];
    editorInstance: any;
    needsEditorInit = false;
    triggerQuery: string = '';
    executeTriggered: boolean = false;
    selectedDB: string = '';
    currentTabId: string = '';
    editingTabIndex: number | null = null;
    maxTabs: number = 10;

    currentPage: number = 1;
    pageSize: number = 6;
    totalRows: number = 0;
    paginatedData: any[] = [];

    currentResultTabs: any[] = [];
  activeResultIndex: number = 0;

    private darkModeObserver: MutationObserver | null = null;
    Math = Math;
    private databaseType: DatabaseType = sessionStorage.getItem('dbType') as DatabaseType;
    private document = inject(DOCUMENT);

    constructor(
        private cdr: ChangeDetectorRef,
        private dbService: BackendService
    ) { }

    ngOnInit() {
        if (this.InitDBInfo) {
            this.initializeData(this.InitDBInfo);
        }
        this.setupDarkModeObserver();
    }

    ngOnDestroy() {
        if (this.darkModeObserver) {
            this.darkModeObserver.disconnect();
        }
        if (this.editorInstance) {
            this.editorInstance.destroy();
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['tabData'] && this.tabData?.dbName && this.tabData?.tableName) {
            this.addTab(this.tabData.dbName, this.tabData.tableName);
        } else if (changes['InitDBInfo'] && changes['InitDBInfo'].currentValue) {
            this.initializeData(changes['InitDBInfo'].currentValue);
        }
        if (changes['openAIEnabled'] && changes['openAIEnabled'].currentValue && this.selectedDB) {
            this.updateDatabaseInfo();
        }
    }

    private setupDarkModeObserver() {
        if (typeof window !== 'undefined') {
            this.darkModeObserver = new MutationObserver(() => {
                if (this.editorInstance) {
                    this.updateEditorTheme();
                }
            });
            this.darkModeObserver.observe(this.document.documentElement, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    trackByResultIndex(index: number, _item: any): number {
    return index;
  }

  onResultsChanged(results: any[]) {
  const safe = Array.isArray(results) ? results : [];
  // Attach a displayName to each result so the template can use it directly
  this.currentResultTabs = safe.map((r, idx) => ({
    ...r,
    displayName: this.getResultTabLabel(r, idx),
  }));

  // Keep active index in range
  this.activeResultIndex = Math.min(this.activeResultIndex, this.currentResultTabs.length - 1);
  if (this.activeResultIndex < 0) this.activeResultIndex = 0;

  this.cdr.markForCheck();
}


  // Clicking a mini-tab: tell child to switch
  onSelectResultTab(index: number) {
    this.activeResultIndex = index;
    if (this.resultGrid) {
      this.resultGrid.setActiveResultIndex(index);
    }
  }

  // Closing a mini-tab: tell child to remove it (child will emit resultsChanged back)
  onCloseResultTab(index: number) {
    if (this.resultGrid) {
      this.resultGrid.closeResultTab(index);
      // activeResultIndex will be corrected by child's emit -> onResultsChanged
    }
  }

    private updateEditorTheme() {
        if (!this.editorInstance) return;
        const isDark = this.document.documentElement.classList.contains('dark');
        this.editorInstance.setTheme(isDark ? 'ace/theme/monokai' : 'ace/theme/github');
    }

    private isDarkMode(): boolean {
        return this.document.documentElement.classList.contains('dark');
    }

    trackByTabId(index: number, tab: any): string {
        return tab?.id || index;
    }

    trackByDatabaseName(index: number, database: any): string {
        return database?.name || index;
    }

    updateDatabaseInfo() {
        const selectedDatabase = this.InitDBInfo?.find((db: any) => db.name === this.selectedDB);
        if (selectedDatabase && selectedDatabase.tables?.length) {
            const tableNames = selectedDatabase.tables.map((table: any) => table.name);
            this.dbService.getMultipleTablesInfo(this.selectedDB, tableNames).subscribe({
                next: (tableInfoArray: MultipleTablesInfo) => {
                    tableInfoArray.tables.forEach((tableInfo: any) => {
                        const tableIndex = selectedDatabase.tables.findIndex(
                            (t: any) => t.name === tableInfo.table_name
                        );
                        if (tableIndex > -1) {
                            selectedDatabase.tables[tableIndex] = {
                                ...selectedDatabase.tables[tableIndex],
                                columns: tableInfo.columns || [],
                                indexes: tableInfo.indexes || [],
                                foreign_keys: tableInfo.foreign_keys || [],
                                triggers: tableInfo.triggers || [],
                            };
                        }
                    });
                    this.cdr.markForCheck();
                },
                error: (error) => {
                    console.error('Error fetching table information for selected database:', error);
                }
            });
        } else {
            console.warn(`No tables found for selected database: ${this.selectedDB}`);
        }
    }

    initializeData(data: any) {
        if (data && Array.isArray(data)) {
            this.totalRows = data.length || 0;
            this.updatePaginatedData();
        } else {
            this.totalRows = 0;
            this.paginatedData = [];
        }
    }

    updatePaginatedData() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        this.paginatedData = (this.InitDBInfo || []).slice(start, end);
    }

    changePage(newPage: number) {
        if (newPage > 0 && newPage <= this.getTotalPages()) {
            this.currentPage = newPage;
            this.updatePaginatedData();
            this.cdr.markForCheck();
        }
    }

    getTotalPages(): number {
        return this.totalRows > 0 && this.pageSize > 0 ? Math.ceil(this.totalRows / this.pageSize) : 1;
    }

    ngAfterViewInit() {
        this.checkAndInitializeEditor();
    }

    convertToReadableSize(sizeInBytes: any): string {
        sizeInBytes = Number(sizeInBytes);
        if (isNaN(sizeInBytes)) {
            return 'Invalid size';
        }
        const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        let unitIndex = 0;
        while (sizeInBytes >= 1024 && unitIndex < units.length - 1) {
            sizeInBytes /= 1024;
            unitIndex++;
        }
        return `${sizeInBytes.toFixed(2)} ${units[unitIndex]}`;
    }

    ngAfterViewChecked() {
        if (this.needsEditorInit && this.selectedTab >= 0 && this.editor && !this.editorInstance) {
            this.checkAndInitializeEditor();
            this.editorInstance.setValue(this.tabContent[this.selectedTab]);
            this.needsEditorInit = false;
        }
    }

    checkAndInitializeEditor() {
        if (!this.editorInstance && this.editor) {
            this.initializeEditor();
        }
    }

    initializeEditor() {
        ace.config.set('basePath', 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.12/');
        if (!this.editorInstance) {
            this.editorInstance = ace.edit(this.editor.nativeElement);
            const isDark = this.isDarkMode();
            const theme = isDark ? 'ace/theme/monokai' : 'ace/theme/github';
            this.editorInstance.setOptions({
                mode: 'ace/mode/sql',
                theme: theme,
                fontSize: '14px',
                showPrintMargin: false,
                wrap: true,
                showGutter: true,
                highlightActiveLine: true,
                tabSize: 4,
                cursorStyle: 'smooth',
                showInvisibles: false,
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: true,
            });
            const editorContainer = this.editor.nativeElement;
            if (editorContainer) {
                editorContainer.style.zIndex = '9999';
            }
            const aceOverlays = document.querySelectorAll('.ace_autocomplete, .ace_tooltip');
            aceOverlays.forEach((overlay) => {
                (overlay as HTMLElement).style.zIndex = '10000';
            });
            const langTools = ace.require('ace/ext/language_tools');
            langTools.setCompleters([langTools.snippetCompleter, langTools.textCompleter, langTools.keyWordCompleter]);
            this.editorInstance.on('change', () => {
                if (this.selectedTab >= 0) {
                    this.tabContent[this.selectedTab] = this.editorInstance.getValue();
                }
            });
            this.editorInstance.commands.addCommand({
                name: 'find',
                bindKey: { win: 'Ctrl-F', mac: 'Command-F' },
                exec: (editor) => editor.execCommand('find'),
            });
            this.editorInstance.commands.addCommand({
                name: 'replace',
                bindKey: { win: 'Ctrl-H', mac: 'Command-Option-F' },
                exec: (editor) => editor.execCommand('replace'),
            });
        }
    }

    private generateSelectQuery(dbName: string, tableName: string, dbType: DatabaseType): string {
        switch (dbType) {
            case 'mysql2':
                // MySQL: database.table or just table if database is selected
                return `SELECT * FROM ${dbName}.${tableName};`;

            case 'pg':
                // PostgreSQL: schema.table or just table if schema is selected
                return `SELECT * FROM ${tableName};`;

            case 'sqlite3':
                // SQLite: just table name (no database prefix)
                return `SELECT * FROM ${tableName};`;

            case 'mssql':
                // SQL Server: [database].[schema].[table] or simplified
                return `SELECT * FROM ${dbName}.dbo.${tableName};`;

            case 'oracledb':
                // Oracle: schema.table or just table if schema is selected
                return `SELECT * FROM ${tableName};`;

            default:
                // Fallback to generic SQL
                return `SELECT * FROM ${tableName};`;
        }
    }

    // Helper method to generate database-specific table identifier
    private generateTableIdentifier(dbName: string, tableName: string, dbType: DatabaseType): string {
        switch (dbType) {
            case 'mysql2':
                return `${dbName}.${tableName}`;

            case 'pg':
                return `${dbName}.${tableName}`;

            case 'sqlite3':
                return `${dbName}/${tableName}`; // Use / separator for SQLite file-based DBs

            case 'mssql':
                return `${dbName}.${tableName}`;

            case 'oracledb':
                return `${dbName}.${tableName}`;

            default:
                return `${dbName}.${tableName}`;
        }
    }

    // Updated addTab method
    addTab(dbName: string, tableName: string) {
        if (this.tabs.length >= this.maxTabs) {
            alert(`Maximum number of tabs (${this.maxTabs}) reached. Please close some tabs.`);
            return;
        }

        // Generate database-specific identifier
        const id = this.generateTableIdentifier(dbName, tableName, this.databaseType);

        const tabIndex = this.tabs.findIndex((tab) => tab.id === id);
        if (tabIndex > -1) {
            this.selectTab(tabIndex);
            return;
        }

        // Generate database-specific display name
        let displayName = tableName;
        if (this.databaseType === 'sqlite3') {
            displayName = `${dbName}/${tableName}`; // Show DB file name for SQLite
        } else if (this.databaseType === 'mssql') {
            displayName = `${dbName}.${tableName}`; // Show database.table for SQL Server
        }

        this.tabs.push({
            id,
            dbName,
            tableName,
            displayName: displayName,
        });

        // Generate database-specific SELECT query
        const selectQuery = this.generateSelectQuery(dbName, tableName, this.databaseType);
        this.tabContent.push(selectQuery);

        this.selectTab(this.tabs.length - 1);

        if (!this.editorInstance) {
            this.needsEditorInit = true;
        } else {
            this.editorInstance.setValue(this.tabContent[this.selectedTab]);
            this.triggerQuery = this.tabContent[this.selectedTab];
            this.selectedDB = dbName;
            this.currentTabId = id;
        }

        if (this.openAIEnabled?.openAIEnabled) {
            this.updateDatabaseInfoIfNeeded(dbName);
        }

        this.cdr.markForCheck();
    }

    private updateDatabaseInfoIfNeeded(dbName: string) {
        const selectedDatabase = this.InitDBInfo?.find((db: any) => db.name === dbName);
        if (selectedDatabase) {
            const allTablesPopulated = selectedDatabase.tables.every(
                (table: any) => table.columns && table.columns.length > 0
            );
            if (!allTablesPopulated) {
                console.log(`Calling updateDatabaseInfo for ${dbName} as not all tables have columns populated.`);
                this.updateDatabaseInfo();
            }
        }
    }

    selectTab(tabIndex: number) {
        if (tabIndex < 0 || tabIndex >= this.tabs.length) return;
        if (!this.tabContent[tabIndex]) {
            this.tabContent[tabIndex] = '';
        }
        this.selectedTab = tabIndex;
        this.selectedDB = this.tabs[tabIndex].dbName;
        this.triggerQuery = this.tabContent[tabIndex];
        this.currentTabId = this.tabs[tabIndex].id;
        if (this.editorInstance) {
            this.editorInstance.setValue(this.tabContent[tabIndex]);
        }
        this.executeTriggered = false;
        this.editingTabIndex = null;
        this.activeResultIndex = 0;
    this.currentResultTabs = [];
    this.cdr.markForCheck();
    }

    closeTab(tabIndex: number) {
        if (tabIndex < 0 || tabIndex >= this.tabs.length) return;
        this.tabs.splice(tabIndex, 1);
        this.tabContent.splice(tabIndex, 1);
        this.selectedTab = this.tabs.length ? Math.max(0, tabIndex - 1) : -1;
        if (this.editorInstance && this.selectedTab >= 0) {
            this.editorInstance.setValue(this.tabContent[this.selectedTab]);
            this.triggerQuery = this.tabContent[this.selectedTab];
            this.selectedDB = this.tabs[this.selectedTab]?.dbName || '';
            this.currentTabId = this.tabs[this.selectedTab]?.id || '';
        } else {
            this.editorInstance?.destroy();
            this.editorInstance = null;
            this.needsEditorInit = true;
            this.selectedDB = '';
            this.currentTabId = '';
            this.triggerQuery = '';
        }
        this.editingTabIndex = null;
        this.activeResultIndex = 0;
    this.currentResultTabs = [];
    this.cdr.markForCheck();
    }

    closeAllTabs() {
        this.tabs = [];
        this.tabContent = [];
        this.selectedTab = -1;
        this.selectedDB = '';
        this.currentTabId = '';
        this.triggerQuery = '';
        this.executeTriggered = false;
        if (this.editorInstance) {
            this.editorInstance.setValue('');
            this.editorInstance.destroy();
            this.editorInstance = null;
            this.needsEditorInit = true;
        }
        this.editingTabIndex = null;
        this.activeResultIndex = 0;
        this.currentResultTabs = [];
        this.cdr.markForCheck();
    }

    startEditingTab(tabIndex: number) {
        this.editingTabIndex = tabIndex;
        this.cdr.markForCheck();
    }

    renameTab(tabIndex: number, newName: string) {
        if (tabIndex < 0 || tabIndex >= this.tabs.length || !newName.trim()) return;
        this.tabs[tabIndex].displayName = newName.trim();
        this.editingTabIndex = null;
        this.cdr.markForCheck();
    }

    handleDragStart(index: number) {
        console.log(`Drag started on tab ${index}`);
    }

    handleDragOver(event: Event) {
        event.preventDefault();
        (event as DragEvent).dataTransfer!.dropEffect = 'move';
    }

    handleDrop(targetIndex: number) {
        const sourceIndex = parseInt((event as DragEvent).dataTransfer!.getData('text/plain'), 10);
        console.log(`Dropped tab ${sourceIndex} onto tab ${targetIndex}`);
        if (sourceIndex === targetIndex) return;
        const [movedTab] = this.tabs.splice(sourceIndex, 1);
        this.tabs.splice(targetIndex, 0, movedTab);
        const [movedContent] = this.tabContent.splice(sourceIndex, 1);
        this.tabContent.splice(targetIndex, 0, movedContent);
        if (this.selectedTab === sourceIndex) {
            this.selectedTab = targetIndex;
        } else if (sourceIndex < this.selectedTab && targetIndex >= this.selectedTab) {
            this.selectedTab--;
        } else if (sourceIndex > this.selectedTab && targetIndex <= this.selectedTab) {
            this.selectedTab++;
        }
        this.cdr.markForCheck();
    }

    handleDragEnd() {
        console.log('Drag ended');
    }

    handleExecQueryClick() {
  this.triggerQuery = this.tabContent[this.selectedTab] || '';
  // flip the boolean so ngOnChanges in child sees a change every click
  this.executeTriggered = !this.executeTriggered;
  this.cdr.markForCheck();
}

// Build a display name for a result (dbname.table or sensible fallback)
getResultTabLabel(r: any, index: number): string {
  if (r?.displayName && typeof r.displayName === 'string') return r.displayName;

  const db = (r?.dbName || this.selectedDB || '').toString();
  const table = (r?.tableName || this.extractFirstIdentifier(r?.query || '') || '').toString();

  if (db && table) return `${db}.${table}`;
  if (table) return table;
  if (db) return `${db}_Q${index + 1}`;
  return `Query ${index + 1}`;
}

// Try to infer the first table-like identifier from a SQL statement
private extractFirstIdentifier(sql: string): string | null {
  if (!sql) return null;
  // Look after FROM / JOIN / INTO / UPDATE (first hit wins)
  const m = sql.match(/\b(FROM|JOIN|INTO|UPDATE)\s+([`"'[\]]?[\w.]+[`"'[\]]?)/i);
  if (!m || !m[2]) return null;

  // Clean quotes/brackets
  return m[2].replace(/^[`"'[\]]+|[`"'[\]]+$/g, '');
}


    handleOpenAIPrompt() {
        this.dbService.executeOpenAIPrompt(this.InitDBInfo, this.selectedDB, this.tabContent[this.selectedTab]).subscribe({
            next: (data) => {
                if (this.editorInstance) {
                    this.editorInstance.setValue(data.query);
                    this.tabContent[this.selectedTab] = data.query;
                }
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.error('AI prompt error:', error);
            }
        });
    }

    onDiscQueryClick() {
        if (this.editorInstance) {
            this.editorInstance.setValue('');
        }
        this.tabContent[this.selectedTab] = '';
        this.triggerQuery = '';
        this.executeTriggered = false;
        this.cdr.markForCheck();
    }
}