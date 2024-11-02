import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class BackendService {
    BASE_URL = environment.apiUrl;

    constructor(private _http: HttpClient) {}

    getDatabases(): Observable<any[]> {
        return this._http.get<any[]>(`${this.BASE_URL}/databases`);
    }

    getDatabaseNames(): Observable<any[]> {
        return this._http.get<any[]>(`${this.BASE_URL}/databaseNames`);
    }

    getTables(dbName: string): Observable<any[]> {
        return this._http.get<any[]>(`${this.BASE_URL}/database/${dbName}/tables`);
    }

    getColumns(dbName: string, tableName: string): Observable<any[]> {
        return this._http.get<any[]>(`${this.BASE_URL}/database/${dbName}/tables/${tableName}/columns`);
    }

    getViews(dbName: string): Observable<any[]> {
        return this._http.get<any[]>(`${this.BASE_URL}/database/${dbName}/views`);
    }

    getProcedures(dbName: string): Observable<any[]> {
        return this._http.get<any[]>(`${this.BASE_URL}/database/${dbName}/procedures`);
    }

    getFunctions(dbName: string): Observable<any[]> {
        return this._http.get<any[]>(`${this.BASE_URL}/database/${dbName}/functions`);
    }

    executeQuery(query: string, dbName: string, page: number = 1, pageSize: number = 10): Observable<any> {
        console.log('calledbackend');
        const payload = { query, page, pageSize };
        return this._http.post<any[]>(`${this.BASE_URL}/database/${dbName}/execute-query`, payload);
    }
}
