import { Injectable, effect, signal } from '@angular/core';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  qty: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  items = signal<CartItem[]>([]);

  constructor() {
    // hydrate
    try {
      const raw = localStorage.getItem('cart');
      if (raw) this.items.set(JSON.parse(raw));
    } catch {}

    effect(() => {
      try {
        localStorage.setItem('cart', JSON.stringify(this.items()));
      } catch {}
    });
  }

  add(item: Omit<CartItem, 'qty'>, qty = 1) {
    const cur = this.items();
    const idx = cur.findIndex((i) => i.id === item.id);
    if (idx >= 0) cur[idx] = { ...cur[idx], qty: cur[idx].qty + qty };
    else cur.push({ ...item, qty });
    this.items.set([...cur]);
  }

  remove(id: string) {
    this.items.set(this.items().filter((i) => i.id !== id));
  }

  clear() { this.items.set([]); }

  total(): number { return this.items().reduce((s, i) => s + i.price * i.qty, 0); }
}

