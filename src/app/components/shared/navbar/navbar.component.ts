import { Component, computed, signal, inject, PLATFORM_ID, effect } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { CartService } from '../../../services/cart.service';
import { WishlistService } from '../../../services/wishlist.service';
import { WHATSAPP_NUMBER, WHATSAPP_DEFAULT_MESSAGE, SITE_NAME, LOGO_URL } from '../../../config';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  styleUrls: ['./navbar.component.scss'],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  logo = LOGO_URL; // wordmark (mobile)
  open = signal(false);
  count = computed(() => this.cart.items().reduce((s, i) => s + i.qty, 0));
  wishlistCount = computed(() => (this.wishlist.ids().size));
  cartOpen = signal(false);
  items = computed(() => this.cart.items());
  total = computed(() => this.cart.total());
  private platformId = inject(PLATFORM_ID);
  // Mobile header scroll state
  compact = signal(false);
  hidden = signal(false);
  // Categories dropdown data
  categories = signal<{ name: string; count: number }[]>([]);
  showCats = signal(false);
  toggle() { this.open.update(v => !v); }
  close() { this.open.set(false); }
  toggleCart(ev?: Event) { if (ev) { ev.preventDefault(); ev.stopPropagation(); } this.cartOpen.update(v => !v); }
  closeCart() { this.cartOpen.set(false); }
  remove(id: string) { this.cart.remove(id); }
  imgError(ev: Event) { const el = ev.target as HTMLImageElement; if (el) el.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='; }
  whUrl(): string {
    try {
      if (typeof window !== 'undefined') {
        const msg = `Hello! I’m browsing ${SITE_NAME}.\n\nPage: ${document?.title || ''}\nLink: ${window.location.href}`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      }
    } catch {}
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
  }
  constructor(public admin: AdminService, public cart: CartService, public wishlist: WishlistService) {
    // Only refresh on the client to avoid SSR fetch
    if (typeof window !== 'undefined') {
      this.admin.refresh();
      // click outside to close mini-cart
      window.addEventListener('click', () => this.closeCart());
      fetch('/api/categories').then(r => r.ok ? r.json() : []).then((cats) => {
        if (Array.isArray(cats)) this.categories.set(cats);
      }).catch(() => {});

      // Scroll-aware header (mobile): hide on scroll down, compact on scroll
      let lastY = window.scrollY;
      let ticking = false;
      const onScroll = () => {
        const y = window.scrollY || 0;
        const dy = y - lastY;
        lastY = y;
        this.compact.set(y > 8);
        // Hide when scrolling down fast and not at top; show when scrolling up
        if (y > 100 && dy > 0) {
          this.hidden.set(true);
        } else if (dy < 0) {
          this.hidden.set(false);
        }
        ticking = false;
      };
      const rafScroll = () => {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
      };
      window.addEventListener('scroll', rafScroll, { passive: true });
    }
    // react to cart drawer open requests
    effect(() => {
      if (this.cart.openDrawer()) {
        this.cartOpen.set(true);
        this.cart.openDrawer.set(false);
      }
    });
  }
}

