import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'collections',
    loadComponent: () => import('./pages/collections/collections.component').then(m => m.CollectionsComponent),
  },
  {
    path: 'product/:slug',
    loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent),
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent),
  },
  {
    path: 'order/success/:id',
    loadComponent: () => import('./pages/order-success/order-success.component').then(m => m.OrderSuccessComponent),
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/admin/admin-login.component').then(m => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
  },
  {
    path: 'admin/orders',
    loadComponent: () => import('./pages/admin/admin-orders.component').then(m => m.AdminOrdersComponent),
  },
  { path: '**', redirectTo: '' },
];
