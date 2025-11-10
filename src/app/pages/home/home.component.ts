import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { ProductCardComponent } from '../../components/shared/product-card/product-card.component';
import { InViewDirective } from '../../directives/in-view.directive';
import { SkeletonCardComponent } from '../../components/shared/skeleton-card/skeleton-card.component';
import { Title, Meta } from '@angular/platform-browser';
import { WHATSAPP_NUMBER, WHATSAPP_DEFAULT_MESSAGE, SITE_NAME } from '../../config';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent, SkeletonCardComponent, InViewDirective],
  styleUrls: ['./home.component.scss'],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  constructor(public productService: ProductService, private title: Title, private meta: Meta) {}
  email = signal('');
  status = signal<'idle'|'sending'|'ok'|'error'>('idle');
  // Category thumbnails fetched on client (SSR-safe fallback to placeholder)
  catThumbs = signal<Record<string, string>>({});
  categories = ['Earrings','Necklaces','Rings','Bracelets','Anklets'];
  // Dismissible notice when supplier returns no data
  hideSupplierNotice = signal(false);
  // Pinned product slugs to feature first
  // Pin a supplier SKU (Silverbene) to feature first in no-DB mode
  private pinned = [
    'sb-MLLM_523187510095',
  ];
  isPinned(slug: string | undefined | null): boolean { return !!slug && this.pinned.includes(slug); }
  recent = computed(() => {
    try {
      if (typeof window === 'undefined') return [] as any[];
      const ids: string[] = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      const products = this.productService.products() || [];
      const map = new Map(products.map(p => [p.id || p.slug, p] as const));
      return ids.map(id => map.get(id)).filter(Boolean).slice(0, 8) as any[];
    } catch { return [] as any[]; }
  });
  // Products sorted with pinned slugs floated to the top
  featuredProducts = computed(() => {
    const list = (this.productService.products() || []).slice();
    if (!list.length) return list;
    const order = new Map(this.pinned.map((s, i) => [s, i] as const));
    list.sort((a: any, b: any) => {
      const as = order.has(a.slug) ? order.get(a.slug)! : Number.POSITIVE_INFINITY;
      const bs = order.has(b.slug) ? order.get(b.slug)! : Number.POSITIVE_INFINITY;
      if (as !== bs) return as - bs;
      const at = a.created_at ? Date.parse(a.created_at) : 0;
      const bt = b.created_at ? Date.parse(b.created_at) : 0;
      return bt - at;
    });
    return list;
  });
  private async ensurePinned() {
    try {
      for (const slug of this.pinned) {
        try { await this.productService.getBySlug(slug); } catch {}
      }
    } catch {}
  }
  ngOnInit(): void {
    this.productService.loadProducts();
    this.ensurePinned().catch(() => {});
    // Fetch dynamic category thumb(s) on client only
    try {
      if (typeof window !== 'undefined') {
        const reqs = [
          ['Earrings','earring'],
          ['Necklaces','necklace'],
          ['Rings','ring'],
          ['Bracelets','bracelet'],
          ['Anklets','anklet']
        ] as const;
        for (const [cat, kw] of reqs) {
          fetch('/api/supplier/thumbnail?keywords=' + encodeURIComponent(kw))
            .then(r => r.ok ? r.json() : { url: null } as any)
            .then((j: any) => { if (j && j.url) this.catThumbs.update(m => ({ ...m, [cat]: j.url })); })
            .catch(() => {});
        }
      }
    } catch {}
    // SEO for landing page
    this.title.setTitle('Clayshan Jewellery - Modern Indian Jewellery');
    this.meta.updateTag({ name: 'description', content: 'Handcrafted elegance in modern Indian jewellery  shop necklaces, earrings, bracelets, rings, and anklets.' });
    // Social preview defaults
    this.meta.updateTag({ property: 'og:site_name', content: 'Clayshan' });
    this.meta.updateTag({ property: 'og:title', content: 'Clayshan  Modern Indian Jewellery' });
    this.meta.updateTag({ property: 'og:description', content: 'Handcrafted elegance in modern Indian jewellery  shop necklaces, earrings, bracelets, rings, and anklets.' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:image', content: '/assets/brand/clayshan-og-1200x630.svg' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: 'Clayshan  Modern Indian Jewellery' });
    this.meta.updateTag({ name: 'twitter:description', content: 'Handcrafted elegance in modern Indian jewellery  shop necklaces, earrings, bracelets, rings, and anklets.' });
    this.meta.updateTag({ name: 'twitter:image', content: '/assets/brand/clayshan-og-1200x630.svg' });
    this.title.setTitle('Clayshan Jewellery  Modern Indian Jewellery');
    this.meta.updateTag({ name: 'description', content: 'Handcrafted elegance in modern Indian jewellery  shop necklaces, earrings, bracelets, and rings.' });
  }
  async subscribe(ev: Event) {
    ev.preventDefault();
    const email = this.email().trim();
    if (!email) return;
    this.status.set('sending');
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Subscriber', email, message: 'Newsletter signup from home page' }) });
      if (!res.ok) throw new Error('Failed');
      this.status.set('ok');
      this.email.set('');
    } catch {
      this.status.set('error');
    }
  }
  whUrl(): string {
    try {
      if (typeof window !== 'undefined') {
        const msg = `Hello! Im browsing ${SITE_NAME}.\n\nPage: ${document?.title || ''}\nLink: ${window.location.href}`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      }
    } catch {}
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
  }

  // One featured item per category
  fromEachCategory = computed(() => {
    const products = this.productService.products() || [];
    const map = new Map<string, any>();
    for (const c of this.categories) {
      const p = products.find(x => (x as any).category === c);
      if (p) map.set(c, p);
    }
    return Array.from(map.entries());
  });
}

