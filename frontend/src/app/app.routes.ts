import { Routes } from '@angular/router';
import { adminGuard, passwordGuard, staffGuard } from './core/auth.service';
import { VenueShellComponent } from './core/venue-context';

export const routes: Routes = [
  // Página de ventas de Brindix.
  { path: '', loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent), title: 'Brindix · Software para bares' },
  // Súper administrador: crea y administra bares.
  { path: 'plataforma', loadComponent: () => import('./platform/platform.component').then(m => m.PlatformComponent), title: 'Brindix · Plataforma' },
  {
    // Cada bar vive en /<slug>/...
    path: ':slug',
    component: VenueShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'ingresar' },
      { path: 'ingresar', loadComponent: () => import('./venue/login.component').then(m => m.LoginComponent), title: 'Ingresar' },
      // Primer ingreso: cambiar la clave temporal.
      { path: 'clave', canActivate: [passwordGuard], loadComponent: () => import('./venue/change-password.component').then(m => m.ChangePasswordComponent), title: 'Crea tu contraseña' },
      // Cliente: llega escaneando el QR de su mesa.
      { path: 'm/:code', loadComponent: () => import('./venue/client/table-menu.component').then(m => m.TableMenuComponent), title: 'Carta' },
      // Pantalla del bar (TV). Con ?k=<llave> también reproduce YouTube.
      { path: 'pantalla', loadComponent: () => import('./venue/screen/screen.component').then(m => m.ScreenComponent), title: 'Pantalla' },
      {
        path: 'mesero', canActivate: [staffGuard],
        children: [
          { path: '', loadComponent: () => import('./venue/waiter/board.component').then(m => m.BoardComponent), title: 'Mesas' },
          { path: 'cuenta/:id', loadComponent: () => import('./venue/waiter/tab.component').then(m => m.TabComponent), title: 'Cuenta' },
        ],
      },
      {
        path: 'admin', canActivate: [adminGuard],
        loadComponent: () => import('./venue/admin/admin-shell.component').then(m => m.AdminShellComponent),
        children: [
          { path: '', loadComponent: () => import('./venue/admin/dashboard.component').then(m => m.DashboardComponent), title: 'Resumen' },
          { path: 'caja', loadComponent: () => import('./venue/admin/cash.component').then(m => m.CashComponent), title: 'Caja' },
          { path: 'carta', loadComponent: () => import('./venue/admin/menu-editor.component').then(m => m.MenuEditorComponent), title: 'Carta' },
          { path: 'inventario', loadComponent: () => import('./venue/admin/inventory.component').then(m => m.InventoryComponent), title: 'Inventario' },
          { path: 'mesas', loadComponent: () => import('./venue/admin/tables.component').then(m => m.TablesComponent), title: 'Mesas y QR' },
          { path: 'musica', loadComponent: () => import('./venue/admin/music.component').then(m => m.MusicComponent), title: 'Música' },
          { path: 'publicidad', loadComponent: () => import('./venue/admin/banners.component').then(m => m.BannersComponent), title: 'Publicidad' },
          { path: 'ventas', loadComponent: () => import('./venue/admin/sales.component').then(m => m.SalesComponent), title: 'Ventas' },
          { path: 'equipo', loadComponent: () => import('./venue/admin/users.component').then(m => m.UsersComponent), title: 'Equipo' },
          { path: 'bitacora', loadComponent: () => import('./venue/admin/audit.component').then(m => m.AuditComponent), title: 'Bitácora' },
          { path: 'configuracion', loadComponent: () => import('./venue/admin/settings.component').then(m => m.SettingsComponent), title: 'Configuración' },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
