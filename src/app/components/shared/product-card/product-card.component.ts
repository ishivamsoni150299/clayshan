import { Component, Input } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { Product } from '../../../models/product';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  styleUrls: ['./product-card.component.scss'],
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  @Input() product!: Product;
  constructor(private cart: CartService) {}
  add(ev: Event) {
    ev.preventDefault(); ev.stopPropagation();
    const p = this.product;
    this.cart.add({ id: p.id || p.slug, name: p.name, price: p.price, currency: p.currency, image: p.images?.[0] }, 1);
  }
  get rating(): number { return 4 + ((this.product.name.length % 10) / 10); } // 4.0 - 4.9 mock
  get ratingCount(): number { return 20 + (this.product.slug.length * 7) % 180; }
  onImgError(ev: Event) {
    const el = ev.target as HTMLImageElement;
    const src = this.product?.images?.[0] || '';
    if (!el || !src) { if (el) el.src = 'assets/placeholder.svg'; return; }
    const tried = (el as any)._triedSvgFallback;
    if (tried) { el.src = 'assets/placeholder.svg'; return; }
    (el as any)._triedSvgFallback = true;
    el.src = src.replace(/\.[^.]+$/, '.svg');
  }
}
