import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "@lib/services/auth/auth.service";
import { Observable, map, catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> {
  
    return this.authService.isAuthenticated().pipe(
      map((response: any) => {
        if (response instanceof HttpErrorResponse) {
          if (response.status === 401) {
            this.router.navigate(['/login'], { replaceUrl: true }); // Absolute path with replaceUrl
            return false;
          }
          throw response;
        }

        const isAuthenticated = response && response.authenticated === true;
        if (isAuthenticated) {
          return true;
        } else {
          this.router.navigate(['/login'], { replaceUrl: true }); // Absolute path with replaceUrl
          return false;
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.router.navigate(['/login'], { replaceUrl: true }); // Absolute path with replaceUrl
        return of(false);
      })
    );
  }
}