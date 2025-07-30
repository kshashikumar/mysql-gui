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
  DatabaseStats,
  ConnectionHealth,
  QueryResult,
  BatchQueryResult,
  QueryAnalysis,
  ConnectionConfig,
  ConfigData,
  SaveResponse
} from '@lib/utils/storage/storage.types';

@Injectable({
  providedIn: 'root',
})
export class BackendService {
  BASE_URL = environment.apiUrl;

  private getHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('token');
    const dbType = sessionStorage.getItem('dbType') || 'mysql2'; // Default to 'mysql2' if not set
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-db-type': dbType,
      Authorization: token ? token : '',
    });
  }

  constructor(private _http: HttpClient) {}

  getConfigData(): Observable<ConfigData> {
    return this._http.get<ConfigData>(
      `${this.BASE_URL}/api/config`,
      { headers: this.getHeaders() }
    );
  }

  updateConfigData(config: ConfigData): Observable<SaveResponse> {
    return this._http.post<SaveResponse>(
      `${this.BASE_URL}/api/config`,
      config,
      { headers: this.getHeaders() }
    );
  }

  // Database Information Methods
  getDatabases(): Observable<{ databases: DatabaseStats[], count: number, retrievedAt: string }> {
    return this._http.get<{ databases: DatabaseStats[], count: number, retrievedAt: string }>(
      `${this.BASE_URL}/api/sql/databases`, 
      { headers: this.getHeaders() }
    );
  }

  getTables(dbName: string): Observable<{ tables: string[], count: number, database: string, retrievedAt: string }> {
    return this._http.get<{ tables: string[], count: number, database: string, retrievedAt: string }>(
      `${this.BASE_URL}/api/sql/${dbName}/tables`, 
      { headers: this.getHeaders() }
    );
  }

  getViews(dbName: string): Observable<{ views: any[], count: number, database: string, retrievedAt: string }> {
    return this._http.get<{ views: any[], count: number, database: string, retrievedAt: string }>(
      `${this.BASE_URL}/api/sql/${dbName}/views`, 
      { headers: this.getHeaders() }
    );
  }

  getProcedures(dbName: string): Observable<{ procedures: any[], count: number, database: string, retrievedAt: string }> {
    return this._http.get<{ procedures: any[], count: number, database: string, retrievedAt: string }>(
      `${this.BASE_URL}/api/sql/${dbName}/procedures`, 
      { headers: this.getHeaders() }
    );
  }

  getTableInfo(dbName: string, table: string): Observable<TableInfo & { retrievedAt: string }> {
    return this._http.get<TableInfo & { retrievedAt: string }>(
      `${this.BASE_URL}/api/sql/${dbName}/${table}/info`, 
      { headers: this.getHeaders() }
    );
  }

  getMultipleTablesInfo(dbName: string, tables: string[]): Observable<MultipleTablesInfo & { count: number, database: string, retrievedAt: string }> {
    const payload = { tables };
    return this._http.post<MultipleTablesInfo & { count: number, database: string, retrievedAt: string }>(
      `${this.BASE_URL}/api/sql/${dbName}/info`, 
      payload, 
      { headers: this.getHeaders() }
    );
  }

  // Query Execution Methods
  executeQuery(
    query: string, 
    dbName: string, 
    options: {
      page?: number;
      pageSize?: number;
      timeout?: number;
    } = {}
  ): Observable<QueryResult> {
    const { page = 1, pageSize = 10, timeout } = options;
    const payload = { query, page, pageSize, timeout };
    return this._http.post<QueryResult>(
      `${this.BASE_URL}/api/sql/${dbName}/query`, 
      payload, 
      { headers: this.getHeaders() }
    );
  }

  executeBatchQueries(
    dbName: string, 
    queries: string[], 
    transaction: boolean = false
  ): Observable<BatchQueryResult> {
    const payload = { queries, transaction };
    return this._http.post<BatchQueryResult>(
      `${this.BASE_URL}/api/sql/${dbName}/batch`, 
      payload, 
      { headers: this.getHeaders() }
    );
  }

  analyzeQuery(query: string): Observable<{ query: string, analysis: QueryAnalysis, analyzedAt: string }> {
    const payload = { query };
    return this._http.post<{ query: string, analysis: QueryAnalysis, analyzedAt: string }>(
      `${this.BASE_URL}/api/sql/analyze-query`, 
      payload, 
      { headers: this.getHeaders() }
    );
  }

  // Connection Management Methods
  connect(connection: ConnectionConfig): Observable<{ 
    message: string, 
    connectionId?: string, 
    timestamp: string, 
    database?: string 
  }> {
    sessionStorage.setItem('dbType', connection.dbType);
    return this._http.post<{ 
      message: string, 
      connectionId?: string, 
      timestamp: string, 
      database?: string 
    }>(
      `${this.BASE_URL}/api/sql/connect`, 
      connection, 
      { headers: this.getHeaders() }
    );
  }

  switchDatabase(dbName: string): Observable<{ 
    message: string, 
    database: string, 
    timestamp: string 
  }> {
    return this._http.post<{ 
      message: string, 
      database: string, 
      timestamp: string 
    }>(
      `${this.BASE_URL}/api/sql/switch-database`, 
      { dbName }, 
      { headers: this.getHeaders() }
    );
  }

  getConnectionHealth(): Observable<ConnectionHealth> {
    return this._http.get<ConnectionHealth>(
      `${this.BASE_URL}/api/sql/health`, 
      { headers: this.getHeaders() }
    );
  }

  // AI Integration Methods
  executeOpenAIPrompt(
    dbMeta: DbMeta[], 
    databaseName: string, 
    prompt: string
  ): Observable<OpenAIPromptResponse> {
    const payload: OpenAIPrompt = { dbMeta, databaseName, prompt };
    return this._http.post<OpenAIPromptResponse>(
      `${this.BASE_URL}/api/openai/prompt`, 
      payload, 
      { headers: this.getHeaders() }
    );
  }

  // Utility Methods
  setDatabaseType(dbType: string): void {
    sessionStorage.setItem('dbType', dbType);
  }

  getDatabaseType(): string {
    return sessionStorage.getItem('dbType') || 'mysql2';
  }

  clearDatabaseType(): void {
    sessionStorage.removeItem('dbType');
  }

  // Helper method to update headers after dbType change
  private updateHeaders(): void {
    // This will be called automatically by getHeaders() method
  }
}