import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    ColumnDef,
    CreateDatabaseRequest,
    CreateTableRequest,
    DbMeta,
    DeleteRowRequest,
    DdlResult,
    InsertRowRequest,
    MultipleTablesInfo,
    OpenAIPrompt,
    OpenAIPromptResponse,
    RowWriteResult,
    TableInfo,
    UpdateRowRequest,
} from '@lib/utils/storage/storage.types';

@Injectable({
    providedIn: 'root',
})
export class BackendService {
    BASE_URL = environment.apiUrl;

    constructor(private _http: HttpClient) {}

    getDatabases(): Observable<any[]> {
        return this._http.get<any[]>(`${this.BASE_URL}/api/mysql/databases`);
    }

    getTableInfo(dbName, table): Observable<TableInfo> {
        return this._http.get<TableInfo>(`${this.BASE_URL}/api/mysql/database/${dbName}/${table}/info`);
    }

    getMultipleTablesInfo(dbName, tables: any[]): Observable<any> {
        const payload = { tables };
        console.log(dbName);
        console.log(tables);
        return this._http.post<MultipleTablesInfo>(`${this.BASE_URL}/api/mysql/database/${dbName}/info`, payload);
    }

    executeQuery(query: string, dbName: string, page: number = 1, pageSize: number = 10): Observable<any> {
        const payload = { query, page, pageSize };
        return this._http.post<any[]>(`${this.BASE_URL}/api/mysql/database/${dbName}/execute-query`, payload);
    }

    // ---- Row CRUD (Phase 1) ----
    insertRow(dbName: string, body: InsertRowRequest): Observable<RowWriteResult> {
        return this._http.post<RowWriteResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/row/insert`, body);
    }

    updateRow(dbName: string, body: UpdateRowRequest): Observable<RowWriteResult> {
        return this._http.put<RowWriteResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/row/update`, body);
    }

    deleteRow(dbName: string, body: DeleteRowRequest): Observable<RowWriteResult> {
        return this._http.delete<RowWriteResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/row/delete`, { body });
    }

    // ---- Structure / DDL (Phase 2) ----
    createDatabase(body: CreateDatabaseRequest): Observable<DdlResult> {
        return this._http.post<DdlResult>(`${this.BASE_URL}/api/mysql/database`, body);
    }

    dropDatabase(dbName: string): Observable<DdlResult> {
        return this._http.delete<DdlResult>(`${this.BASE_URL}/api/mysql/database/${dbName}`);
    }

    createTable(dbName: string, body: CreateTableRequest): Observable<DdlResult> {
        return this._http.post<DdlResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/table`, body);
    }

    dropTable(dbName: string, table: string): Observable<DdlResult> {
        return this._http.delete<DdlResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/table/${table}`);
    }

    renameTable(dbName: string, table: string, newName: string): Observable<DdlResult> {
        return this._http.patch<DdlResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/table/${table}/rename`, { newName });
    }

    truncateTable(dbName: string, table: string): Observable<DdlResult> {
        return this._http.post<DdlResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/table/${table}/truncate`, {});
    }

    addColumn(dbName: string, table: string, column: ColumnDef): Observable<DdlResult> {
        return this._http.post<DdlResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/table/${table}/column`, { column });
    }

    dropColumn(dbName: string, table: string, column: string): Observable<DdlResult> {
        return this._http.delete<DdlResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/table/${table}/column/${column}`);
    }

    modifyColumn(dbName: string, table: string, column: string, definition: ColumnDef): Observable<DdlResult> {
        return this._http.patch<DdlResult>(`${this.BASE_URL}/api/mysql/database/${dbName}/table/${table}/column/${column}`, { definition });
    }

    executeOpenAIPrompt(dbMeta: DbMeta[], databaseName: string, prompt: string) {
        console.log(dbMeta);
        const payload: OpenAIPrompt = { dbMeta, databaseName, prompt };
        return this._http.post<OpenAIPromptResponse>(`${this.BASE_URL}/api/mysql/openai/prompt`, payload);
    }
}
