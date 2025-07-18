import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

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
    const payload = { username, password };
    return this._http.post(`${this.BASE_URL}/api/auth/login`, payload, { headers: this.getHeaders() });
  }

  logout(): Observable<any> {
    return this._http.post(`${this.BASE_URL}/api/auth/logout`, {}, { headers: this.getHeaders() });
  }

  isAuthenticated(): Observable<any> {
    return this._http.get<{ authenticated: boolean }>(`${this.BASE_URL}/api/auth/isAuthenticated`, { headers: this.getHeaders() });
  }
}