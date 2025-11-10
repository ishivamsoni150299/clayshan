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
import { ORDER_CUTOFF_HOUR_LOCAL, FREE_SHIPPING_THRESHOLD_INR } from '../../config';

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
  cutoffText = '';
  stockText = '';
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
  breadcrumbJsonLd = '';
  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.product = await this.productService.getBySlug(slug);
    if (!this.product) {
      await this.productService.loadProducts();
      this.product = await this.productService.getBySlug(slug);
    }
    // load reviews for this product (local)
    this.loadReviews();
    if (this.product) {
      const t = `${this.product.name} • Clayshan Jewellery`;
      this.title.setTitle(t);
      this.meta.updateTag({ name: 'description', content: this.product.description?.slice(0, 160) || 'Modern Indian jewellery' });
      this.meta.updateTag({ property: 'og:title', content: t });
      this.meta.updateTag({ property: 'og:description', content: this.product.description || '' });
      if (this.product.images && this.product.images[0]) this.meta.updateTag({ property: 'og:image', content: this.product.images[0] });
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
      // Low stock cue
      const inv = (this.product as any).inventory as number | null | undefined;
      if (typeof inv === 'number' && inv != null) {
        if (inv <= 0) this.stockText = 'Currently out of stock';
        else if (inv <= 3) this.stockText = `Only ${inv} left — selling fast!`;
        else if (inv <= 10) this.stockText = `${inv} in stock`;
      }
      // Cutoff: order by HH:MM for same‑day dispatch
      this.cutoffText = this.computeCutoffText();
      // Breadcrumbs JSON-LD
      const bctx: any = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
          { '@type': 'ListItem', position: 2, name: 'Collections', item: '/collections' },
          { '@type': 'ListItem', position: 3, name: this.product.name, item: undefined }
        ]
      };
      try { bctx.itemListElement[0].item = (typeof window !== 'undefined') ? window.location.origin + '/' : '/'; } catch {}
      try { bctx.itemListElement[1].item = (typeof window !== 'undefined') ? window.location.origin + '/collections' : '/collections'; } catch {}
      try { bctx.itemListElement[2].item = (typeof window !== 'undefined') ? window.location.href : undefined; } catch {}
      this.breadcrumbJsonLd = JSON.stringify(bctx);
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
    this.cart.add({ id: this.product.id || this.product.slug, name: this.product.name, price: this.product.price, currency: this.product.currency, image: this.product.images[0] }, this.qty || 1);
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

  // Highlights (benefits) for PDP
  get highlights(): string[] {
    const base = [
      '925 Sterling Silver, hypoallergenic',
      'Rhodium-plated: lasting shine',
      'Handcrafted with care',
      'Free shipping across India'
    ];
    const tags = (this.product?.tags || []).map(t => String(t).toLowerCase());
    if (tags.includes('kundan')) base.unshift('Modern Kundan-inspired design');
    if (tags.includes('anklet')) base.unshift('Comfortable daily-wear anklet');
    return Array.from(new Set(base)).slice(0, 6);
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
  private computeCutoffText(): string {
    try {
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setHours(ORDER_CUTOFF_HOUR_LOCAL, 0, 0, 0);
      if (now.getTime() >= cutoff.getTime()) {
        // next business day cutoff (simple +24h)
        cutoff.setDate(cutoff.getDate() + 1);
      }
      const diffMs = cutoff.getTime() - now.getTime();
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      return `Order in ${h}h ${m}m for same‑day dispatch`;
    } catch { return ''; }
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

  // --- Reviews (local, per product) ---
  reviews: { stars: number; text: string; name: string; date: string }[] = [];
  newStars = 5;
  newName = '';
  newText = '';
  get avgStars(): number {
    const r = this.reviews; if (!r.length) return 5;
    return Math.round((r.reduce((a, b) => a + (b.stars || 0), 0) / r.length) * 10) / 10;
  }
  get reviewsKey(): string {
    const id = (this.product?.id || this.product?.slug || 'unknown');
    return 'reviews_' + id;
  }
  loadReviews() {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(this.reviewsKey) : null;
      this.reviews = raw ? JSON.parse(raw) : [];
    } catch { this.reviews = []; }
  }
  private saveReviews() {
    try { if (typeof window !== 'undefined') localStorage.setItem(this.reviewsKey, JSON.stringify(this.reviews)); } catch {}
  }
  selectStars(s: number) { this.newStars = s; }
  addReview(ev?: Event) {
    if (ev) ev.preventDefault();
    const text = (this.newText || '').trim();
    const name = (this.newName || 'Guest').trim();
    const stars = Math.max(1, Math.min(5, this.newStars || 5));
    if (!text) return;
    const date = new Date().toISOString();
    this.reviews.unshift({ stars, text, name, date });
    this.saveReviews();
    this.newText = '';
    this.newName = '';
    this.newStars = 5;
  }
  shareNative() {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share && this.product) {
        (navigator as any).share({
          title: this.product.name,
          text: this.product.description || 'Check this out',
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        });
      }
    } catch {}
  }
}
