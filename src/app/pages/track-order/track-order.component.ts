import { Component, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { WHATSAPP_NUMBER, WHATSAPP_DEFAULT_MESSAGE, SITE_NAME } from '../../config';

@Component({
  selector: 'app-track-order',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe],
  styleUrls: ['./track-order.component.scss'],
  templateUrl: './track-order.component.html',
})
export class TrackOrderComponent {
  id = signal('');
  email = signal('');
  loading = signal(false);
  order = signal<any | null>(null);
  error = signal('');
  steps = ['Placed', 'Processing', 'Shipped', 'Out for delivery', 'Delivered'];

  async track(ev: Event) {
    ev.preventDefault();
    this.error.set('');
    this.order.set(null);
    const id = this.id().trim();
    const email = this.email().trim();
    if (!id || !email) return;
    this.loading.set(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      this.order.set(data);
    } catch (e: any) {
      this.error.set('Order not found. Please verify your Order ID and email.');
    } finally {
      this.loading.set(false);
    }
  }

  currentStep(o: any): number {
    const status = String(o?.status || '').toLowerCase();
    const map: Record<string, number> = {
      created: 0, placed: 0, paid: 1, processing: 1, packed: 1,
      shipped: 2,
      out_for_delivery: 3, "out for delivery": 3, ofd: 3,
      delivered: 4, complete: 4
    };
    if (status in map) return map[status];
    // Fallback: estimate by time since created
    try {
      const t0 = new Date(o.created_at).getTime();
      const hours = (Date.now() - t0) / 36e5;
      if (hours < 6) return 0;
      if (hours < 24) return 1;
      if (hours < 72) return 2;
      if (hours < 120) return 3;
      return 4;
    } catch { return 1; }
  }

  eta(o: any): string | null {
    try {
      const d = new Date(o.created_at);
      const days = 3 + Math.floor(Math.random() * 4);
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return null; }
  }

  helpWhatsApp(): string {
    const msg = `Hello! I want help tracking my order on ${SITE_NAME}.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg || WHATSAPP_DEFAULT_MESSAGE)}`;
  }
}
