import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminService } from '../services/admin.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const admin = inject(AdminService);
  const router = inject(Router);
  try { await admin.refresh(); } catch {}
  if (admin.loggedIn()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

