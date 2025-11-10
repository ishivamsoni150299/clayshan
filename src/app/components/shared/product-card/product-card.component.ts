import { Component, Input, signal, OnDestroy, AfterViewInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ElementRef } from '@angular/core';
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
export class ProductCardComponent implements OnDestroy, AfterViewInit {
  @Input() product!: Product;
  @Input() featured: boolean = false;
  constructor(private cart: CartService, private el: ElementRef<HTMLElement>) {}
  private platformId = inject(PLATFORM_ID);
  qvOpen = signal(false);
  imgLoaded = signal(false);
  qvQty = signal(1);
  // QV gallery state
  qvIndex = signal(0);
  private tsX = 0; private teX = 0; private moved = false;
  private keyHandler?: (e: KeyboardEvent) => void;
  hoverIndex: number = 0; // next image index used for overlay
  private hoverTimer: any;
  // Base layer index (currently shown image beneath the fading overlay)
  baseIndex = signal(0);
  // Overlay visibility flag for crossfade
  overlayVisible = signal(false);
  imageUrl(): string {
    const imgs = (this.product?.images || []).filter(Boolean);
    return imgs.length ? imgs[this.baseIndex()] : 'assets/placeholder.svg';
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
  add(ev: Event) {
    ev.preventDefault(); ev.stopPropagation();
    const p = this.product;
    this.cart.add({ id: p.id || p.slug, name: p.name, price: p.price, currency: p.currency, image: p.images[0] }, 1);
    this.added.set(true);
    try { if (typeof window !== 'undefined' && window.innerWidth <= 800) { this.cart.requestOpenDrawer(); } } catch {}
    setTimeout(() => this.added.set(false), 1800);
  }
  addFromQV() {
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
  qvTouchStart(ev: TouchEvent) { this.tsX = ev.touches?.[0]?.clientX ?? 0; this.teX = this.tsX; this.moved = false; }
  qvTouchMove(ev: TouchEvent) { this.teX = ev.touches?.[0]?.clientX ?? 0; this.moved = true; }
  qvTouchEnd() { const dx = this.teX - this.tsX; const threshold = 40; if (Math.abs(dx) > threshold) { if (dx < 0) this.nextQV(); else this.prevQV(); } this.tsX = this.teX = 0; this.moved = false; }

  ngAfterViewInit(): void {
    // Keep dynamic effect uniform: hover/touch only (no autoplay)
  }

  ngOnDestroy(): void {
    try { document.body.style.overflow = ''; } catch {}
    if (this.keyHandler) try { document.removeEventListener('keydown', this.keyHandler); } catch {}
    // no observers since we removed autoplay-in-view
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
  onCardEnter() {
    const imgs = (this.product?.images || []).filter(Boolean);
    if (imgs.length <= 1) return;
    this.startAuto(900);
  }
  onCardLeave() {
    this.stopAuto();
    this.hoverIndex = 0;
    this.overlayVisible.set(false);
  }

  private startAuto(intervalMs: number = 1200) {
    const imgs = (this.product?.images || []).filter(Boolean);
    if (imgs.length <= 1) return;
    this.stopAuto();
    // Start from the current base index
    let i = this.baseIndex();
    this.hoverTimer = setInterval(() => {
      i = (i + 1) % imgs.length;
      this.crossfadeTo(i);
    }, intervalMs);
  }
  private stopAuto() { try { clearInterval(this.hoverTimer); } catch {} this.hoverTimer = null; }

  // Smooth crossfade to target index using an overlay image.
  private crossfadeTo(targetIndex: number) {
    const imgs = (this.product?.images || []).filter(Boolean);
    if (imgs.length <= 1) return;
    if (targetIndex === this.baseIndex()) return;
    this.hoverIndex = targetIndex; // sets overlay image src
    this.overlayVisible.set(true);
    // After fade, commit the new base and hide overlay
    setTimeout(() => {
      this.baseIndex.set(targetIndex);
      this.overlayVisible.set(false);
    }, 300);
  }
}
