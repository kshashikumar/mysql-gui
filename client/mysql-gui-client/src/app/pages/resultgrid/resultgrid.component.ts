import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BackendService } from '@lib/services';
import { ModalComponent } from '@lib/components';
import { Column } from '@lib/utils/storage/storage.types';
import { TruncatePipe } from '@lib/providers/truncate.pipe';

type InputKind = 'checkbox' | 'number' | 'date' | 'datetime' | 'textarea' | 'text';

@Component({
    selector: 'app-resultgrid',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, ModalComponent, TruncatePipe],
    templateUrl: './resultgrid.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultGridComponent {
    @Input() triggerQuery: string = '';
    @Input() executeTriggered: boolean = false;
    @Input() dbName: string = '';
    @Input() tabId: string = '';
    // Column metadata for the active tab's table (drives inline editing).
    @Input() columns: Column[] = [];
    @Input() tableName: string = '';

    tabsData = new Map<string, any>();
    headers: string[] = [];
    rows: any[] = [];
    isLoading: boolean = false;
    copiedCell: string | null = null;
    errorMessage: string | null = null;
    copiedPosition = { left: 0, top: 0 };
    currentPage: number = 1;
    pageSize: number = 10;
    totalRows: number = 0;
    totalPages: number = 1;

    // Inline-edit state
    editing: { rowIdx: number; header: string } | null = null;
    editValue: any = null;

    // Delete-row confirm state
    pendingDelete: any | null = null;

    // Insert-row modal state
    showInsert = false;
    insertModel: Record<string, any> = {};

    // Transient action notice (success / error)
    actionNotice: { kind: 'ok' | 'error'; text: string } | null = null;

    constructor(private dbService: BackendService, private cdr: ChangeDetectorRef) {}

    // ---- Derived metadata helpers -------------------------------------------

    get pkColumns(): string[] {
        return (this.columns || [])
            .filter((c) => c.column_key === 'PRI')
            .map((c) => c.column_name);
    }

    /** Inline editing requires a known table + a PK that is present in the result set. */
    get editable(): boolean {
        if (!this.tableName || this.pkColumns.length === 0) return false;
        return this.pkColumns.every((pk) => this.headers.includes(pk));
    }

    get insertableColumns(): Column[] {
        return (this.columns || []).filter((c) => !/auto_increment/i.test(c.extra || ''));
    }

    colByName(name: string): Column | undefined {
        return (this.columns || []).find((c) => c.column_name === name);
    }

    isPk(name: string): boolean {
        return this.pkColumns.includes(name);
    }

    inputKind(name: string): InputKind {
        const c = this.colByName(name);
        if (!c) return 'text';
        const t = (c.data_type || '').toLowerCase();
        if (t === 'tinyint' && c.column_type === 'tinyint(1)') return 'checkbox';
        if (['int', 'bigint', 'smallint', 'mediumint', 'tinyint', 'decimal', 'float', 'double', 'bit', 'year'].includes(t)) return 'number';
        if (t === 'date') return 'date';
        if (['datetime', 'timestamp'].includes(t)) return 'datetime';
        if (['text', 'mediumtext', 'longtext', 'tinytext', 'json'].includes(t) || t.includes('blob')) return 'textarea';
        return 'text';
    }

    // ---- Lifecycle ----------------------------------------------------------

    ngOnChanges(changes: SimpleChanges) {
        if (changes['triggerQuery'] || changes['dbName'] || changes['tabId']) {
            if (this.dbName != '' && this.triggerQuery != '') {
                this.currentPage = 1;
                this.executeQuery();
            }
        }
    }

    executeQuery() {
        this.isLoading = true;
        this.errorMessage = null;
        this.cdr.markForCheck();

        const hasLimitOrOffset = /LIMIT\s+\d+/i.test(this.triggerQuery) || /OFFSET\s+\d+/i.test(this.triggerQuery);
        let effectiveQuery = this.triggerQuery;

        if (!hasLimitOrOffset) {
            const offset = (this.currentPage - 1) * this.pageSize;
            effectiveQuery = `${this.triggerQuery} LIMIT ${this.pageSize} OFFSET ${offset}`;
        }

        this.dbService.executeQuery(this.triggerQuery, this.dbName, this.currentPage, this.pageSize).subscribe(
            (data) => {
                if (data) {
                    const { rows, totalRows } = data;
                    this.tabsData.set(this.tabId, data);
                    this.setData(rows);
                    if (hasLimitOrOffset) {
                        this.currentPage = 1;
                        this.totalPages = 1;
                        this.totalRows = rows.length;
                    } else {
                        this.totalRows = totalRows;
                        this.totalPages = Math.ceil(this.totalRows / this.pageSize);
                    }
                } else {
                    console.error('Error: API returned empty data or unexpected format');
                    this.setData([]);
                    this.totalRows = 0;
                    this.totalPages = 1;
                }
                this.isLoading = false;
                this.cdr.markForCheck();
            },
            (error) => {
                this.errorMessage = 'An error occurred while executing the query. Please check and try again.';
                console.error('Error fetching data', error);
                this.isLoading = false;
                this.rows = [];
                this.headers = [];
                this.cdr.markForCheck();
            },
        );
    }

    private setData(data: any[]) {
        this.editing = null; // reset any in-flight edit when data changes
        if (data && data.length > 0) {
            this.headers = Object.keys(data[0]);
            this.rows = data;
        } else {
            this.headers = [];
            this.rows = [];
        }
        this.cdr.markForCheck();
    }

    copyToClipboard(text: string, rowIndex: number, header: string, event: MouseEvent) {
        navigator.clipboard.writeText(text).then(
            () => {
                this.copiedCell = `${rowIndex}-${header}`;
                this.copiedPosition = { left: event.pageX, top: event.pageY - 30 };
                this.cdr.markForCheck();
                setTimeout(() => {
                    this.copiedCell = null;
                    this.cdr.markForCheck();
                }, 1000);
                console.log('Copied to clipboard:', text);
            },
            (err) => {
                console.error('Failed to copy:', err);
            },
        );
    }

    changePage(newPage: number) {
        if (newPage > 0 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.executeQuery();
        }
    }

    // ---- Inline editing -----------------------------------------------------

    private toInputValue(header: string, value: any): any {
        if (this.inputKind(header) === 'datetime' && typeof value === 'string') {
            // MySQL 'YYYY-MM-DD HH:MM:SS' -> datetime-local 'YYYY-MM-DDTHH:MM'
            return value.replace(' ', 'T').substring(0, 16);
        }
        return value;
    }

    tryEdit(rowIdx: number, header: string) {
        if (!this.editable || this.isPk(header)) return;
        this.editing = { rowIdx, header };
        this.editValue = this.toInputValue(header, this.rows[rowIdx]?.[header]);
        this.cdr.markForCheck();
    }

    isEditing(rowIdx: number, header: string): boolean {
        return !!this.editing && this.editing.rowIdx === rowIdx && this.editing.header === header;
    }

    cancelEdit() {
        this.editing = null;
        this.editValue = null;
        this.cdr.markForCheck();
    }

    onEditKeydown(event: KeyboardEvent, row: any, header: string) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.saveEdit(row, header);
        } else if (event.key === 'Escape') {
            this.cancelEdit();
        }
    }

    saveEdit(row: any, header: string) {
        if (!this.editing) return;
        const original = row[header];
        let newVal: any = this.editValue;
        const wasEditing = this.editing;
        this.editing = null;
        this.editValue = null;

        const norm = (v: any) => (v === null || v === undefined ? '' : String(v));
        if (norm(newVal) === norm(original)) {
            this.cdr.markForCheck();
            return; // no change
        }

        const rowIdx = wasEditing!.rowIdx;
        this.dbService
            .updateRow(this.dbName, {
                table: this.tableName,
                pkColumns: this.pkColumns,
                pkValues: this.pkColumns.map((pk) => row[pk]),
                values: { [header]: newVal },
            })
            .subscribe({
                next: () => {
                    this.rows[rowIdx][header] = newVal;
                    this.flash('ok', '已更新');
                    this.cdr.markForCheck();
                },
                error: (e) => {
                    console.error('Update failed', e);
                    this.flash('error', '更新失败：' + (e?.error?.detail || e?.message || ''));
                    this.cdr.markForCheck();
                },
            });
    }

    /** Toggle a tinyint(1) boolean directly from display mode. */
    toggleBoolean(row: any, header: string, event: Event) {
        if (!this.editable || this.isPk(header)) return;
        const target = event.target as HTMLInputElement;
        const newVal = target.checked ? 1 : 0;
        if (newVal === row[header]) return;
        this.dbService
            .updateRow(this.dbName, {
                table: this.tableName,
                pkColumns: this.pkColumns,
                pkValues: this.pkColumns.map((pk) => row[pk]),
                values: { [header]: newVal },
            })
            .subscribe({
                next: () => {
                    row[header] = newVal;
                    this.flash('ok', '已更新');
                    this.cdr.markForCheck();
                },
                error: (e) => {
                    console.error('Toggle failed', e);
                    target.checked = !target.checked; // revert UI
                    this.flash('error', '更新失败：' + (e?.error?.detail || e?.message || ''));
                    this.cdr.markForCheck();
                },
            });
    }

    // ---- Delete row ---------------------------------------------------------

    askDeleteRow(row: any) {
        if (!this.editable) return;
        this.pendingDelete = row;
        this.cdr.markForCheck();
    }

    confirmDelete() {
        if (!this.pendingDelete) return;
        const row = this.pendingDelete;
        this.pendingDelete = null;
        this.dbService
            .deleteRow(this.dbName, {
                table: this.tableName,
                pkColumns: this.pkColumns,
                pkValues: this.pkColumns.map((pk) => row[pk]),
            })
            .subscribe({
                next: () => {
                    this.flash('ok', '已删除');
                    this.executeQuery();
                },
                error: (e) => {
                    console.error('Delete failed', e);
                    this.flash('error', '删除失败：' + (e?.error?.detail || e?.message || ''));
                    this.cdr.markForCheck();
                },
            });
    }

    cancelDelete() {
        this.pendingDelete = null;
        this.cdr.markForCheck();
    }

    // ---- Insert row ---------------------------------------------------------

    openInsert() {
        if (!this.editable) return;
        const model: Record<string, any> = {};
        for (const c of this.insertableColumns) {
            model[c.column_name] = this.inputKind(c.column_name) === 'checkbox' ? false : '';
        }
        this.insertModel = model;
        this.showInsert = true;
        this.cdr.markForCheck();
    }

    confirmInsert() {
        const row: Record<string, any> = {};
        for (const c of this.insertableColumns) {
            const v = this.insertModel[c.column_name];
            const kind = this.inputKind(c.column_name);
            if (v === '' || v === null || v === undefined) continue; // omit empty -> use DB default / NULL
            row[c.column_name] = kind === 'checkbox' ? (v ? 1 : 0) : v;
        }
        this.showInsert = false;
        this.dbService
            .insertRow(this.dbName, { table: this.tableName, rows: [row] })
            .subscribe({
                next: () => {
                    this.flash('ok', '已新增行');
                    this.executeQuery();
                },
                error: (e) => {
                    console.error('Insert failed', e);
                    this.flash('error', '新增失败：' + (e?.error?.detail || e?.message || ''));
                    this.cdr.markForCheck();
                },
            });
    }

    cancelInsert() {
        this.showInsert = false;
        this.cdr.markForCheck();
    }

    // ---- Notice helper ------------------------------------------------------

    private flash(kind: 'ok' | 'error', text: string) {
        this.actionNotice = { kind, text };
        this.cdr.markForCheck();
        setTimeout(() => {
            this.actionNotice = null;
            this.cdr.markForCheck();
        }, 2500);
    }
}
