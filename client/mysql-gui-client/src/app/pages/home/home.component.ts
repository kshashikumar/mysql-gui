import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { newTabData } from '@lib/utils/storage/storage.types';
import * as CodeMirror from 'codemirror';
import 'codemirror/mode/sql/sql';
import 'codemirror/lib/codemirror.css';
import { ResultGridComponent } from '@pages/resultgrid/resultgrid.component';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, ResultGridComponent],
    templateUrl: './home.component.html',
})
export class HomeComponent implements OnChanges, AfterViewInit {
    @Input() tabData!: newTabData;
    @ViewChild('editor', { static: false }) editor: ElementRef;
    tabs = [];
    selectedTab = 0;
    tabContent: string[] = [];
    editorInstance: any;

    constructor() {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['tabData'] && this.tabData?.dbName && this.tabData?.tableName) {
            this.addTab(this.tabData.dbName, this.tabData.tableName);
        }
    }

    ngAfterViewInit() {
        this.editorInstance = CodeMirror.fromTextArea(this.editor.nativeElement, {
            lineNumbers: true,
            mode: 'sql',
            theme: 'default',
            lineWrapping: true,
            matchBrackets: true,
            showCursorWhenSelecting: true,
            smartIndent: true,
            extraKeys: {
                'Ctrl-Space': 'autocomplete',
                'Ctrl-Q': function (cm) {
                    cm.foldCode(cm.getCursor());
                },
            },
            autofocus: true,
            cursorHeight: 0.85,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
            highlightSelectionMatches: {
                showToken: /\w/,
                annotateScrollbar: true,
            },
            hintOptions: {
                completeSingle: false,
            },
            matchTags: { bothTags: true },
        });
        this.editorInstance.on('change', () => {
            this.tabContent[this.selectedTab] = this.editorInstance.getValue();
        });

        if (this.tabContent[this.selectedTab]) {
            this.editorInstance.setValue(this.tabContent[this.selectedTab]);
        } else {
            this.editorInstance.setValue('');
        }
    }

    addTab(dbName: string, tableName: string) {
        const id = `${dbName}.${tableName}`;
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
        if (this.editorInstance) {
            this.editorInstance.setValue(this.tabContent[this.selectedTab]);
        }
    }

    selectTab(tabIndex: number) {
        this.selectedTab = tabIndex;
        if (!this.tabContent[tabIndex]) {
            this.tabContent[tabIndex] = '';
        }

        if (this.editorInstance) {
            this.editorInstance.setValue(this.tabContent[tabIndex]);
        }
    }

    closeTab(tabIndex: number) {
        this.tabs.splice(tabIndex, 1);
        this.tabContent.splice(tabIndex, 1);
        this.selectedTab = this.tabs.length ? Math.max(0, tabIndex - 1) : -1;

        if (this.editorInstance && this.selectedTab >= 0) {
            this.editorInstance.setValue(this.tabContent[this.selectedTab]);
        } else {
            this.editorInstance.setValue('');
        }
    }
}
