import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackendService } from '@lib/services';
import { Column, ColumnDef } from '@lib/utils/storage/storage.types';

function emptyColDef(): ColumnDef {
    return { name: '', type: 'VARCHAR(255)', nullable: true, default: '' };
}

@Component({
    selector: 'app-table-designer',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './table-designer.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableDesignerComponent implements OnInit {
    @Input() mode: 'create' | 'alter' = 'create';
    @Input() dbName = '';
    @Input() tableName = '';

    @Output() done = new EventEmitter<void>();
    @Output() cancel = new EventEmitter<void>();

    existingColumns: Column[] = [];
    // create mode
    newTableName = '';
    rows: ColumnDef[] = [emptyColDef()];
    // alter mode: add-column form
    addCol: ColumnDef = emptyColDef();
    // alter mode: inline edit of an existing column
    editingCol: number | null = null;
    editDraft: ColumnDef = emptyColDef();

    error: string | null = null;
    busy = false;
    loading = false;

    constructor(private db: BackendService, private cdr: ChangeDetectorRef) {}

    ngOnInit() {
        if (this.mode === 'alter' && this.dbName && this.tableName) {
            this.loading = true;
            this.db.getTableInfo(this.dbName, this.tableName).subscribe({
                next: (info) => {
                    this.existingColumns = info?.columns || [];
                    this.loading = false;
                    this.cdr.markForCheck();
                },
                error: (e) => {
                    this.error = '加载表结构失败：' + (e?.message || '');
                    this.loading = false;
                    this.cdr.markForCheck();
                },
            });
        }
    }

    // ---- create mode ----
    addRow() {
        this.rows.push(emptyColDef());
        this.cdr.markForCheck();
    }

    removeRow(i: number) {
        this.rows.splice(i, 1);
        this.cdr.markForCheck();
    }

    createTable() {
        const cols = this.rows.filter((r) => r.name && r.type);
        if (!this.newTableName.trim()) {
            this.error = '请输入表名';
            this.cdr.markForCheck();
            return;
        }
        if (cols.length === 0) {
            this.error = '至少需要一列';
            this.cdr.markForCheck();
            return;
        }
        this.run(() =>
            this.db.createTable(this.dbName, { table: this.newTableName.trim(), columns: cols }),
        );
    }

    // ---- alter mode ----
    addColumn() {
        if (!this.addCol.name || !this.addCol.type) {
            this.error = '列名和类型必填';
            this.cdr.markForCheck();
            return;
        }
        const col = { ...this.addCol };
        this.run(() => this.db.addColumn(this.dbName, this.tableName, col), () => {
            this.addCol = emptyColDef();
        });
    }

    startEdit(i: number) {
        const c = this.existingColumns[i];
        this.editingCol = i;
        this.editDraft = {
            name: c.column_name,
            type: c.column_type,
            nullable: c.is_nullable !== 'NO',
            default: c.column_default ?? '',
            autoIncrement: /auto_increment/i.test(c.extra || ''),
        };
        this.error = null;
        this.cdr.markForCheck();
    }

    cancelEdit() {
        this.editingCol = null;
        this.cdr.markForCheck();
    }

    saveEdit() {
        if (this.editingCol === null) return;
        const i = this.editingCol;
        const oldName = this.existingColumns[i].column_name;
        const def = { ...this.editDraft };
        this.editingCol = null;
        this.run(() => this.db.modifyColumn(this.dbName, this.tableName, oldName, def));
    }

    dropColumn(i: number) {
        const name = this.existingColumns[i].column_name;
        this.run(() => this.db.dropColumn(this.dbName, this.tableName, name));
    }

    // ---- shared ----
    private run(op: () => any, onSuccess?: () => void) {
        this.busy = true;
        this.error = null;
        this.cdr.markForCheck();
        op().subscribe({
            next: () => {
                this.busy = false;
                onSuccess?.();
                this.done.emit();
            },
            error: (e) => {
                this.busy = false;
                this.error = e?.error?.detail || e?.message || '操作失败';
                this.cdr.markForCheck();
            },
        });
    }
}
