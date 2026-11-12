import { Routes } from '@angular/router';
import { adminGuard, staffGuard } from './core/auth.service';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./public/home.component').then(m => m.HomeComponent), title: 'Brindix' },
  // Cliente: llega escaneando el QR de su mesa.
  { path: 'm/:code', loadComponent: () => import('./public/table-menu.component').then(m => m.TableMenuComponent), title: 'Carta' },
  // Carta sin mesa (solo para mirar).
  { path: 'carta', loadComponent: () => import('./public/table-menu.component').then(m => m.TableMenuComponent), title: 'Carta' },
  // Pantalla del bar (TV).
  { path: 'pantalla', loadComponent: () => import('./screen/screen.component').then(m => m.ScreenComponent), title: 'Pantalla' },
  { path: 'ingresar', loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent), title: 'Ingresar' },
  {
    path: 'mesero', canActivate: [staffGuard],
    children: [
      { path: '', loadComponent: () => import('./waiter/board.component').then(m => m.BoardComponent), title: 'Mesas' },
      { path: 'cuenta/:id', loadComponent: () => import('./waiter/tab.component').then(m => m.TabComponent), title: 'Cuenta' },
    ],
  },
  {
    path: 'admin', canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      { path: '', loadComponent: () => import('./admin/dashboard.component').then(m => m.DashboardComponent), title: 'Resumen' },
      { path: 'productos', loadComponent: () => import('./admin/products.component').then(m => m.ProductsComponent), title: 'Productos' },
      { path: 'inventario', loadComponent: () => import('./admin/inventory.component').then(m => m.InventoryComponent), title: 'Inventario' },
      { path: 'mesas', loadComponent: () => import('./admin/tables.component').then(m => m.TablesComponent), title: 'Mesas y QR' },
      { path: 'musica', loadComponent: () => import('./admin/music.component').then(m => m.MusicComponent), title: 'Música' },
      { path: 'publicidad', loadComponent: () => import('./admin/banners.component').then(m => m.BannersComponent), title: 'Publicidad' },
      { path: 'ventas', loadComponent: () => import('./admin/sales.component').then(m => m.SalesComponent), title: 'Ventas' },
      { path: 'equipo', loadComponent: () => import('./admin/users.component').then(m => m.UsersComponent), title: 'Equipo' },
      { path: 'ajustes', loadComponent: () => import('./admin/settings.component').then(m => m.SettingsComponent), title: 'Ajustes' },
    ],
  },
  { path: '**', redirectTo: '' },
];
