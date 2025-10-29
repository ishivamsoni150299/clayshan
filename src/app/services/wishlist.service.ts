import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  ids = signal<Set<string>>(new Set());

  constructor() {
    try {
      const raw = localStorage.getItem('wishlist');
      if (raw) this.ids.set(new Set(JSON.parse(raw)));
    } catch {}
    effect(() => {
      try { localStorage.setItem('wishlist', JSON.stringify(Array.from(this.ids()))); } catch {}
    });
  }

  has(id: string): boolean { return this.ids().has(id); }
  toggle(id: string) {
    const s = new Set(this.ids());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.ids.set(s);
  }
}

