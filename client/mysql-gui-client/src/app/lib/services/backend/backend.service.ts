import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
    DbMeta,
    MultipleTablesInfo,
    OpenAIPrompt,
    OpenAIPromptResponse,
    TableInfo,
} from '@lib/utils/storage/storage.types';

@Injectable({
    providedIn: 'root',
})
export class BackendService {
    BASE_URL = environment.apiUrl;

      private getHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token');
        return new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: token ? token : '',
        });
      }

    constructor(private _http: HttpClient) {
        console.log('BackendService initialized with BASE_URL:', this.BASE_URL);
    }

    getDatabases(): Observable<any[]> {
        return this._http.get<any[]>(`${this.BASE_URL}/api/mysql/databases`, { headers: this.getHeaders() });
    }

    getTableInfo(dbName, table): Observable<TableInfo> {
        return this._http.get<TableInfo>(`${this.BASE_URL}/api/mysql/database/${dbName}/${table}/info`, { headers: this.getHeaders() });
    }

    getMultipleTablesInfo(dbName, tables: any[]): Observable<any> {
        const payload = { tables };
        console.log(dbName);
        console.log(tables);
        return this._http.post<MultipleTablesInfo>(`${this.BASE_URL}/api/mysql/database/${dbName}/info`, payload, { headers: this.getHeaders() });
    }

    executeQuery(query: string, dbName: string, page: number = 1, pageSize: number = 10): Observable<any> {
        const payload = { query, page, pageSize };
        return this._http.post<any[]>(`${this.BASE_URL}/api/mysql/database/${dbName}/execute-query`, payload, { headers: this.getHeaders() });
    }

    executeOpenAIPrompt(dbMeta: DbMeta[], databaseName: string, prompt: string) {
        console.log(dbMeta);
        const payload: OpenAIPrompt = { dbMeta, databaseName, prompt };
        return this._http.post<OpenAIPromptResponse>(`${this.BASE_URL}/api/mysql/openai/prompt`, payload, { headers: this.getHeaders() });
    }
}
