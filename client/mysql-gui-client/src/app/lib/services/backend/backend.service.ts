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
    const dbType = sessionStorage.getItem('dbType') || 'mysql'; // Default to 'mysql' if not set
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-db-type': dbType,
      Authorization: token ? token : '',
    });
  }

  constructor(private _http: HttpClient) {
  }

  getDatabases(): Observable<any[]> {
    return this._http.get<any[]>(`${this.BASE_URL}/api/sql/databases`, { headers: this.getHeaders() });
  }

  getTableInfo(dbName: string, table: string): Observable<TableInfo> {
    return this._http.get<TableInfo>(`${this.BASE_URL}/api/sql/${dbName}/${table}/info`, { headers: this.getHeaders() });
  }

  getMultipleTablesInfo(dbName: string, tables: any[]): Observable<MultipleTablesInfo> {
    const payload = { tables };
    return this._http.post<MultipleTablesInfo>(`${this.BASE_URL}/api/sql/${dbName}/info`, payload, { headers: this.getHeaders() });
  }

  executeQuery(query: string, dbName: string, page: number = 1, pageSize: number = 10): Observable<any> {
    const payload = { query, page, pageSize };
    return this._http.post<any[]>(`${this.BASE_URL}/api/sql/${dbName}/query`, payload, { headers: this.getHeaders() });
  }

  executeOpenAIPrompt(dbMeta: DbMeta[], databaseName: string, prompt: string): Observable<OpenAIPromptResponse> {
    const payload: OpenAIPrompt = { dbMeta, databaseName, prompt };
    return this._http.post<OpenAIPromptResponse>(`${this.BASE_URL}/api/sql/openai/prompt`, payload, { headers: this.getHeaders() });
  }

  connect(connection: { username: string, password: string, host: string, port: number, dbType: string }): Observable<any> {
    sessionStorage.setItem('dbType', connection.dbType);
    return this._http.post(`${this.BASE_URL}/api/sql/connect`, connection, { headers: this.getHeaders() });
  }

  switchDatabase(dbName: string): Observable<any> {
    return this._http.post(`${this.BASE_URL}/api/sql/switch-database`, { dbName }, { headers: this.getHeaders() });
  }
}