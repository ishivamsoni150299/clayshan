import { Component, OnInit, AfterViewInit, OnDestroy, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductCardComponent } from '../../components/shared/product-card/product-card.component';
import { ProductService } from '../../services/product.service';
import type { Product } from '../../models/product';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { Meta, Title } from '@angular/platform-browser';
import { AdminService } from '../../services/admin.service';
import { WHATSAPP_NUMBER, WHATSAPP_DEFAULT_MESSAGE, SITE_NAME } from '../../config';
import { ORDER_CUTOFF_HOUR_LOCAL } from '../../config';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, ProductCardComponent],
  styleUrls: ['./product-detail.component.scss'],
  template: `
<nav class="breadcrumbs container">
  <a routerLink="/">Home</a> / <a routerLink="/collections">Collections</a> /
  <span>{{ product?.name || 'Loading…' }}</span>
</nav>

<section class="container" *ngIf="product as p; else pending">
  <div class="layout amazon">
    <!-- Gallery -->
    <div class="gallery">
      <div class="thumbs">
        <button *ngFor="let img of p.images; let i = index" (click)="select(img)" [class.active]="(selectedImage || p.images[0]) === img" aria-label="Image {{i+1}}">
          <img [src]="img" [alt]="p.name + ' ' + (i+1)" (error)="onImgError($event)" width="92" height="92" loading="lazy" decoding="async" />
        </button>
      </div>
      <div class="main" (touchstart)="onTouchStart($event)" (touchmove)="onTouchMove($event)" (touchend)="onTouchEnd()" (click)="openFs()">
        <button class="nav prev" *ngIf="p.images && p.images.length > 1" (click)="prevImage(); $event.stopPropagation()" aria-label="Previous image">‹</button>
        <button class="nav next" *ngIf="p.images && p.images.length > 1" (click)="nextImage(); $event.stopPropagation()" aria-label="Next image">›</button>
        <img [src]="selectedImage || p.images[0]" [alt]="p.name" (error)="onImgError($event)" width="1000" height="1000" decoding="async"
             sizes="(max-width: 900px) 100vw, 50vw"
             (mouseenter)="zoomIn($event)" (mousemove)="zoomMove($event)" (mouseleave)="zoomOut()"
             [style.transform]="zoom ? 'scale(1.6)' : 'scale(1)'" [style.transform-origin]="origin" [class.zoom]="zoom" />
      </div>
    </div>

    <!-- Info (middle column) -->
    <div class="info col-mid">
      <h1>{{ p.name }}</h1>
      <div class="rating"><span class="stars">★★★★★</span> <span class="count">({{ (p.slug.length || 10) * 7 % 180 + 20 }})</span></div>

      <div class="price-block">
        <div class="row">
          <span class="discount" *ngIf="discountPercent()>0">-{{ discountPercent() }}%</span>
          <span class="price">{{ displayPrice() | currency: p.currency }}</span>
        </div>
        <div class="mrp" *ngIf="mrp()>0">M.R.P.: <s>{{ mrp() | currency: p.currency }}</s></div>
        <div class="inc">Inclusive of all taxes</div>
      </div>

      <div class="offers">
        <div class="tile">Cashback Offer<br/><small>Save up to &#8377;1,131</small></div>
        <div class="tile">Bank Offer<br/><small>Save up to &#8377;1,000</small></div>
        <div class="tile">Partner Offer<br/><small>Save up to 18%</small></div>
      </div>

      <div class="selected" *ngIf="variantAttrs.length">
        <span class="lab">Selected:</span>
        <span class="vals"><ng-container *ngFor="let kv of (selectedAttrs | keyvalue); let last = last">{{kv.key}}: {{kv.value}}{{ last ? '' : ', '}}</ng-container></span>
      </div>

      <div class="micro" *ngIf="stockText">{{ stockText }}</div>
      <div class="micro good" *ngIf="cutoffText">{{ cutoffText }}</div>

      <p class="desc">{{ p.description }}</p>

      <ul class="highlights" *ngIf="highlights.length"><li *ngFor="let h of highlights">{{ h }}</li></ul>

      <div class="variants" *ngIf="variantAttrs.length">
        <div class="group" *ngFor="let attr of variantAttrs">
          <div class="label">{{ attr }}</div>
          <div class="chips">
            <button class="chip" *ngFor="let val of (attrValues[attr] || [])" [class.active]="selectedAttrs[attr]===val" (click)="setAttr(attr, val)">{{ val }}</button>
          </div>
        </div>
      </div>

      <div class="policy">
        <span>Free Shipping</span>
        <span>7-day Return</span>
        <span>Quality Assured</span>
      </div>

      <div class="pincode">
        <input placeholder="Check delivery pincode" [(ngModel)]="pin" name="pin" maxlength="6" />
        <button class="btn" (click)="checkPin()">Check</button>
        <span class="eta" *ngIf="eta">Estimated delivery by {{ eta }}</span>
      </div>

      <div class="actions">
        <div class="qty">
          <button class="q" (click)="dec()" aria-label="Decrease quantity">-</button>
          <input [value]="qty" readonly aria-label="Quantity" />
          <button class="q" (click)="inc()" aria-label="Increase quantity">+</button>
        </div>
        <button class="btn primary" (click)="addToCart()">Add to Cart</button>
        <button class="btn wish" type="button" (click)="wishlist.toggle(p.id || p.slug)">{{ wishlist.has(p.id || p.slug) ? 'Wishlisted' : 'Wishlist' }}</button>
        <a class="btn" routerLink="/cart" *ngIf="added">View Cart</a>
        <a class="btn" routerLink="/contact">Enquire</a>
        <a class="btn" target="_blank" rel="noopener" [href]="whatsappProductLink(p)">WhatsApp</a>
        <button class="btn" type="button" (click)="copyLink()">Copy Link</button>
      </div>

      <div class="related" *ngIf="related?.length">
        <h3>Similar pieces</h3>
        <div class="grid"><app-product-card *ngFor="let r of related" [product]="r"></app-product-card></div>
      </div>
    </div>

    <aside class="buy-box">
      <div class="price">{{ displayPrice() | currency: p.currency }}</div>
      <div class="ship">FREE delivery available</div>
      <div class="pin">Deliver to you - India</div>
      <div class="stock" [class.low]="selectedVariantQty()<=2">{{ stockNotice() }}</div>
      <div class="qty-select">
        <label for="qtySel">Qty</label>
        <select id="qtySel" [(ngModel)]="qty" name="qtySel">
          <option *ngFor="let n of [1,2,3,4,5,6,7,8,9,10]" [value]="n">{{ n }}</option>
        </select>
      </div>
      <button class="btn big primary" (click)="addToCart()">Add to Cart</button>
      <button class="btn big buy" (click)="buyNow()">Buy Now</button>
    </aside>
  </div>

</section>

<section class="container reviews" *ngIf="product as p">
  <div class="head">
    <h2>Customer Reviews</h2>
    <div class="summary"><span class="stars">★★★★★</span> <b>{{ avgStars }}</b>/5 · {{ reviews.length }} review{{ reviews.length===1? '' : 's' }}</div>
    <button class="btn" type="button" (click)="shareNative()">Share</button>
  </div>
  <div class="review-list">
    <div class="item" *ngFor="let r of reviews; let i = index">
      <div class="meta">
        <span class="stars" [attr.aria-label]="r.stars + ' stars'">{{ '★★★★★'.slice(0, r.stars) }}</span>
        <span class="name">{{ r.name }}</span>
        <span class="date">{{ r.created_at | date:'mediumDate' }}</span>
      </div>
      <p class="text">{{ r.text }}</p>
    </div>
    <div class="empty" *ngIf="reviews.length===0">Be the first to review this product.</div>
  </div>

  <form class="review-form" (submit)="addReview($event)">
    <label>Rating</label>
    <div class="stars-input">
      <button type="button" *ngFor="let s of [1,2,3,4,5]" (click)="selectStars(s)" [class.active]="newStars>=s" aria-label="{{s}} star">★</button>
    </div>
    <label>Your name (optional)</label>
    <input type="text" [value]="newName" (input)="newName=$any($event.target).value" placeholder="Name"/>
    <label>Your review</label>
    <textarea rows="3" [value]="newText" (input)="newText=$any($event.target).value" placeholder="What did you like?"></textarea>
    <button class="btn primary" type="submit" [disabled]="!newText.trim().length">Submit review</button>
  </form>
</section>

<div class="lightbox" *ngIf="fsOpen" (click)="closeFs()">
  <div class="inner" (click)="$event.stopPropagation()">
    <button class="close" (click)="closeFs()" aria-label="Close">&times;</button>
    <button class="nav prev" *ngIf="product && product.images && product.images.length > 1" (click)="prevImage()" aria-label="Previous">‹</button>
    <button class="nav next" *ngIf="product && product.images && product.images.length > 1" (click)="nextImage()" aria-label="Next">›</button>
    <div class="canvas" (touchstart)="fsTouchStart($event)" (touchmove)="fsTouchMove($event)" (touchend)="fsTouchEnd()" (dblclick)="toggleFsZoom()">
      <img [src]="selectedImage || product?.images?.[0]" [alt]="product?.name || ''" [style.transform]="'translate('+fsTx+'px,'+fsTy+'px) scale('+fsZoom+')'" />
    </div>
    <div class="thumbs">
      <button *ngFor="let img of product?.images || []" (click)="select(img)" [attr.aria-selected]="(selectedImage || product?.images?.[0])===img" [class.active]="(selectedImage || product?.images?.[0])===img">
        <img [src]="img" [alt]="product?.name || ''" />
      </button>
    </div>
  </div>
  </div>

<div class="sticky-bar" *ngIf="product as p">
  <div class="inner">
    <div class="title">{{ p.name }}</div>
    <div class="price">{{ displayPrice() | currency: p.currency }}</div>
    <div class="qty">
      <button class="q" (click)="dec()" aria-label="Decrease quantity">-</button>
      <input [value]="qty" readonly aria-label="Quantity" />
      <button class="q" (click)="inc()" aria-label="Increase quantity">+</button>
    </div>
    <button class="btn primary" (click)="addToCart()">Add to Cart</button>
  </div>
</div>

<ng-template #pending>
  <section class="container"><p>Loading…</p></section>
</ng-template>
`
})
export class ProductDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  product?: Product;
  private platformId = inject(PLATFORM_ID);
  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cart: CartService,
    public wishlist: WishlistService,
    private cdr: ChangeDetectorRef,
    private meta: Meta,
    private title: Title,
    private router: Router,
    private admin: AdminService,
  ) {}

  loaded = false;
  qty = 1;
  added = false;
  cutoffText = '';
  stockText = '';

  // supplier variants (attributes)
  variantAttrs: string[] = [];
  attrValues: Record<string, string[]> = {};
  selectedAttrs: Record<string, string> = {};

  // gallery state
  selectedImage?: string;
  private keyListener?: (ev: KeyboardEvent) => void;

  // zoom (desktop)
  zoom = false;
  origin = '50% 50%';

  // fullscreen viewer
  fsOpen = false;
  fsZoom = 1;
  fsTx = 0; fsTy = 0;
  private fsStartX = 0; private fsStartY = 0; private fsLastX = 0; private fsLastY = 0; private fsMoveX = 0;

  // touch swipe
  private touchStartX: number | null = null;
  private touchEndX: number | null = null;

  private get images(): string[] { return (this.product?.images || []).filter(Boolean); }

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.product = await this.productService.getBySlug(slug);
    if (!this.product) {
      await this.productService.loadProducts();
      this.product = await this.productService.getBySlug(slug);
    }
    if (this.product) {
      this.selectedImage = this.images[0];
      // derive variant attributes and values
      try {
        const vars: any[] = Array.isArray((this.product as any).variants) ? (this.product as any).variants : [];
        const names = new Set<string>();
        const map: Record<string, Set<string>> = {} as any;
        for (const v of vars) {
          const atts: any[] = Array.isArray(v?.attributes) ? v.attributes : [];
          for (const a of atts) {
            const n = String(a?.name || '').trim();
            const val = String(a?.value || '').trim();
            if (!n || !val) continue;
            names.add(n);
            if (!map[n]) map[n] = new Set<string>();
            map[n].add(val);
          }
        }
        this.variantAttrs = Array.from(names);
        const obj: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(map)) obj[k] = Array.from(v as Set<string>);
        this.attrValues = obj;
        for (const n of this.variantAttrs) if (!this.selectedAttrs[n] && this.attrValues[n]?.length) this.selectedAttrs[n] = this.attrValues[n][0];
      } catch {}

      const t = `${this.product.name} - Clayshan Jewellery`;
      this.title.setTitle(t);
      this.meta.updateTag({ name: 'description', content: this.product.description?.slice(0,160) || 'Modern Indian jewellery' });
      this.meta.updateTag({ property: 'og:title', content: t });
      this.meta.updateTag({ property: 'og:description', content: this.product.description || '' });
      if (this.images[0]) this.meta.updateTag({ property: 'og:image', content: this.images[0] });

      // low stock text
      const inv = (this.product as any).inventory as number | null | undefined;
      if (typeof inv === 'number' && inv != null) {
        if (inv <= 0) this.stockText = 'Currently out of stock';
        else if (inv <= 3) this.stockText = `Only ${inv} left — selling fast!`;
        else this.stockText = `${inv} in stock`;
      }
      this.cutoffText = this.computeCutoffText();
    }

    await this.loadReviews();

    if (isPlatformBrowser(this.platformId)) {
      try {
        const rv = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        const id = (this.product?.id || this.product?.slug) as string;
        const next = [id, ...rv.filter((x: string) => x !== id)].slice(0, 12);
        localStorage.setItem('recentlyViewed', JSON.stringify(next));
      } catch {}
      this.keyListener = (ev: KeyboardEvent) => {
        const imgs = this.images; if (!imgs.length) return;
        const cur = this.selectedImage ? imgs.indexOf(this.selectedImage) : 0;
        if (ev.key === 'ArrowRight') { this.selectedImage = imgs[(cur + 1) % imgs.length]; this.cdr.detectChanges(); }
        else if (ev.key === 'ArrowLeft') { this.selectedImage = imgs[(cur - 1 + imgs.length) % imgs.length]; this.cdr.detectChanges(); }
      };
      window.addEventListener('keydown', this.keyListener);
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => { this.loaded = true; this.cdr.detectChanges(); }, 0);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId) && this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
    }
  }

  // actions
  private ensureLoggedIn(): boolean {
    try { this.admin.refresh(); } catch {}
    if (this.admin.loggedIn()) return true;
    try {
      const ret = this.router.url || '/cart';
      this.router.navigate(['/login'], { queryParams: { returnUrl: ret } });
    } catch {}
    return false;
  }

  addToCart() {
    if (!this.product) return;
    if (!this.ensureLoggedIn()) return;
    const id = this.product.id || this.product.slug;
    const name = this.product.name;
    const price = this.displayPrice();
    this.cart.add({ id, name, price, currency: this.product.currency, image: this.images[0] }, this.qty || 1);
    this.added = true;
    if (isPlatformBrowser(this.platformId)) setTimeout(() => this.added = false, 2500);
  }
  buyNow() {
    if (!this.ensureLoggedIn()) return;
    this.addToCart();
    try { this.router.navigate(['/cart']); } catch {}
  }
  inc() { this.qty = Math.min(10, (this.qty || 1) + 1); }
  dec() { this.qty = Math.max(1, (this.qty || 1) - 1); }

  // gallery helpers
  select(img: string) { this.selectedImage = img; }
  prevImage() { const imgs = this.images; if (!imgs.length) return; const cur = this.selectedImage ? imgs.indexOf(this.selectedImage) : 0; this.selectedImage = imgs[(cur - 1 + imgs.length) % imgs.length]; }
  nextImage() { const imgs = this.images; if (!imgs.length) return; const cur = this.selectedImage ? imgs.indexOf(this.selectedImage) : 0; this.selectedImage = imgs[(cur + 1) % imgs.length]; }
  onImgError(ev: Event) {
    const el = ev.target as HTMLImageElement; if (!el) return;
    const imgs = this.images;
    try {
      const cur = this.selectedImage ? imgs.indexOf(this.selectedImage) : -1;
      for (let i = 1; i <= imgs.length; i++) {
        const idx = (cur + i) % (imgs.length || 1);
        if (imgs[idx] && imgs[idx] !== this.selectedImage) {
          this.selectedImage = imgs[idx];
          if (el) el.src = imgs[idx];
          return;
        }
      }
    } catch {}
    // Final branded raster fallback if present, else 1x1 transparent PNG
    const branded = '/assets/brand/brand-fallback.png';
    try { el.src = branded; } catch {}
    if (!el.src || el.src === (this.selectedImage||'')) {
      el.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
    }
  }

  // zoom
  zoomIn(ev: MouseEvent) { this.zoom = true; this.setOrigin(ev); }
  zoomMove(ev: MouseEvent) { if (!this.zoom) return; this.setOrigin(ev); }
  zoomOut() { this.zoom = false; }
  private setOrigin(ev: MouseEvent) { const el = ev.target as HTMLElement; if (!el) return; const r = el.getBoundingClientRect(); const x = ((ev.clientX - r.left) / r.width) * 100; const y = ((ev.clientY - r.top) / r.height) * 100; this.origin = `${x.toFixed(2)}% ${y.toFixed(2)}%`; }

  // fullscreen
  openFs() { this.fsOpen = true; this.fsZoom = 1; this.fsTx = 0; this.fsTy = 0; }
  closeFs() { this.fsOpen = false; this.fsZoom = 1; this.fsTx = 0; this.fsTy = 0; }
  toggleFsZoom() { this.fsZoom = this.fsZoom === 1 ? 2 : 1; if (this.fsZoom === 1) { this.fsTx = 0; this.fsTy = 0; } }
  fsTouchStart(ev: TouchEvent) { this.fsStartX = ev.touches?.[0]?.clientX ?? 0; this.fsStartY = ev.touches?.[0]?.clientY ?? 0; this.fsLastX = this.fsStartX; this.fsLastY = this.fsStartY; this.fsMoveX = 0; }
  fsTouchMove(ev: TouchEvent) { const x = ev.touches?.[0]?.clientX ?? 0; const y = ev.touches?.[0]?.clientY ?? 0; const dx = x - this.fsLastX; const dy = y - this.fsLastY; this.fsLastX = x; this.fsLastY = y; this.fsMoveX += dx; if (this.fsZoom > 1) { this.fsTx += dx; this.fsTy += dy; } }
  fsTouchEnd() { if (this.fsZoom === 1) { const threshold = 40; if (this.fsMoveX > threshold) this.prevImage(); else if (this.fsMoveX < -threshold) this.nextImage(); } this.fsMoveX = 0; }

  // touch swipe (inline main image)
  onTouchStart(ev: TouchEvent) { this.touchStartX = ev.touches?.[0]?.clientX ?? null; this.touchEndX = null; }
  onTouchMove(ev: TouchEvent) { this.touchEndX = ev.touches?.[0]?.clientX ?? null; }
  onTouchEnd() { if (this.touchStartX == null || this.touchEndX == null) return; const dx = this.touchEndX - this.touchStartX; const threshold = 40; const imgs = this.images; if (!imgs.length) return; const cur = this.selectedImage ? imgs.indexOf(this.selectedImage) : 0; if (dx > threshold) this.selectedImage = imgs[(cur - 1 + imgs.length) % imgs.length]; else if (dx < -threshold) this.selectedImage = imgs[(cur + 1) % imgs.length]; }

  displayPrice(): number { return Number((this.product?.price || 0)); }

  mrp(): number { const p = this.displayPrice() || 0; if (!p) return 0; const m = Math.round(p / 0.75); return m < p ? p : m; }
  discountPercent(): number { const p = this.displayPrice() || 0; const m = this.mrp(); if (!p || !m || m <= p) return 0; return Math.max(0, Math.round(((m - p) / m) * 100)); }
  setAttr(name: string, val: string) { this.selectedAttrs[name] = val; this.cdr.detectChanges(); }

  // pincode ETA (mock)
  pin = '';
  eta?: string;
  checkPin() { const days = 3 + Math.floor(Math.random() * 4); const d = new Date(); d.setDate(d.getDate() + days); this.eta = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

  // related products
  get related(): Product[] { const list = (this.productService.products() || []) as Product[]; return list.filter(p => p.slug !== this.product?.slug && p.category === this.product?.category).slice(0, 8); }

  selectedVariantQty(): number { return Number((this.product as any)?.inventory ?? 0) || 0; }
  stockNotice(): string { const inv = this.selectedVariantQty(); if (inv <= 0) return 'Out of stock'; if (inv <= 2) return `Only ${inv} left in stock.`; return 'In stock'; }

  // share
  copied = false;
  async copyLink() { try { const href = typeof window !== 'undefined' ? window.location.href : ''; await navigator.clipboard.writeText(href); this.copied = true; setTimeout(() => { this.copied = false; this.cdr.detectChanges(); }, 1600); this.cdr.detectChanges(); } catch {} }

  // highlights
  get highlights(): string[] {
    const base = [ '925 Sterling Silver, hypoallergenic', 'Rhodium-plated: lasting shine', 'Handcrafted with care', 'Free shipping across India' ];
    const tags = (this.product?.tags || []).map(t => String(t).toLowerCase());
    if (tags.includes('kundan')) base.unshift('Modern Kundan-inspired design');
    if (tags.includes('anklet')) base.unshift('Comfortable daily-wear anklet');
    return Array.from(new Set(base)).slice(0, 6);
  }

  whatsappProductLink(p: Product): string {
    try {
      if (typeof window !== 'undefined') {
        const msg = `Hello! I'm interested in ${p.name} from ${SITE_NAME}.\nLink: ${window.location.href}`;
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
      if (now.getTime() >= cutoff.getTime()) cutoff.setDate(cutoff.getDate() + 1);
      const diffMs = cutoff.getTime() - now.getTime();
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      return `Order in ${h}h ${m}m for same-day dispatch`;
    } catch { return ''; }
  }

  // reviews (real, via API)
  reviews: { stars: number; text: string; name?: string; created_at?: string }[] = [];
  newStars = 5; newName = ''; newText = '';
  get avgStars(): number { const r = this.reviews; if (!r.length) return 0; return Math.round((r.reduce((a,b)=> a + (b.stars||0), 0) / r.length) * 10) / 10; }
  async loadReviews() { const slug = this.product?.slug || ''; if (!slug) { this.reviews = []; return; } try { const resp = await fetch(`/api/reviews/${encodeURIComponent(slug)}`); this.reviews = resp.ok ? await resp.json() : []; } catch { this.reviews = []; } }
  selectStars(s: number) { this.newStars = s; }
  async addReview(ev?: Event) { if (ev) ev.preventDefault(); const text=(this.newText||'').trim(); const name=(this.newName||'Guest').trim(); const stars=Math.max(1,Math.min(5,this.newStars||5)); if(!text||!this.product) return; try{ const resp=await fetch('/api/reviews',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ slug:this.product.slug, stars, text, name }) }); if(resp.ok){ await this.loadReviews(); this.newText=''; this.newName=''; this.newStars=5; this.cdr.detectChanges(); } } catch{} }
  shareNative() { try { if (typeof navigator !== 'undefined' && (navigator as any).share && this.product) { (navigator as any).share({ title: this.product.name, text: this.product.description || 'Check this out', url: typeof window !== 'undefined' ? window.location.href : undefined, }); } } catch {} }
}
