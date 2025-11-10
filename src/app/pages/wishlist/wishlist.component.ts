import { Component, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../services/wishlist.service';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { ProductCardComponent } from '../../components/shared/product-card/product-card.component';

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
  constructor(public wishlist: WishlistService, public productService: ProductService, public cart: CartService) {}
  async ngOnInit() {
    if (!this.productService.products() || (this.productService.products() || []).length === 0) {
      await this.productService.loadProducts();
    }
  }
  remove(id: string) { this.wishlist.toggle(id); }
  addToCart(id: string) {
    const p = this.products().find(x => (x.id || x.slug) === id);
    if (!p) return;
    this.cart.add({ id: p.id || p.slug, name: p.name, price: p.price, currency: p.currency, image: p.images[0] }, 1);
    try { if (typeof window !== 'undefined' && window.innerWidth <= 800) this.cart.requestOpenDrawer(); } catch {}
  }
}
