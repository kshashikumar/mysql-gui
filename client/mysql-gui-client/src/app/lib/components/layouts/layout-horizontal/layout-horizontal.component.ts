import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent, NavbarComponent, SideBarComponent, TableDesignerComponent } from '@lib/components';
import { HomeComponent } from '@pages/home/home.component';
import { BackendService } from '@lib/services';
import { newTabData, openAIEvent } from '@lib/utils/storage/storage.types';

type DdlModal =
    | { kind: 'createDatabase' }
    | { kind: 'dropDatabase'; dbName: string }
    | { kind: 'createTable'; dbName: string }
    | { kind: 'designTable'; dbName: string; tableName: string }
    | { kind: 'renameTable'; dbName: string; tableName: string }
    | { kind: 'truncateTable'; dbName: string; tableName: string }
    | { kind: 'dropTable'; dbName: string; tableName: string };

@Component({
    selector: 'app-layout-horizontal',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        NavbarComponent,
        SideBarComponent,
        HomeComponent,
        ModalComponent,
        TableDesignerComponent,
    ],
    templateUrl: './layout-horizontal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutHorizontalComponent {
    tabData: newTabData;
    databases: any = {};
    openAIEnabledFlag: openAIEvent;

    ddlModal: DdlModal | null = null;
    newDbName = '';
    renameTo = '';
    ddlError: string | null = null;
    ddlBusy = false;

    @ViewChild(SideBarComponent) sidebar!: SideBarComponent;

    constructor(private db: BackendService, private cdr: ChangeDetectorRef) {}

    // Re-exported for the template (avoids discriminated-union narrowing issues).
    get modalDbName(): string {
        return (this.ddlModal as any)?.dbName ?? '';
    }
    get modalTableName(): string {
        return (this.ddlModal as any)?.tableName ?? '';
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

    // ---- open modals (from navbar / sidebar emitters) ----
    onCreateDatabase() {
        this.resetForm();
        this.ddlModal = { kind: 'createDatabase' };
    }
    onDropDatabase(e: { dbName: string }) {
        this.resetForm();
        this.ddlModal = { kind: 'dropDatabase', dbName: e.dbName };
    }
    onCreateTable(e: { dbName: string }) {
        this.resetForm();
        this.ddlModal = { kind: 'createTable', dbName: e.dbName };
    }
    onDesignTable(e: { dbName: string; tableName: string }) {
        this.resetForm();
        this.ddlModal = { kind: 'designTable', dbName: e.dbName, tableName: e.tableName };
    }
    onRenameTable(e: { dbName: string; tableName: string }) {
        this.resetForm();
        this.renameTo = e.tableName;
        this.ddlModal = { kind: 'renameTable', dbName: e.dbName, tableName: e.tableName };
    }
    onTruncateTable(e: { dbName: string; tableName: string }) {
        this.resetForm();
        this.ddlModal = { kind: 'truncateTable', dbName: e.dbName, tableName: e.tableName };
    }
    onDropTable(e: { dbName: string; tableName: string }) {
        this.resetForm();
        this.ddlModal = { kind: 'dropTable', dbName: e.dbName, tableName: e.tableName };
    }

    private resetForm() {
        this.ddlError = null;
        this.ddlBusy = false;
        this.newDbName = '';
        this.renameTo = '';
    }

    closeDdl() {
        this.ddlModal = null;
        this.cdr.markForCheck();
    }

    onDesignerDone() {
        this.closeDdl();
        this.refreshSidebar();
    }

    private refreshSidebar() {
        this.sidebar?.refresh();
    }

    // ---- confirm handlers ----
    confirmCreateDatabase() {
        const name = this.newDbName.trim();
        if (!name) {
            this.ddlError = '请输入数据库名';
            this.cdr.markForCheck();
            return;
        }
        this.runDdl(this.db.createDatabase({ database: name }));
    }

    confirmDropDatabase() {
        this.runDdl(this.db.dropDatabase(this.modalDbName));
    }

    confirmRenameTable() {
        const newName = this.renameTo.trim();
        if (!newName) {
            this.ddlError = '请输入新表名';
            this.cdr.markForCheck();
            return;
        }
        this.runDdl(this.db.renameTable(this.modalDbName, this.modalTableName, newName));
    }

    confirmTruncateTable() {
        this.runDdl(this.db.truncateTable(this.modalDbName, this.modalTableName));
    }

    confirmDropTable() {
        this.runDdl(this.db.dropTable(this.modalDbName, this.modalTableName));
    }

    private runDdl(obs: any) {
        this.ddlBusy = true;
        this.ddlError = null;
        this.cdr.markForCheck();
        obs.subscribe({
            next: () => {
                this.ddlBusy = false;
                this.closeDdl();
                this.refreshSidebar();
            },
            error: (e: any) => {
                this.ddlBusy = false;
                this.ddlError = e?.error?.detail || e?.message || '操作失败';
                this.cdr.markForCheck();
            },
        });
    }
}
