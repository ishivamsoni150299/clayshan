import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// RouterLink not used in this view; removing
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss'],
})
export class AdminLoginComponent {
  email = '';
  password = '';
  error = '';
  sending = false;
  constructor(public admin: AdminService) {}

  async submit() {
    this.error = '';
    this.sending = true;
    try {
      await this.admin.loginEmail(this.email, this.password);
    } catch (e: any) {
      this.error = e?.message || 'Login failed';
    } finally {
      this.sending = false;
    }
  }
}
