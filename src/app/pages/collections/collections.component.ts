import { Component, OnInit, signal, computed, inject } from '@angular/core';
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
export class CollectionsComponent implements OnInit {
  constructor(public productService: ProductService) {}
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  query = signal('');
  category = signal<string | null>(null);
  sort = signal<'reco' | 'price_asc' | 'price_desc' | 'name_asc'>('reco');
  // sticky filter bar helpers
  setCategory(c: string | null) { this.category.set(c); this.pushUrl(); }
  setQuery(q: string) { this.query.set(q); this.pushUrlDebounced(); }
  setSort(s: 'reco'|'price_asc'|'price_desc'|'name_asc') { this.sort.set(s); this.pushUrl(); }
  clearFilters() { this.query.set(''); this.category.set(null); this.pushUrl(); }
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    const c = this.category();
    let list = (this.productService.products() || []).filter(p => {
      const matchesQ = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      const matchesC = !c || p.category === c;
      return matchesQ && matchesC;
    });
    const s = this.sort();
    if (s === 'price_asc') list = list.sort((a,b) => a.price - b.price);
    if (s === 'price_desc') list = list.sort((a,b) => b.price - a.price);
    if (s === 'name_asc') list = list.sort((a,b) => a.name.localeCompare(b.name));
    return list;
  });
  categories = computed(() => Array.from(new Set((this.productService.products() || []).map(p => p.category))));
  ngOnInit(): void {
    this.productService.loadProducts();
    // initialize from URL
    this.route.queryParamMap.subscribe((m) => {
      this.query.set(m.get('q') || '');
      this.category.set(m.get('category'));
    });
  }

  private pushUrl() {
    const qp: any = {};
    if (this.query()) qp.q = this.query();
    if (this.category()) qp.category = this.category();
    this.router.navigate([], { relativeTo: this.route, queryParams: qp, queryParamsHandling: '' });
  }
  private pushUrlTimer: any;
  private pushUrlDebounced() {
    clearTimeout(this.pushUrlTimer);
    this.pushUrlTimer = setTimeout(() => this.pushUrl(), 300);
  }
}
