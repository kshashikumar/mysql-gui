import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  BASE_URL = environment.apiUrl;

  constructor(private _http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? token : '',
    });
  }

  login(username: string, password: string): Observable<any> {
    console.log('AuthService: Attempting to log in with username:', username);
    const payload = { username, password };
    return this._http.post(`${this.BASE_URL}/api/auth/login`, payload, { headers: this.getHeaders() });
  }

  logout(): Observable<any> {
    return this._http.post(`${this.BASE_URL}/api/auth/logout`, {}, { headers: this.getHeaders() });
  }

  isAuthenticated(): Observable<any> {
    console.log('AuthService: Checking authentication status...');
    return this._http.get<{ authenticated: boolean }>(`${this.BASE_URL}/api/auth/isAuthenticated`, { headers: this.getHeaders() });
  }

  getConnections(): Observable<{ connections: { name: string, url: string, status?: string }[] }> {
    return this._http.get<{ connections: { name: string, url: string, status?: string }[] }>(`${this.BASE_URL}/api/mysql/connections`, { headers: this.getHeaders() });
  }

  saveConnections(connections: { name: string, url: string }[]): void {
    localStorage.setItem('dbConnections', JSON.stringify(connections));
  }

  loadConnections(): { name: string, url: string }[] {
    const connections = localStorage.getItem('dbConnections');
    return connections ? JSON.parse(connections) : [];
  }
}
