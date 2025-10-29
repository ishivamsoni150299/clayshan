import { Component, computed, signal, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { CartService } from '../../../services/cart.service';
import { WHATSAPP_NUMBER, WHATSAPP_DEFAULT_MESSAGE, SITE_NAME } from '../../../config';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  styleUrls: ['./navbar.component.scss'],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  open = signal(false);
  count = computed(() => this.cart.items().reduce((s, i) => s + i.qty, 0));
  cartOpen = signal(false);
  items = computed(() => this.cart.items());
  total = computed(() => this.cart.total());
  private platformId = inject(PLATFORM_ID);
  toggle() { this.open.update(v => !v); }
  close() { this.open.set(false); }
  toggleCart(ev?: Event) { if (ev) { ev.preventDefault(); ev.stopPropagation(); } this.cartOpen.update(v => !v); }
  closeCart() { this.cartOpen.set(false); }
  remove(id: string) { this.cart.remove(id); }
  imgError(ev: Event) { const el = ev.target as HTMLImageElement; if (el) el.src = 'assets/placeholder.svg'; }
  whUrl(): string {
    try {
      if (typeof window !== 'undefined') {
        const msg = `Hello! I’m browsing ${SITE_NAME}.\n\nPage: ${document?.title || ''}\nLink: ${window.location.href}`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      }
    } catch {}
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
  }
  constructor(public admin: AdminService, public cart: CartService) {
    // Only refresh on the client to avoid SSR fetch
    if (typeof window !== 'undefined') {
      this.admin.refresh();
      // click outside to close mini-cart
      window.addEventListener('click', () => this.closeCart());
    }
  }
}
