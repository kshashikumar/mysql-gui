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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DbMeta, MultipleTablesInfo, newTabData, openAIEvent } from '@lib/utils/storage/storage.types';
import { ResultGridComponent } from '@pages/resultgrid/resultgrid.component';
import * as ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/ext-language_tools';
import { BackendService } from '@lib/services';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, ResultGridComponent],
    templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnChanges, AfterViewInit, AfterViewChecked {
    @Input() tabData!: newTabData;
    @Input() openAIEnabled!: openAIEvent;
    @Input() InitDBInfo!: any;
    @ViewChild('editor', { static: false }) editor: ElementRef;
    @ViewChild('tabContainer', { static: false }) tabContainer: ElementRef;
    tabs = [];
    selectedTab = -1;
    tabContent: string[] = [];
    editorInstance: any;
    needsEditorInit = false;
    triggerQuery: string = '';
    executeTriggered: boolean = false;
    selectedDB: string = '';
    currentTabId: string = '';

    currentPage: number = 1;
    pageSize: number = 5;
    totalRows: number = 0;
    paginatedData: any[] = [];

    tableName: string = '';

    constructor(private cdr: ChangeDetectorRef, private dbService: BackendService) {}

    ngOnInit() {
        if (this.InitDBInfo) {
            this.initializeData(this.InitDBInfo);
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

    updateDatabaseInfo() {
        const selectedDatabase = this.InitDBInfo?.find((db: any) => db.name === this.selectedDB);

        if (selectedDatabase && selectedDatabase.tables?.length) {
            const tableNames = selectedDatabase.tables.map((table: any) => table.name);

            // Call getMultipleTablesInfo for the selected database
            this.dbService.getMultipleTablesInfo(this.selectedDB, tableNames).subscribe(
                (tableInfoArray: MultipleTablesInfo) => {
                    tableInfoArray.tables.forEach((tableInfo: any) => {
                        const tableIndex = selectedDatabase.tables.findIndex(
                            (t: any) => t.name === tableInfo.table_name,
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
                    this.cdr.detectChanges();
                },
                (error) => {
                    console.error('Error fetching table information for selected database:', error);
                },
            );
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
        if (newPage > 0 && newPage <= Math.ceil(this.totalRows / this.pageSize)) {
            this.currentPage = newPage;
            this.updatePaginatedData();
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

            this.editorInstance.setOptions({
                mode: 'ace/mode/sql',
                theme: 'ace/theme/github',
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
            const langTools = ace.require('ace/ext/language_tools');
            langTools.setCompleters([langTools.snippetCompleter, langTools.textCompleter, langTools.keyWordCompleter]);
            this.editorInstance.on('change', () => {
                this.tabContent[this.selectedTab] = this.editorInstance.getValue();
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

    addTab(dbName: string, tableName: string) {
        // this.showInitDBInfo = false; // Do we need this?
        const id = `${dbName}.${tableName}.${new Date().getTime()}`; // Generate unique tab id, by using timestamp
        const tabIndex = this.tabs.findIndex((tab) => tab.id === id);
        if (tabIndex > -1) {
            this.selectTab(tabIndex);
            return;
        }

        this.tabs.push({
            id,
            dbName,
            tableName,
        });

        this.tabContent.push(`SELECT * FROM ${dbName}.${tableName};`);
        this.selectTab(this.tabs.length - 1);

        if (!this.editorInstance) {
            this.needsEditorInit = true;
        } else {
            this.editorInstance.setValue(this.tabContent[this.selectedTab]);
            this.triggerQuery = this.tabContent[this.selectedTab];
            this.selectedDB = dbName;
            this.currentTabId = id;
        }

        // Check if OpenAI is enabled and if table columns are already populated
        if (this.openAIEnabled) {
            const selectedDatabase = this.InitDBInfo?.find((db: any) => db.name === dbName);

            if (selectedDatabase) {
                const allTablesPopulated = selectedDatabase.tables.every(
                    (table: any) => table.columns && table.columns.length > 0,
                );

                if (!allTablesPopulated) {
                    console.log(`Calling updateDatabaseInfo for ${dbName} as not all tables have columns populated.`);
                    this.updateDatabaseInfo();
                } else {
                    console.log(
                        `Skipping updateDatabaseInfo for ${dbName} as all tables already have columns populated.`,
                    );
                }
            } else {
                console.warn(`Database ${dbName} not found in InitDBInfo.`);
            }
        }
        // this.executeTriggered = false;// Do we need this?
        this.cdr.detectChanges();
        this.scrollTabIntoView(this.tabs.length - 1);
    }

    selectTab(tabIndex: number) {
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
        this.cdr.detectChanges();
        this.scrollTabIntoView(tabIndex);
    }

    scrollTabIntoView(tabIndex: number) {
        if (this.tabContainer && this.tabContainer.nativeElement) {
            const tabElement = this.tabContainer.nativeElement.children[tabIndex];
            if (tabElement) {
                tabElement.scrollIntoView({ behavior: 'smooth', inline: 'center' });
            }
        }
    }

    closeTab(tabIndex: number) {
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
        }
    }

    updateTableName(index: number, newTableName: string) {
        this.tabs[index].tableName = newTableName;
        console.log('Updated table name:', newTableName);
    }

    handleExecQueryClick() {
        this.triggerQuery = this.tabContent[this.selectedTab];
        this.executeTriggered = true;

        // Extract the database name from the query
        const match = this.triggerQuery.match(/FROM\s+(\w+)\./i);
        if (match && match[1]) {
            this.selectedDB = match[1];
        } else {
            console.error('Database name not found in query');
            return;
        }
        

        // Extract the table name from the query
        const matchTable = this.triggerQuery.match(/FROM\s+\w+\.(\w+)/i);
        if (matchTable && matchTable[1]) {
            this.tableName = matchTable[1];
        } else {
            console.error('Table name not found in query');
            return;
        }  

        this.updateTableName(this.selectedTab, this.tableName);
        // Manually trigger change detection to update the UI
        this.cdr.detectChanges();

        this.dbService.executeQuery(this.triggerQuery, this.selectedDB).subscribe({
            next: (result) => {
                // Handle the result of the query execution
                console.log('Query executed successfully:', result);
                // this.updateTableName(this.selectedTab, this.tableName);
                console.log('Updated Successfully');
            
            },
            error: (error) => {
                // Handle any errors that occur during query execution
                console.error('Error executing query:', error);
            }
        });
    

    }

    handleOpenAIPrompt() {
        this.dbService.executeOpenAIPrompt(this.InitDBInfo, this.selectedDB, this.tabContent[this.selectedTab]).subscribe(
            (data) => {
                //this.tabContent[this.selectedTab] = data.query;
                this.editorInstance.setValue(data.query);
            },
            (error) => {
                console.log(error);
            },
        );
    }

    onDiscQueryClick() {
        if (this.editorInstance) {
            this.editorInstance.setValue('');
        }
        this.tabContent[this.selectedTab] = '';
        this.triggerQuery = '';
        this.executeTriggered = false;
    }

    convertToGB(sizeInBytes: number): string {
        return (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
}
