import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
  standalone: true,
  selector: 'app-logout',
  imports: [CommonModule],
  template: '<section class="container"><p>Signing you out…</p></section>'
})
export class LogoutComponent implements OnInit {
  private admin = inject(AdminService);
  private router = inject(Router);
  async ngOnInit() {
    try { await this.admin.logout(); } catch {}
    try { await this.router.navigateByUrl('/'); } catch {}
  }
}
