import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InViewDirective } from '../../../directives/in-view.directive';
import { WHATSAPP_NUMBER, WHATSAPP_DEFAULT_MESSAGE, SITE_NAME } from '../../../config';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, InViewDirective],
  styleUrls: ['./footer.component.scss'],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  whUrl(): string {
    try {
      if (typeof window !== 'undefined') {
        const msg = `Hello! I’m browsing ${SITE_NAME}.\n\nPage: ${document?.title || ''}\nLink: ${window.location.href}`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      }
    } catch {}
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
  }

  toggleCol(ev: any) {
    try {
      const host = ev?.currentTarget as HTMLElement | null;
      const parent = host ? host.closest('.collapsible') : null;
      if (parent) parent.classList.toggle('open');
    } catch {}
  }
}
