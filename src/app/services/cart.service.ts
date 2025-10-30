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
  // UI integration: request the cart drawer to open (mobile)
  openDrawer = signal(false);

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

  setQty(id: string, qty: number) {
    const cur = this.items();
    const idx = cur.findIndex((i) => i.id === id);
    if (idx < 0) return;
    if (qty <= 0) { this.remove(id); return; }
    cur[idx] = { ...cur[idx], qty };
    this.items.set([...cur]);
  }

  inc(id: string) {
    const it = this.items().find(i => i.id === id); if (!it) return;
    this.setQty(id, it.qty + 1);
  }

  dec(id: string) {
    const it = this.items().find(i => i.id === id); if (!it) return;
    this.setQty(id, it.qty - 1);
  }

  remove(id: string) {
    this.items.set(this.items().filter((i) => i.id !== id));
  }

  clear() { this.items.set([]); }

  total(): number { return this.items().reduce((s, i) => s + i.price * i.qty, 0); }

  requestOpenDrawer() {
    this.openDrawer.set(true);
  }
}
