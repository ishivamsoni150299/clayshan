import { Component, OnInit, AfterViewInit, Signal, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductCardComponent } from '../../components/shared/product-card/product-card.component';
import { ProductService } from '../../services/product.service';
import type { Product } from '../../models/product';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { WHATSAPP_NUMBER, WHATSAPP_DEFAULT_MESSAGE, SITE_NAME } from '../../config';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, ProductCardComponent],
  styleUrls: ['./product-detail.component.scss'],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit, AfterViewInit {
  product?: Product;
  private platformId = inject(PLATFORM_ID);
  loaded = false; // mark client-side completion
  qty = 1;
  added = false;
  constructor(private route: ActivatedRoute, private productService: ProductService, private cart: CartService, public wishlist: WishlistService, private cdr: ChangeDetectorRef) {}
  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.product = await this.productService.getBySlug(slug);
    if (!this.product) {
      await this.productService.loadProducts();
      this.product = await this.productService.getBySlug(slug);
    }
    this.cdr.detectChanges();
    if (isPlatformBrowser(this.platformId)) {
      this.loaded = true; // only flip on the client so SSR doesn't show 'not found'
      try {
        const rv = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        const id = (this.product?.id || this.product?.slug) as string;
        const next = [id, ...rv.filter((x: string) => x !== id)].slice(0, 12);
        localStorage.setItem('recentlyViewed', JSON.stringify(next));
      } catch {}
    }
  }

  ngAfterViewInit(): void {
    // Defensive: ensure we break out of skeleton state after hydration
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => { this.loaded = true; this.cdr.detectChanges(); }, 0);
    }
  }
  addToCart() {
    if (!this.product) return;
    this.cart.add({ id: this.product.id || this.product.slug, name: this.product.name, price: this.product.price, currency: this.product.currency, image: this.product.images?.[0] }, this.qty || 1);
    this.added = true;
    if (typeof window !== 'undefined') {
      setTimeout(() => { this.added = false; }, 2500);
    }
  }
  inc() { this.qty = Math.min(10, (this.qty || 1) + 1); }
  dec() { this.qty = Math.max(1, (this.qty || 1) - 1); }

  // Gallery state
  selectedImage?: string;
  select(img: string) { this.selectedImage = img; }
  onImgError(ev: Event) {
    const el = ev.target as HTMLImageElement;
    if (!el || !el.src) return;
    // If a jpg/jpeg/png is missing, try corresponding .svg once
    const tried = (el as any)._triedSvgFallback;
    if (tried) return;
    const next = el.src.replace(/\.[^.]+$/, '.svg');
    (el as any)._triedSvgFallback = true;
    el.src = next;
  }

  // Derived list for related products
  get related(): Product[] {
    const list = (this.productService.products() || []) as Product[];
    return list.filter(p => p.slug !== this.product?.slug && p.category === this.product?.category).slice(0, 8);
  }

  // Pincode estimate (mock)
  pin = '';
  eta?: string;
  checkPin() {
    const days = 3 + Math.floor(Math.random() * 4);
    const d = new Date(); d.setDate(d.getDate() + days);
    this.eta = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  whatsappProductLink(p: Product): string {
    try {
      if (typeof window !== 'undefined') {
        const msg = `Hello! I’m interested in ${p.name} from ${SITE_NAME}.\nLink: ${window.location.href}`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      }
    } catch {}
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
  }
}
