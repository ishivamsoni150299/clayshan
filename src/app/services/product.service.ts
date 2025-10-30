import { Injectable, computed, signal, inject, PLATFORM_ID, REQUEST, TransferState, makeStateKey } from '@angular/core';
import type { Product } from '../models/product';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private _products = signal<Product[] | null>(null);
  status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  products = computed(() => this._products());
  private platformId = inject(PLATFORM_ID);
  private ts: TransferState | undefined = (() => { try { return inject(TransferState, { optional: true }) as TransferState; } catch { return undefined; } })();
  private PRODUCTS_KEY = makeStateKey<Product[]>('TS_PRODUCTS_ALL');

  async loadProducts(): Promise<void> {
    if (Array.isArray(this._products()) && (this._products() as Product[]).length > 0) return;
    // First, try TransferState on the client
    if (typeof window !== 'undefined' && this.ts?.hasKey(this.PRODUCTS_KEY)) {
      const fromState = this.ts.get(this.PRODUCTS_KEY, [] as any);
      this._products.set(fromState);
      this.status.set('ready');
      this.ts.remove(this.PRODUCTS_KEY);
      return;
    }
    this.status.set('loading');
    try {
      const req: any = (() => {
        try { return inject(REQUEST as any, { optional: true }); } catch { return undefined; }
      })();
      let url: string;
      const envBase: string | undefined = (globalThis as any)?.process?.env?.API_BASE_URL;
      if (envBase) {
        url = `${envBase}/api/products`;
      } else if (req) {
        const origin = `${(req.headers['x-forwarded-proto'] as string) || 'http'}://${(req.headers['x-forwarded-host'] as string) || req.headers.host}`;
        url = `${origin}/api/products`;
      } else if (typeof window === 'undefined') {
        const port = (globalThis as any)?.process?.env?.PORT || 4000;
        url = `http://localhost:${port}/api/products`;
      } else {
        url = '/api/products';
      }
      const res = await fetch(url as any, { cache: 'no-store' as any, headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) throw new Error('Failed to load products');
      const data = (await res.json()) as Product[];
      this._products.set(data);
      this.status.set('ready');
      // On the server, seed TransferState so the client hydrates with data
      if (typeof window === 'undefined' && this.ts) {
        this.ts.set(this.PRODUCTS_KEY, data as any);
      }
    } catch (e) {
      console.error(e);
      // Keep as null so future calls attempt reload
      this._products.set(null);
      this.status.set('error');
    }
  }

  async getBySlug(slug: string): Promise<Product | undefined> {
    try {
      const PROD_KEY = makeStateKey<Product>('TS_PRODUCT_' + slug);
      // Client: resolve from TransferState if present
      if (typeof window !== 'undefined' && this.ts?.hasKey(PROD_KEY)) {
        const prod = this.ts.get(PROD_KEY, null as any) as Product | null;
        if (prod) {
          const cur = (this._products() || []) as Product[];
          if (!cur.find((p) => p.slug === prod.slug)) this._products.set([prod, ...cur]);
          this.status.set('ready');
        }
        this.ts.remove(PROD_KEY);
        if (prod) return prod;
      }
      const req: any = (() => {
        try { return inject(REQUEST as any, { optional: true }); } catch { return undefined; }
      })();
      let url: string;
      const envBase: string | undefined = (globalThis as any)?.process?.env?.API_BASE_URL;
      if (envBase) {
        url = `${envBase}/api/products/${slug}`;
      } else if (req) {
        const origin = `${(req.headers['x-forwarded-proto'] as string) || 'http'}://${(req.headers['x-forwarded-host'] as string) || req.headers.host}`;
        url = `${origin}/api/products/${slug}`;
      } else if (typeof window === 'undefined') {
        const port = (globalThis as any)?.process?.env?.PORT || 4000;
        url = `http://localhost:${port}/api/products/${slug}`;
      } else {
        url = `/api/products/${slug}`;
      }
      const res = await fetch(url as any, { cache: 'no-store' as any, headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok && (res as any).status === 304) {
        // Fall back to cached list
        if (!this._products()) {
          await this.loadProducts();
        }
        return this._products()?.find((p) => p.slug === slug);
      }
      if (res.ok) {
        const prod = (await res.json()) as Product;
        // Prime cache
        const cur = (this._products() || []) as Product[];
        if (!cur.find((p) => p.slug === prod.slug)) this._products.set([prod, ...cur]);
        this.status.set('ready');
        if (typeof window === 'undefined' && this.ts) {
          this.ts.set(PROD_KEY, prod as any);
        }
        return prod;
      }
    } catch {}
    if (!this._products() || (Array.isArray(this._products()) && (this._products() as Product[]).length === 0)) {
      await this.loadProducts();
    }
    return this._products()?.find((p) => p.slug === slug);
  }
}
