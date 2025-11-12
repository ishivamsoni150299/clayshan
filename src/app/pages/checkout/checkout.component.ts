import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';

@Component({
  standalone: true,
  selector: 'app-checkout',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent {
  constructor(public cart: CartService, private router: Router) {}
  total = computed(() => this.cart.total());
  nameStr: string = ''; emailStr: string = ''; phoneStr: string = '';
  line1Str: string = ''; line2Str: string = ''; cityStr: string = ''; stateStr: string = ''; pincodeStr: string = '';
  loading = signal(false); error = signal<string | null>(null);

  get valid(): boolean {
    return !!(this.nameStr.trim() && this.emailStr.includes('@') && this.phoneStr.trim().length >= 10 && this.line1Str.trim() && this.cityStr.trim() && this.stateStr.trim() && this.pincodeStr.trim().length >= 5);
  }

  async pay() {
    this.error.set(null);
    if (!this.valid || !this.total()) return;
    this.loading.set(true);
    const amount = this.total();
    const currency = (this.cart.items()[0]?.currency) || 'INR';
    try {
      const cfgRes = await fetch('/api/checkout/config');
      if (!cfgRes.ok) throw new Error('Checkout not configured');
      const { keyId } = await cfgRes.json();

      const orderRes = await fetch('/api/checkout/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency, shipping: { name: this.nameStr, email: this.emailStr, phone: this.phoneStr, line1: this.line1Str, line2: this.line2Str, city: this.cityStr, state: this.stateStr, pincode: this.pincodeStr } })
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
        prefill: { name: this.nameStr, email: this.emailStr, contact: this.phoneStr },
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
              shipping: { name: this.nameStr, email: this.emailStr, phone: this.phoneStr, line1: this.line1Str, line2: this.line2Str, city: this.cityStr, state: this.stateStr, pincode: this.pincodeStr }
            })
          });
          const data = await verify.json();
          if (verify.ok && data?.id) {
            this.cart.clear();
            this.router.navigate(['/order/success', data.id]);
          } else {
            this.error.set(data?.error || 'Verification failed');
          }
        } catch (e: any) {
          this.error.set(e?.message || 'Verification error');
        }
      });
      rzp.open();
    } catch (e: any) {
      this.error.set(e?.message || 'Checkout error');
    } finally {
      this.loading.set(false);
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
