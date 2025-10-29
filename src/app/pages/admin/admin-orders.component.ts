import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';

type OrderRow = {
  id: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  amount: number;
  currency: string;
  email?: string;
  status?: string;
  created_at?: string;
};

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, CurrencyPipe],
  styleUrls: ['./admin-orders.component.scss'],
  templateUrl: './admin-orders.component.html',
})
export class AdminOrdersComponent implements OnInit {
  loading = signal<boolean>(true);
  orders = signal<OrderRow[]>([]);
  error = signal<string>('');

  constructor(public admin: AdminService) {}

  async ngOnInit() {
    await this.admin.refresh();
    if (!this.admin.loggedIn()) { this.loading.set(false); return; }
    try {
      const res = await fetch('/api/admin/orders');
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      this.orders.set(Array.isArray(data) ? data : []);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load orders');
    } finally {
      this.loading.set(false);
    }
  }
}

