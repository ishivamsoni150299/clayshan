import { Component, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { WishlistService } from '../../services/wishlist.service';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { ProductCardComponent } from '../../components/shared/product-card/product-card.component';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  styleUrls: ['./wishlist.component.scss'],
  templateUrl: './wishlist.component.html',
})
export class WishlistComponent implements OnInit {
  products = computed(() => {
    const ids = this.wishlist.ids();
    const all = (this.productService.products() || []);
    return all.filter(p => ids.has(p.id || p.slug));
  });
  constructor(public wishlist: WishlistService, public productService: ProductService, public cart: CartService, private admin: AdminService, private router: Router) {}
  async ngOnInit() {
    if (!this.productService.products() || (this.productService.products() || []).length === 0) {
      await this.productService.loadProducts();
    }
  }
  remove(id: string) { this.wishlist.toggle(id); }
  private ensureLoggedIn(): boolean {
    try { this.admin.refresh(); } catch {}
    if (this.admin.loggedIn()) return true;
    try { const ret = this.router.url || '/cart'; this.router.navigate(['/login'], { queryParams: { returnUrl: ret } }); } catch {}
    return false;
  }
  addToCart(id: string) {
    if (!this.ensureLoggedIn()) return;
    const p = this.products().find(x => (x.id || x.slug) === id);
    if (!p) return;
    this.cart.add({ id: p.id || p.slug, name: p.name, price: p.price, currency: p.currency, image: p.images[0] }, 1);
    try { if (typeof window !== 'undefined' && window.innerWidth <= 800) this.cart.requestOpenDrawer(); } catch {}
  }
}
