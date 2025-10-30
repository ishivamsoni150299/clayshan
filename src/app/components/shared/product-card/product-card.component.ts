import { Component, Input, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { Product } from '../../../models/product';
import { CartService } from '../../../services/cart.service';
import { InViewDirective } from '../../../directives/in-view.directive';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, InViewDirective],
  styleUrls: ['./product-card.component.scss'],
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  @Input() product!: Product;
  constructor(private cart: CartService) {}
  qvOpen = signal(false);
  imgLoaded = signal(false);
  imageUrl(): string {
    return this.product?.images?.[0] || 'assets/placeholder.svg';
  }
  webpCandidate(url: string | undefined | null): string {
    if (!url) return '';
    const m = url.match(/\.(jpg|jpeg|png)$/i);
    if (!m) return '';
    return url.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }
  openQV(ev: Event) {
    ev.preventDefault(); ev.stopPropagation();
    this.qvOpen.set(true);
  }
  closeQV() { this.qvOpen.set(false); }
  onImgLoad() { this.imgLoaded.set(true); }
  add(ev: Event) {
    ev.preventDefault(); ev.stopPropagation();
    const p = this.product;
    this.cart.add({ id: p.id || p.slug, name: p.name, price: p.price, currency: p.currency, image: p.images?.[0] }, 1);
    this.added.set(true);
    try { if (typeof window !== 'undefined' && window.innerWidth <= 800) { this.cart.requestOpenDrawer(); } } catch {}
    setTimeout(() => this.added.set(false), 1800);
  }
  addFromQV() {
    const p = this.product;
    this.cart.add({ id: p.id || p.slug, name: p.name, price: p.price, currency: p.currency, image: p.images?.[0] }, 1);
    this.qvOpen.set(false);
    this.added.set(true);
    try { if (typeof window !== 'undefined' && window.innerWidth <= 800) { this.cart.requestOpenDrawer(); } } catch {}
    setTimeout(() => this.added.set(false), 1800);
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
    this.imgLoaded.set(true);
  }
  added = signal(false);
}
