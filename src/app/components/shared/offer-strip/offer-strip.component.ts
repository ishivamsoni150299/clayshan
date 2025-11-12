import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FREE_SHIPPING_THRESHOLD_INR } from '../../../config';

@Component({
  selector: 'app-offer-strip',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./offer-strip.component.scss'],
  templateUrl: './offer-strip.component.html',
})
export class OfferStripComponent implements OnInit, OnDestroy {
  idx = signal(0);
  hover = signal(false);
  hidden = signal(false);
  private timer: any;

  readonly threshold = FREE_SHIPPING_THRESHOLD_INR;
  readonly messages: string[] = [
    `Free shipping over \u20B9${this.threshold.toLocaleString('en-IN')}`,
    'Express delivery on prepaid orders',
    'Secure payments via Razorpay',
    '7-day returns • Quality assured',
  ];

  ngOnInit(): void {
    // Client-only: restore hidden/index and start rotation
    if (typeof window !== 'undefined') {
      try {
        const h = localStorage.getItem('offerStripHidden');
        const i = localStorage.getItem('offerStripIdx');
        if (h === '1') this.hidden.set(true);
        if (i) this.idx.set(Math.max(0, Math.min(this.messages.length - 1, parseInt(i, 10) || 0)));
      } catch {}
      this.start();
    }
  }
  ngOnDestroy(): void { this.stop(); }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      if (this.hover()) return;
      this.idx.set((this.idx() + 1) % this.messages.length);
      try { if (typeof window !== 'undefined') localStorage.setItem('offerStripIdx', String(this.idx())); } catch {}
    }, 4000);
  }
  stop() { try { clearInterval(this.timer); } catch {} this.timer = null; }
  onEnter() { this.hover.set(true); }
  onLeave() { this.hover.set(false); }
  close() {
    this.hidden.set(true);
    this.stop();
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('offerStripHidden', '1');
        localStorage.setItem('offerStripIdx', String(this.idx()));
      }
    } catch {}
  }
}

