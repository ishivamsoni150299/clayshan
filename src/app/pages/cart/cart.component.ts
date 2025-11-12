import { Component, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { FREE_SHIPPING_THRESHOLD_INR } from '../../config';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent {
  constructor(public cart: CartService, private router: Router, private admin: AdminService) {}
  total = computed(() => this.cart.total());
  threshold = FREE_SHIPPING_THRESHOLD_INR;
  freeLeft = computed(() => Math.max(0, this.threshold - this.total()));
  freePct = computed(() => {
    const t = this.threshold; const sum = this.total();
    return Math.max(0, Math.min(100, Math.round((sum / t) * 100)));
  });
  noop() {}

  async checkout() {
    const amount = this.total();
    if (!amount) return;
    try { await this.admin.refresh(); } catch {}
    if (!this.admin.loggedIn()) { this.router.navigate(['/login'], { queryParams: { returnUrl: '/cart' } }); return; }
    this.router.navigate(['/checkout']);
  }
}
