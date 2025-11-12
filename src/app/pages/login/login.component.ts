import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  emailStr: string = '';
  passwordStr: string = '';
  error = signal<string | null>(null);
  loading = signal(false);
  admin = inject(AdminService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  async onForgot() {
    this.error.set(null);
    if (!this.emailStr) { this.error.set('Enter your email above first'); return; }
    try {
      await this.admin.forgot(this.emailStr);
      this.error.set('If this email exists, a reset link has been sent.');
    } catch (e: any) {
      this.error.set(e?.message || 'Could not send reset link');
    }
  }

  async submit() {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.admin.loginEmail(this.emailStr, this.passwordStr);
      const ret = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
      await this.router.navigateByUrl(ret);
    } catch (e: any) {
      this.error.set(e?.message || 'Login failed');
    } finally {
      this.loading.set(false);
    }
  }
}
