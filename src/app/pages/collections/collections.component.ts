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
  filtersOpen = signal(false);
  // sticky filter bar helpers
  setCategory(c: string | null) { this.category.set(c); this.pushUrl(); }
  setQuery(q: string) { this.query.set(q); this.pushUrlDebounced(); }
  setSort(s: 'reco'|'price_asc'|'price_desc'|'name_asc') { this.sort.set(s); this.pushUrl(); }
  setMin(v: number | null) { this.min.set(v); this.pushUrlDebounced(); }
  setMax(v: number | null) { this.max.set(v); this.pushUrlDebounced(); }
  clearFilters() { this.query.set(''); this.category.set(null); this.min.set(null); this.max.set(null); this.pushUrl(); }
  openFilters() { this.filtersOpen.set(true); }
  closeFilters() { this.filtersOpen.set(false); }
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
    const s = this.sort();
    if (s === 'price_asc') list = list.sort((a,b) => a.price - b.price);
    if (s === 'price_desc') list = list.sort((a,b) => b.price - a.price);
    if (s === 'name_asc') list = list.sort((a,b) => a.name.localeCompare(b.name));
    return list;
  });
  categories = computed(() => Array.from(new Set((this.productService.products() || []).map(p => p.category))));
  extentMin = computed(() => {
    const prices = (this.productService.products() || []).map(p => p.price);
    return prices.length ? Math.min(...prices) : 0;
  });
  extentMax = computed(() => {
    const prices = (this.productService.products() || []).map(p => p.price);
    return prices.length ? Math.max(...prices) : 20000;
  });
  // Infinite scroll state
  visible = signal(12);
  items = computed(() => this.filtered().slice(0, this.visible()));
  more() { this.visible.set(this.visible() + 12); }
  @ViewChild('sentinel', { static: false }) sentinel?: ElementRef<HTMLElement>;
  private io?: IntersectionObserver;
  ngOnInit(): void {
    this.productService.loadProducts();
    // initialize from URL
    this.route.queryParamMap.subscribe((m) => {
      this.query.set(m.get('q') || '');
      this.category.set(m.get('category'));
      const s = m.get('sort') as any; if (s) this.sort.set(s);
      const min = m.get('min'); this.min.set(min ? Number(min) : null);
      const max = m.get('max'); this.max.set(max ? Number(max) : null);
    });
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

  private pushUrl() {
    const qp: any = {};
    if (this.query()) qp.q = this.query();
    if (this.category()) qp.category = this.category();
    if (this.sort() && this.sort() !== 'reco') qp.sort = this.sort();
    if (this.min() != null) qp.min = this.min();
    if (this.max() != null) qp.max = this.max();
    this.router.navigate([], { relativeTo: this.route, queryParams: qp, queryParamsHandling: '' });
  }
  private pushUrlTimer: any;
  private pushUrlDebounced() {
    clearTimeout(this.pushUrlTimer);
    this.pushUrlTimer = setTimeout(() => this.pushUrl(), 300);
  }
}
