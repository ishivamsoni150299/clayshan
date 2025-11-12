import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
  standalone: true,
  selector: 'app-signup',
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent {
  emailStr: string = '';
  passwordStr: string = '';
  error = signal<string | null>(null);
  info = signal<string | null>(null);
  loading = signal(false);
  admin = inject(AdminService);
  router = inject(Router);

  async submit() {
    this.error.set(null);
    this.info.set(null);
    this.loading.set(true);
    try {
      await this.admin.signupEmail(this.emailStr, this.passwordStr);
      this.info.set('Account created. You can now sign in.');
      setTimeout(() => this.router.navigateByUrl('/login'), 600);
    } catch (e: any) {
      this.error.set(e?.message || 'Signup failed');
    } finally {
      this.loading.set(false);
    }
  }
}

