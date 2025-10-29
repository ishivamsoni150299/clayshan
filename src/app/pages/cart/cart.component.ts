import { Component, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent {
  constructor(public cart: CartService, private router: Router) {}
  total = computed(() => this.cart.total());
  noop() {}

  async checkout() {
    const amount = this.total();
    const currency = (this.cart.items()[0]?.currency) || 'INR';
    if (!amount) return;
    try {
      const cfgRes = await fetch('/api/checkout/config');
      if (!cfgRes.ok) throw new Error('Checkout not configured');
      const { keyId } = await cfgRes.json();

      const orderRes = await fetch('/api/checkout/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency })
      });
      if (!orderRes.ok) throw new Error('Failed to create order');
      const { order } = await orderRes.json();

      await this.loadRazorpay();
      const anyWindow: any = window as any;
      const options = {
        key: keyId,
        amount: order.amount,
        currency,
        name: 'Clayshan Jewellery',
        order_id: order.id,
        handler: (_resp: any) => {
          alert('Payment initiated. You can wire success handling now.');
        },
        prefill: {},
        theme: { color: '#d4af37' },
      };
      const rzp = new anyWindow.Razorpay(options);
      rzp.on('payment.success', async (resp: any) => {
        try {
          const verify = await fetch('/api/checkout/verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: order.id,
              razorpay_signature: resp.razorpay_signature,
              amount, currency, items: this.cart.items(),
            })
          });
          const data = await verify.json();
          if (verify.ok && data?.id) {
            this.cart.clear();
            this.router.navigate(['/order/success', data.id]);
          } else {
            alert(data?.error || 'Verification failed');
          }
        } catch (e: any) {
          alert(e?.message || 'Verification error');
        }
      });
      rzp.open();
    } catch (e: any) {
      alert(e?.message || 'Checkout error');
    }
  }

  private loadRazorpay(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).Razorpay) return resolve();
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(s);
    });
  }
}
