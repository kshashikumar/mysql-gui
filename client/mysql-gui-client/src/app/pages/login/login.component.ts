import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
export class LoginComponent {
  loginForm?: any;
  isLoading = false;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const username = this.loginForm.get('username').value;
      const password = this.loginForm.get('password').value;

       // Call the authentication service's login method
       this.authService.login(username, password).subscribe({
         next: async (data) => {
            console.log("Login successful:", data);
           // Navigate to the home page upon successful login
           await sessionStorage.setItem('token', data.basicToken);
           this.isLoading = false;
           this.router.navigate(['']);
         },
         error: (err) => {
           // Handle authentication error (show error message, etc.)
           this.loginForm.reset();
           this.isLoading = false;
           //this.router.navigate(['/login']);
          this.router.navigate([''], { replaceUrl: true });
         }
       });
    }
  }
}
