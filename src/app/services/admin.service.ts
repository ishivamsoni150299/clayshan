import { Injectable, signal, inject, PLATFORM_ID, REQUEST } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdminService {
  loggedIn = signal<boolean>(false);
  loading = signal<boolean>(true);
  email = signal<string | null>(null);
  private platformId = inject(PLATFORM_ID);

  async refresh() {
    this.loading.set(true);
    try {
      const req: any = (() => { try { return inject(REQUEST as any, { optional: true }); } catch { return undefined; } })();
      let url: string;
      const envBase: string | undefined = (globalThis as any)?.process?.env?.API_BASE_URL;
      if (envBase) {
        url = `${envBase}/api/auth/me`;
      } else if (req) {
        const origin = `${(req.headers['x-forwarded-proto'] as string) || 'http'}://${(req.headers['x-forwarded-host'] as string) || req.headers.host}`;
        url = `${origin}/api/auth/me`;
      } else if (typeof window === 'undefined') {
        const port = (globalThis as any)?.process?.env?.PORT || 4000;
        url = `http://localhost:${port}/api/auth/me`;
      } else {
        url = '/api/auth/me';
      }
      const res = await fetch(url, { cache: 'no-store' as any, headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok) {
        const data = await res.json();
        this.email.set(data?.email || null);
        this.loggedIn.set(!!data?.admin);
      } else {
        this.email.set(null);
        this.loggedIn.set(false);
      }
    } catch {
      this.email.set(null);
      this.loggedIn.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  async loginEmail(email: string, password: string) {
    const base = (typeof window === 'undefined') ? ((globalThis as any)?.process?.env?.API_BASE_URL || '') : '';
    const res = await fetch(`${base || ''}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error((await res.json())?.error || 'Login failed');
    await this.refresh();
  }

  async logout() {
    const base = (typeof window === 'undefined') ? ((globalThis as any)?.process?.env?.API_BASE_URL || '') : '';
    await fetch(`${base || ''}/api/auth/logout`, { method: 'POST' });
    await this.refresh();
  }
}
