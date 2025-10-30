import { Component, OnInit, signal } from '@angular/core';
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
  ngOnInit(): void {
    this.productService.loadProducts();
    // SEO for landing page
    this.title.setTitle('Clayshan Jewellery â€” Modern Indian Jewellery');
    this.meta.updateTag({ name: 'description', content: 'Handcrafted elegance in modern Indian jewellery â€” shop necklaces, earrings, bracelets, and rings.' });
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
        const msg = `Hello! Iâ€™m browsing ${SITE_NAME}.\n\nPage: ${document?.title || ''}\nLink: ${window.location.href}`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      }
    } catch {}
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
  }
}

