import { Component, OnInit, AfterViewInit, OnDestroy, signal, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { ProductCardComponent } from '../../components/shared/product-card/product-card.component';
import { FormsModule } from '@angular/forms';
import { SkeletonCardComponent } from '../../components/shared/skeleton-card/skeleton-card.component';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductCardComponent, SkeletonCardComponent],
  styleUrls: ['./collections.component.scss'],
  templateUrl: './collections.component.html',
})
export class CollectionsComponent implements OnInit, AfterViewInit, OnDestroy {
  constructor(public productService: ProductService) {} 
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  query = signal('');
  category = signal<string | null>(null);
  sort = signal<'reco' | 'price_asc' | 'price_desc' | 'name_asc'>('reco');
  min = signal<number | null>(null);
  max = signal<number | null>(null);
  featured = signal(false);
  filtersOpen = signal(false);
  private pinned = ['sb-MLLM_523187510095'];
  isPinned(slug: string | undefined | null): boolean { return !!slug && this.pinned.includes(slug); }
  setCategory(c: string | null) { this.category.set(c); this.pushUrl(); }
  setQuery(q: string) { this.query.set(q); this.pushUrlDebounced(); }
  setSort(s: 'reco'|'price_asc'|'price_desc'|'name_asc') { this.sort.set(s); this.pushUrl(); }
  setMin(v: number | null) { this.min.set(v); this.pushUrlDebounced(); }
  setMax(v: number | null) { this.max.set(v); this.pushUrlDebounced(); }
  setFeatured(v: boolean) { this.featured.set(!!v); this.pushUrl(); }
  clearFilters() { this.query.set(''); this.category.set(null); this.min.set(null); this.max.set(null); this.pushUrl(); }
  openFilters() { this.filtersOpen.set(true); }
  closeFilters() { this.filtersOpen.set(false); }
  hasActive(): boolean { return !!(this.query() || this.category() || this.min() != null || this.max() != null || this.featured()); }
  clearQuery() { this.query.set(''); this.pushUrl(); }
  clearCategory() { this.category.set(null); this.pushUrl(); }
  clearMin() { this.min.set(null); this.pushUrl(); }
  clearMax() { this.max.set(null); this.pushUrl(); }
  clearFeatured() { this.featured.set(false); this.pushUrl(); }
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    const c = this.category();
    const min = this.min();
    const max = this.max();
    let list = (this.productService.products() || []).filter(p => {
      const matchesQ = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      const matchesC = !c || p.category === c;
      const matchesMin = min == null || p.price >= min;
      const matchesMax = max == null || p.price <= max;
      return matchesQ && matchesC && matchesMin && matchesMax;
    });
    if (this.featured()) list = list.filter(p => this.isPinned(p.slug as any));
    const s = this.sort();
    if (s === 'price_asc') list = list.sort((a,b) => a.price - b.price);
    if (s === 'price_desc') list = list.sort((a,b) => b.price - a.price);
    if (s === 'name_asc') list = list.sort((a,b) => a.name.localeCompare(b.name));
    return list;
  });
  categories = computed(() => Array.from(new Set((this.productService.products() || []).map(p => p.category))));
  extentMin = computed(() => { const prices = (this.productService.products() || []).map(p => p.price); return prices.length ? Math.min(...prices) : 0; });
  extentMax = computed(() => { const prices = (this.productService.products() || []).map(p => p.price); return prices.length ? Math.max(...prices) : 20000; });
  visible = signal(12);
  items = computed(() => (this.productService.products() || []).slice(0, this.visible()));
  more() { this.visible.set(this.visible() + 12); }
  reviewAvg = (slug: string | undefined | null) => { const m = this.productService.reviewsSummary(); return slug && m[slug] ? m[slug].avg : null; };
  reviewCount = (slug: string | undefined | null) => { const m = this.productService.reviewsSummary(); return slug && m[slug] ? m[slug].count : null; };
  
  @ViewChild('sentinel', { static: false }) sentinel?: ElementRef<HTMLElement>;
  private io?: IntersectionObserver;
  pulling = signal(false);
  pullY = signal(0);
  refreshing = signal(false);
  private startY = 0;
  angle() { return Math.min(180, this.pullY() * 3); }
  ngOnInit(): void {
    this.fetchServer();
    this.route.queryParamMap.subscribe((m) => {
      this.query.set(m.get('q') || '');
      this.category.set(m.get('category'));
      const s = m.get('sort') as any; if (s) this.sort.set(s);
      const min = m.get('min'); this.min.set(min ? Number(min) : null);
      const max = m.get('max'); this.max.set(max ? Number(max) : null);
      const f = m.get('featured'); this.featured.set(f === '1' || f === 'true');
      this.fetchServer();
    });
  }

  private async fetchServer() {
    await this.productService.loadProducts({
      q: this.query() || undefined,
      category: this.category() || undefined,
      min: this.min(),
      max: this.max(),
      sort: this.sort() === 'reco' ? undefined : this.sort(),
      page: 1, per: 36,
      featured: this.featured() || undefined,
    });
    try {
      const slugs = (this.productService.products() || []).map(p => p.slug).filter(Boolean) as string[];
      await this.productService.loadReviewSummary(slugs.slice(0, 50));
    } catch {}
  }

  ngAfterViewInit(): void {
    // Setup infinite scroll observer on the client only
    if (typeof window === 'undefined') return;
    const el = this.sentinel?.nativeElement;
    if (!el || !('IntersectionObserver' in window)) return;
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          this.more();
        }
      }
    }, { rootMargin: '200px 0px 400px 0px', threshold: 0 });
    this.io.observe(el);
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }

  // Pull-to-refresh handlers
  onTouchStart(ev: TouchEvent) {
    if (typeof window === 'undefined') return;
    if (window.scrollY > 0) return; // only when at top
    this.startY = ev.touches?.[0]?.clientY ?? 0;
    this.pullY.set(0);
    this.pulling.set(true);
  }
  onTouchMove(ev: TouchEvent) {
    if (!this.pulling()) return;
    const y = ev.touches?.[0]?.clientY ?? 0;
    const dy = Math.max(0, y - this.startY);
    // apply resistance to feel natural
    const dist = Math.round(dy * 0.5);
    this.pullY.set(Math.min(140, dist));
  }
  async onTouchEnd() {
    if (!this.pulling()) return;
    const shouldRefresh = this.pullY() > 60;
    this.pulling.set(false);
    if (shouldRefresh) {
      this.refreshing.set(true);
      try { await this.fetchServer(); } catch {}
      this.refreshing.set(false);
    }
    this.pullY.set(0);
  }

  private pushUrl() {
    const qp: any = {};
    if (this.query()) qp.q = this.query();
    if (this.category()) qp.category = this.category();
    if (this.sort() && this.sort() !== 'reco') qp.sort = this.sort();
    if (this.min() != null) qp.min = this.min();
    if (this.max() != null) qp.max = this.max();
    if (this.featured()) qp.featured = 1;
    this.router.navigate([], { relativeTo: this.route, queryParams: qp, queryParamsHandling: '' });
    this.fetchServer();
  }
  private pushUrlTimer: any;
  private pushUrlDebounced() {
    clearTimeout(this.pushUrlTimer);
    this.pushUrlTimer = setTimeout(() => this.pushUrl(), 300);
  }
}





