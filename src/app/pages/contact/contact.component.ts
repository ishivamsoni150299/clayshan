import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./contact.component.scss'],
  templateUrl: './contact.component.html',
})
export class ContactComponent {
  name = '';
  email = '';
  message = '';
  submitted = false;
  sending = false;
  error = '';

  async submit() {
    this.error = '';
    this.sending = true;
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.name, email: this.email, message: this.message }),
      });
      if (!res.ok) throw new Error('Failed to send');
      this.submitted = true;
      this.name = '';
      this.email = '';
      this.message = '';
    } catch (e: any) {
      this.error = e?.message || 'Something went wrong';
    } finally {
      this.sending = false;
    }
  }
}
