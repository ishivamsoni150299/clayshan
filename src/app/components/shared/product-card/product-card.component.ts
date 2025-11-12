import { Component, Input, signal, OnDestroy, AfterViewInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ElementRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import type { Product } from '../../../models/product';
import { CartService } from '../../../services/cart.service';
import { InViewDirective } from '../../../directives/in-view.directive';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, InViewDirective],
  styleUrls: ['./product-card.component.scss'],
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent implements OnDestroy, AfterViewInit {
  @Input() product!: Product;
  @Input() featured: boolean = false;
  @Input() ratingAvg?: number | null;
  @Input() ratingCountExt?: number | null;
  constructor(private cart: CartService, private el: ElementRef<HTMLElement>, private admin: AdminService, private router: Router) {}
  private platformId = inject(PLATFORM_ID);
  qvOpen = signal(false);
  imgLoaded = signal(false);
  qvQty = signal(1);
  // QV gallery state
  qvIndex = signal(0);
  private qvTsX = 0; private qvTeX = 0; private qvMoved = false;
  private keyHandler?: (e: KeyboardEvent) => void;
  // Hover slide state
  slideIndex = signal(0);
  noAnim = signal(false); // disables transition for seamless loop reset
  private hoverTimer: any;
  private slideDurationMs = 450; // keep in sync with CSS
  imageUrl(): string {
    const imgs = (this.product?.images || []).filter(Boolean);
    return imgs[0] || '/assets/brand/brand-fallback.png';
  }
  webpCandidate(url: string | undefined | null): string {
    if (!url) return '';
    const m = url.match(/\.(jpg|jpeg|png)$/i);
    if (!m) return '';
    return url.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }
  openQV(ev: Event) {
    ev.preventDefault(); ev.stopPropagation();
    this.qvQty.set(1);
    this.qvIndex.set(0);
    this.qvOpen.set(true);
    try { document.body.style.overflow = 'hidden'; } catch {}
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeQV();
      if (e.key === 'ArrowRight') this.nextQV();
      if (e.key === 'ArrowLeft') this.prevQV();
    };
    try { document.addEventListener('keydown', this.keyHandler!); } catch {}
  }
  closeQV() {
    this.qvOpen.set(false);
    try { document.body.style.overflow = ''; } catch {}
    if (this.keyHandler) try { document.removeEventListener('keydown', this.keyHandler); } catch {}
  }
  onImgLoad() { this.imgLoaded.set(true); }
  private ensureLoggedIn(): boolean {
    try { this.admin.refresh(); } catch {}
    if (this.admin.loggedIn()) return true;
    try { const ret = this.router.url || '/cart'; this.router.navigate(['/login'], { queryParams: { returnUrl: ret } }); } catch {}
    return false;
  }
  add(ev: Event) {
    ev.preventDefault(); ev.stopPropagation();
    if (!this.ensureLoggedIn()) return;
    const p = this.product;
    this.cart.add({ id: p.id || p.slug, name: p.name, price: p.price, currency: p.currency, image: p.images[0] }, 1);
    this.added.set(true);
    try { if (typeof window !== 'undefined' && window.innerWidth <= 800) { this.cart.requestOpenDrawer(); } } catch {}
    setTimeout(() => this.added.set(false), 1800);
  }
  addFromQV() {
    if (!this.ensureLoggedIn()) return;
    const p = this.product;
    const qty = Math.max(1, Math.min(10, this.qvQty()));
    this.cart.add({ id: p.id || p.slug, name: p.name, price: p.price, currency: p.currency, image: p.images[0] }, qty);
    this.qvOpen.set(false);
    this.added.set(true);
    try { if (typeof window !== 'undefined' && window.innerWidth <= 800) { this.cart.requestOpenDrawer(); } } catch {}
    setTimeout(() => this.added.set(false), 1800);
  }
  incQV() { this.qvQty.set(Math.min(10, this.qvQty() + 1)); }
  decQV() { this.qvQty.set(Math.max(1, this.qvQty() - 1)); }
  images(): string[] { return (this.product?.images || []).filter(Boolean); }
  nextQV() { const imgs = this.images(); if (imgs.length <= 1) return; this.qvIndex.set((this.qvIndex()+1) % imgs.length); }
  prevQV() { const imgs = this.images(); if (imgs.length <= 1) return; this.qvIndex.set((this.qvIndex()-1+imgs.length) % imgs.length); }
  selectQV(i: number) { const imgs = this.images(); if (!imgs.length) return; this.qvIndex.set(Math.max(0, Math.min(imgs.length-1, i))); }
  qvTouchStart(ev: TouchEvent) { this.qvTsX = ev.touches?.[0]?.clientX ?? 0; this.qvTeX = this.qvTsX; this.qvMoved = false; }
  qvTouchMove(ev: TouchEvent) { this.qvTeX = ev.touches?.[0]?.clientX ?? 0; this.qvMoved = true; }
  qvTouchEnd() { const dx = this.qvTeX - this.qvTsX; const threshold = 40; if (Math.abs(dx) > threshold) { if (dx < 0) this.nextQV(); else this.prevQV(); } this.qvTsX = this.qvTeX = 0; this.qvMoved = false; }

  ngAfterViewInit(): void {
    // Keep dynamic effect uniform: hover/touch only (no autoplay)
    // Pause any running hover timers if card leaves viewport
    if (typeof window !== 'undefined' && this.el?.nativeElement) {
      try {
        const io = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) this.stopSlide();
          }
        }, { threshold: 0.1 });
        io.observe(this.el.nativeElement);
        (this as any)._io = io;
      } catch {}
    }
  }

  ngOnDestroy(): void {
    try { document.body.style.overflow = ''; } catch {}
    if (this.keyHandler) try { document.removeEventListener('keydown', this.keyHandler); } catch {}
    try { (this as any)._io?.disconnect?.(); } catch {}
  }
  get rating(): number { return typeof this.ratingAvg === 'number' ? this.ratingAvg : (4 + ((this.product.name.length % 10) / 10)); } // 4.0 - 4.9 mock
  get ratingCount(): number { return typeof this.ratingCountExt === 'number' ? this.ratingCountExt : (20 + (this.product.slug.length * 7) % 180); }
  onImgError(ev: Event) {
    const el = ev.target as HTMLImageElement;
    const imgs = (this.product?.images || []).filter(Boolean);
    // Find current index by src; fallback to slideIndex
    let cur = -1;
    try { if (el && el.src) cur = imgs.findIndex(u => u === el.src); } catch {}
    if (cur < 0) cur = this.slideIndex();
    // Try next available image if current fails
    for (let i = 1; i <= imgs.length; i++) {
      const idx = (cur + i) % (imgs.length || 1);
      if (imgs[idx] && imgs[idx] !== imgs[cur]) {
        this.slideIndex.set(idx);
        if (el) el.src = imgs[idx];
        return;
      }
    }
    // Fallback to placeholder
    if (el) el.src = '/assets/brand/brand-fallback.png';
    this.imgLoaded.set(true);
  }
  added = signal(false);
  onCardEnter() {
    const imgs = (this.product?.images || []).filter(Boolean);
    if (imgs.length <= 1) return;
    this.startSlide(900);
  }
  onCardLeave() {
    this.stopSlide();
    this.slideIndex.set(0);
  }
  private startSlide(intervalMs: number = 1200) {
    const imgs = (this.product?.images || []).filter(Boolean);
    if (imgs.length <= 1) return;
    this.stopSlide();
    this.hoverTimer = setInterval(() => {
      // advance; include a cloned first frame at the end for seamless loop
      const len = imgs.length;
      const next = this.slideIndex() + 1;
      if (next <= len) {
        this.slideIndex.set(next);
      }
      // when we hit the cloned frame (index === len), jump back to 0 without anim
      if (next === len) {
        setTimeout(() => {
          this.noAnim.set(true);
          this.slideIndex.set(0);
          // allow layout to apply then re-enable transition
          setTimeout(() => this.noAnim.set(false), 20);
        }, this.slideDurationMs);
      }
    }, intervalMs);
  }
  private stopSlide() { try { clearInterval(this.hoverTimer); } catch {} this.hoverTimer = null; }

  // Touch swipe (mobile)
  private tsX = 0; private teX = 0;
  onTouchStart(ev: TouchEvent) { this.tsX = ev.touches?.[0]?.clientX ?? 0; this.teX = this.tsX; }
  onTouchMove(ev: TouchEvent) { this.teX = ev.touches?.[0]?.clientX ?? 0; }
  onTouchEnd() {
    const dx = this.teX - this.tsX; const threshold = 40;
    const imgs = (this.product?.images || []).filter(Boolean);
    if (imgs.length <= 1) return;
    if (dx < -threshold) {
      const len = imgs.length;
      const next = Math.min(this.slideIndex() + 1, len);
      this.slideIndex.set(next);
      if (next === len) {
        setTimeout(() => { this.noAnim.set(true); this.slideIndex.set(0); setTimeout(() => this.noAnim.set(false), 20); }, this.slideDurationMs);
      }
    } else if (dx > threshold) {
      // swipe right
      if (this.slideIndex() === 0) {
        // jump to last frame (len-1) without anim
        this.noAnim.set(true);
        const imgsLen = imgs.length;
        this.slideIndex.set(imgsLen - 1);
        setTimeout(() => this.noAnim.set(false), 20);
      } else {
        this.slideIndex.set(Math.max(0, this.slideIndex() - 1));
      }
    }
    this.tsX = this.teX = 0;
  }
}

