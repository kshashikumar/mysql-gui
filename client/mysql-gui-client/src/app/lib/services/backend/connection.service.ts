import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
    providedIn: 'root',
})
export class ConnectionService {
    BASE_URL = environment.apiUrl;

    private getHeaders(): HttpHeaders {
        const token = sessionStorage.getItem('token');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            Authorization: token ? token : '',
        });
    }

    constructor(private _http: HttpClient) {
    }

    getConnections(): Observable<{ connections: { id: number, username: string, password: string, host: string, port: number, dbType: string, status?: string }[] }> {
        return this._http.get<{ connections: { id: number, username: string, password: string, host: string, port: number, dbType: string, status?: string }[] }>(`${this.BASE_URL}/api/connections`, { headers: this.getHeaders() });
    }

    saveConnections(connections: { id: number, username: string, password: string, host: string, port: number, dbType: string }[]): Observable<any> {
        return this._http.post(`${this.BASE_URL}/api/connections/save-connections`, { connections }, { headers: this.getHeaders() });
    }

    addConnection(connection: { username: string, password: string, host: string, port: number, dbType: string }): Observable<any> {
        return this._http.post(`${this.BASE_URL}/api/connections/add`, connection, { headers: this.getHeaders() });
    }

    editConnection(id: number, updatedConnection: { username: string, password: string, host: string, port: number, dbType: string }): Observable<any> {
        return this._http.post(`${this.BASE_URL}/api/connections/edit/${id}`, updatedConnection, { headers: this.getHeaders() });
    }

    deleteConnection(id: number): Observable<any> {
        return this._http.delete(`${this.BASE_URL}/api/connections/delete/${id}`, { headers: this.getHeaders() });
    }
}