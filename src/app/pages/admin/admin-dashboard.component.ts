import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';

type Product = {
  id?: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  images: string[];
  description: string;
  category: string;
  tags?: string[];
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  products = signal<Product[]>([]);
  loading = signal<boolean>(true);
  error = signal<string>('');

  // form
  editing: Product | null = null;
  file?: File;

  constructor(public admin: AdminService) {}

  async ngOnInit() {
    await this.admin.refresh();
    if (typeof window === 'undefined') return; // avoid server-side fetch
    if (!this.admin.loggedIn()) return;
    this.fetch();
  }

  async fetch() {
    this.loading.set(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      this.products.set(data || []);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed to load');
    } finally {
      this.loading.set(false);
    }
  }

  startAdd() {
    this.editing = { name: '', slug: '', price: 0, currency: 'INR', images: [], description: '', category: 'Uncategorized', tags: [] };
  }
  startEdit(p: Product) { this.editing = JSON.parse(JSON.stringify(p)); }
  cancel() { this.editing = null; this.file = undefined; }
  onFile(ev: any) { this.file = ev.target?.files?.[0]; }

  async uploadSelected(): Promise<string | null> {
    if (!this.file) return null;
    const fd = new FormData();
    fd.append('file', this.file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data?.url || null;
  }

  async save() {
    if (!this.editing) return;
    const img = await this.uploadSelected();
    if (img) this.editing.images = [img, ...(this.editing.images || [])];
    const isNew = !this.editing.id;
    const res = await fetch(isNew ? '/api/admin/products' : `/api/admin/products/${this.editing.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.editing),
    });
    if (!res.ok) throw new Error('Save failed');
    this.cancel();
    await this.fetch();
  }

  async remove(p: Product) {
    if (!p.id) return;
    const res = await fetch(`/api/admin/products/${p.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    await this.fetch();
  }

  async rehostImages() {
    const res = await fetch('/api/admin/rehost-images', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Rehost failed');
    await this.fetch();
    if (typeof window !== 'undefined') alert(`Rehosted images for ${data.updated || 0} products`);
  }
}
