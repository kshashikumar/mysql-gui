import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@lib/services/auth/auth.service';
import { LogoComponent } from '@lib/components/logo/logo.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, LogoComponent],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly _fb = inject(FormBuilder);
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _cdr = inject(ChangeDetectorRef);

  loginForm!: FormGroup;
  isLoading = false;
  showPassword = false;
  errorMessage = '';

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.loginForm = this._fb.group({
      username: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  getInputClasses(): string {
    return `
      mt-1 appearance-none relative block w-full px-3 py-3 
      border border-gray-300 dark:border-gray-600 
      placeholder-gray-500 dark:placeholder-gray-400 
      text-gray-900 dark:text-white 
      bg-white dark:bg-gray-700
      rounded-lg 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
      focus:z-10 
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-colors duration-200
      text-sm
    `.replace(/\s+/g, ' ').trim();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
    this._cdr.markForCheck();
  }

  onSubmit(): void {
    if (!this.loginForm.valid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this._cdr.markForCheck();

    const { username, password } = this.loginForm.value;

    this._authService.login(username, password).subscribe({
      next: (data) => {
        console.log('Login successful:', data);
        sessionStorage.setItem('token', data.basicToken);
        this.isLoading = false;
        this._cdr.markForCheck();
        this._router.navigate([''], { replaceUrl: true });
      },
      error: (error) => {
        console.error('Login failed:', error);
        this.handleLoginError(error);
        this.isLoading = false;
        this._cdr.markForCheck();
      }
    });
  }

  private handleLoginError(error: any): void {
    // Reset form on error
    this.loginForm.patchValue({ password: '' });
    
    // Set appropriate error message
    if (error.status === 401) {
      this.errorMessage = 'Invalid username or password. Please try again.';
    } else if (error.status === 0) {
      this.errorMessage = 'Unable to connect to server. Please check your connection.';
    } else if (error.status >= 500) {
      this.errorMessage = 'Server error. Please try again later.';
    } else {
      this.errorMessage = 'An error occurred during login. Please try again.';
    }

    // Focus on username field for retry
    setTimeout(() => {
      const usernameField = document.getElementById('username');
      if (usernameField) {
        usernameField.focus();
      }
    }, 100);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
    this._cdr.markForCheck();
  }
}