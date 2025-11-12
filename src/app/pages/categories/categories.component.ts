import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type Cat = { name: string; count: number };

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrls: ['./categories.component.scss'],
  templateUrl: './categories.component.html',
})
export class CategoriesComponent implements OnInit {
  loading = signal(true);
  q = signal('');
  cats = signal<Cat[]>([]);
  filtered = computed(() => {
    const q = this.q().toLowerCase().trim();
    const list = this.cats();
    if (!q) return list;
    return list.filter(c => c.name.toLowerCase().includes(q));
  });

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' as any });
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) this.cats.set(data as Cat[]);
    } catch {}
    this.loading.set(false);
  }
}

