import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-my-orders',
  imports: [CommonModule, DatePipe, CurrencyPipe, RouterLink],
  templateUrl: './my-orders.component.html',
  styleUrls: ['./my-orders.component.scss']
})
export class MyOrdersComponent implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);
  orders = signal<any[]>([]);

  async ngOnInit() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const base = (typeof window === 'undefined') ? ((globalThis as any)?.process?.env?.API_BASE_URL || '') : '';
      const res = await fetch(`${base}/api/my/orders`, { cache: 'no-store' as any });
      if (!res.ok) throw new Error((await res.json())?.error || 'Failed to load');
      this.orders.set(await res.json());
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load orders');
    } finally {
      this.loading.set(false);
    }
  }
}

