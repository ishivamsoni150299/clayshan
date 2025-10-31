import { Component, OnInit, AfterViewInit, OnDestroy, Signal, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductCardComponent } from '../../components/shared/product-card/product-card.component';
import { ProductService } from '../../services/product.service';
import type { Product } from '../../models/product';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { Meta, Title } from '@angular/platform-browser';
import { WHATSAPP_NUMBER, WHATSAPP_DEFAULT_MESSAGE, SITE_NAME } from '../../config';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, ProductCardComponent],
  styleUrls: ['./product-detail.component.scss'],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  product?: Product;
  private platformId = inject(PLATFORM_ID);
  loaded = false; // mark client-side completion
  qty = 1;
  added = false;
  // swipe state
  private touchStartX: number | null = null;
  private touchEndX: number | null = null;
  selectedImage?: string;
  // zoom state (desktop)
  zoom = false;
  origin = '50% 50%';
  webpCandidate(url: string | undefined | null): string {
    if (!url) return '';
    const m = url.match(/\.(jpg|jpeg|png)$/i);
    if (!m) return '';
    return url.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }
  // variants (UI only)
  tone: 'gold' | 'rose' | 'silver' = 'gold';
  size: 'S' | 'M' | 'L' = 'M';
  setTone(t: 'gold'|'rose'|'silver') { this.tone = t; }
  setSize(s: 'S'|'M'|'L') { this.size = s; }
  // share
  copied = false;
  async copyLink() {
    try {
      const href = typeof window !== 'undefined' ? window.location.href : '';
      await navigator.clipboard.writeText(href);
      this.copied = true;
      setTimeout(() => { this.copied = false; this.cdr.detectChanges(); }, 1600);
      this.cdr.detectChanges();
    } catch {}
  }
  prevImage() {
    const imgs = this.images; if (!imgs.length) return;
    const cur = this.selectedImage ? imgs.indexOf(this.selectedImage) : 0;
    const next = (cur - 1 + imgs.length) % imgs.length;
    this.selectedImage = imgs[next];
  }
  nextImage() {
    const imgs = this.images; if (!imgs.length) return;
    const cur = this.selectedImage ? imgs.indexOf(this.selectedImage) : 0;
    const next = (cur + 1) % imgs.length;
    this.selectedImage = imgs[next];
  }
  private get images(): string[] { return (this.product?.images || []).filter(Boolean); }
  private keyListener?: (ev: KeyboardEvent) => void;
  // Fullscreen lightbox (mobile-friendly)
  fsOpen = false;
  fsZoom = 1;
  fsTx = 0; fsTy = 0;
  private fsStartX = 0; private fsStartY = 0; private fsLastX = 0; private fsLastY = 0; private fsMoveX = 0;
  constructor(private route: ActivatedRoute, private productService: ProductService, private cart: CartService, public wishlist: WishlistService, private cdr: ChangeDetectorRef, private meta: Meta, private title: Title) {}
  jsonLdText = '';
  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.product = await this.productService.getBySlug(slug);
    if (!this.product) {
      await this.productService.loadProducts();
      this.product = await this.productService.getBySlug(slug);
    }
    if (this.product) {
      const t = `${this.product.name} • Clayshan Jewellery`;
      this.title.setTitle(t);
      this.meta.updateTag({ name: 'description', content: this.product.description?.slice(0, 160) || 'Modern Indian jewellery' });
      this.meta.updateTag({ property: 'og:title', content: t });
      this.meta.updateTag({ property: 'og:description', content: this.product.description || '' });
      if (this.product.images?.[0]) this.meta.updateTag({ property: 'og:image', content: this.product.images[0] });
      // JSON-LD schema
      const images = (this.product.images || []).filter(Boolean);
      const schema: any = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: this.product.name,
        description: this.product.description || '',
        image: images,
        sku: this.product.id || this.product.slug,
        brand: { '@type': 'Brand', name: 'Clayshan' },
        offers: {
          '@type': 'Offer',
          price: this.product.price,
          priceCurrency: this.product.currency || 'INR',
          availability: 'https://schema.org/InStock'
        }
      };
      try { schema.url = typeof window !== 'undefined' ? window.location.href : undefined; } catch {}
      this.jsonLdText = JSON.stringify(schema);
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
      // Keyboard navigation for gallery
      this.keyListener = (ev: KeyboardEvent) => {
        const imgs = this.images;
        if (!imgs.length) return;
        const cur = this.selectedImage ? imgs.indexOf(this.selectedImage) : 0;
        if (ev.key === 'ArrowRight') {
          const next = (cur + 1) % imgs.length;
          this.selectedImage = imgs[next];
          this.cdr.detectChanges();
        } else if (ev.key === 'ArrowLeft') {
          const next = (cur - 1 + imgs.length) % imgs.length;
          this.selectedImage = imgs[next];
          this.cdr.detectChanges();
        }
      };
      window.addEventListener('keydown', this.keyListener);
    }
  }

  ngAfterViewInit(): void {
    // Defensive: ensure we break out of skeleton state after hydration
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => { this.loaded = true; this.cdr.detectChanges(); }, 0);
    }
  }
  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId) && this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
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
  select(img: string) { this.selectedImage = img; }
  openFs() { this.fsOpen = true; this.fsZoom = 1; this.fsTx = 0; this.fsTy = 0; }
  closeFs() { this.fsOpen = false; this.fsZoom = 1; this.fsTx = 0; this.fsTy = 0; }
  toggleFsZoom() { this.fsZoom = this.fsZoom === 1 ? 2 : 1; if (this.fsZoom === 1) { this.fsTx = 0; this.fsTy = 0; } }
  fsTouchStart(ev: TouchEvent) { this.fsStartX = ev.touches?.[0]?.clientX ?? 0; this.fsStartY = ev.touches?.[0]?.clientY ?? 0; this.fsLastX = this.fsStartX; this.fsLastY = this.fsStartY; this.fsMoveX = 0; }
  fsTouchMove(ev: TouchEvent) {
    const x = ev.touches?.[0]?.clientX ?? 0; const y = ev.touches?.[0]?.clientY ?? 0;
    const dx = x - this.fsLastX; const dy = y - this.fsLastY;
    this.fsLastX = x; this.fsLastY = y; this.fsMoveX += dx;
    if (this.fsZoom > 1) { this.fsTx += dx; this.fsTy += dy; }
  }
  fsTouchEnd() {
    // swipe navigation only when not zoomed
    if (this.fsZoom === 1) {
      const threshold = 40;
      if (this.fsMoveX > threshold) this.prevImage(); else if (this.fsMoveX < -threshold) this.nextImage();
    }
    this.fsMoveX = 0;
  }
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
  // Zoom handlers (desktop hover)
  zoomIn(ev: MouseEvent) { this.zoom = true; this.setOrigin(ev); }
  zoomMove(ev: MouseEvent) { if (!this.zoom) return; this.setOrigin(ev); }
  zoomOut() { this.zoom = false; }
  private setOrigin(ev: MouseEvent) {
    const el = ev.target as HTMLElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * 100;
    const y = ((ev.clientY - r.top) / r.height) * 100;
    this.origin = `${x.toFixed(2)}% ${y.toFixed(2)}%`;
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

  // Touch swipe handlers (mobile gallery)
  onTouchStart(ev: TouchEvent) { this.touchStartX = ev.touches?.[0]?.clientX ?? null; this.touchEndX = null; }
  onTouchMove(ev: TouchEvent) { this.touchEndX = ev.touches?.[0]?.clientX ?? null; }
  onTouchEnd() {
    if (this.touchStartX == null || this.touchEndX == null) return;
    const dx = this.touchEndX - this.touchStartX;
    const threshold = 40; // px
    const imgs = this.images;
    if (!imgs.length) return;
    const cur = this.selectedImage ? imgs.indexOf(this.selectedImage) : 0;
    if (dx > threshold) {
      // swipe right: previous
      const next = (cur - 1 + imgs.length) % imgs.length;
      this.selectedImage = imgs[next];
    } else if (dx < -threshold) {
      const next = (cur + 1) % imgs.length;
      this.selectedImage = imgs[next];
    }
  }
}
