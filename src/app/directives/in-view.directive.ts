import { Directive, ElementRef, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appInView]',
  standalone: true,
})
export class InViewDirective {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    const el = this.host.nativeElement;
    if (!isPlatformBrowser(this.platformId)) {
      // On SSR, ensure element is visible to avoid flicker
      el.classList.add('in-view');
      return;
    }
    if (!('IntersectionObserver' in window)) {
      el.classList.add('in-view');
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add('in-view');
            obs.unobserve(el);
          }
        }
      },
      { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    );
    io.observe(el);
  }
}

