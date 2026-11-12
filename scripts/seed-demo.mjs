#!/usr/bin/env node
// Crea (o rehace) el bar de demostración "Candela Brava" por la API de Brindix: marca, carta con fotos
// reales y precios de Bogotá 2026, banners, mesas, equipo y una noche en curso (caja, cuentas, pedidos, música).
//
//   node scripts/seed-demo.mjs --api http://localhost:8080/api --super brindix --super-pass XXX \
//        --images <carpeta con <producto>.jpg, candela-mark.png> --admin-pass XXX --waiter-pass XXX
//
// Las fotos vienen de Wikimedia Commons (ver frontend/public/demo-assets/credits.json).
import fs from 'fs';
import path from 'path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const API = arg('api', 'http://localhost:8080/api');
const SUPER = arg('super', 'brindix');
const SUPER_PASS = arg('super-pass');
const IMAGES = arg('images');
const ADMIN_PASS = arg('admin-pass');
const WAITER_PASS = arg('waiter-pass');
const SLUG = 'candela-brava';
if (!SUPER_PASS || !IMAGES || !ADMIN_PASS || !WAITER_PASS) {
  console.error('Faltan --super-pass, --images, --admin-pass o --waiter-pass');
  process.exit(2);
}

async function call(method, p, body, token) {
  const r = await fetch(API + p, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  const data = t ? JSON.parse(t) : null;
  if (!r.ok) { const e = new Error(`${method} ${p} -> ${r.status} ${t}`); e.status = r.status; e.data = data; throw e; }
  return data;
}
async function upload(file, folder, token) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(path.join(IMAGES, file))], { type: file.endsWith('.png') ? 'image/png' : 'image/jpeg' }), file);
  const r = await fetch(`${API}/admin/uploads?folder=${folder}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
  if (!r.ok) throw new Error(`upload ${file} -> ${r.status} ${await r.text()}`);
  return (await r.json()).url;
}
/** Entra al bar; si la clave es temporal la cambia por la definitiva. */
async function staffLogin(username, temp, final) {
  for (const pass of [final, temp]) {
    if (!pass) continue;
    try {
      const s = await call('POST', '/auth/login', { venue: SLUG, username, password: pass });
      if (s.user.mustChangePassword && pass !== final) {
        await call('POST', '/auth/password', { current: pass, next: final }, s.token);
        return (await call('POST', '/auth/login', { venue: SLUG, username, password: final })).token;
      }
      if (s.user.mustChangePassword) {
        // Clave definitiva marcada como temporal: se pasa por una intermedia para quitar la marca.
        await call('POST', '/auth/password', { current: pass, next: pass + '-x' }, s.token);
        const s2 = await call('POST', '/auth/login', { venue: SLUG, username, password: pass + '-x' });
        await call('POST', '/auth/password', { current: pass + '-x', next: final }, s2.token);
        return (await call('POST', '/auth/login', { venue: SLUG, username, password: final })).token;
      }
      return s.token;
    } catch (e) { if (e.status !== 401) throw e; }
  }
  throw new Error('No pude entrar como ' + username);
}

// ---------------- Datos ----------------
const CATEGORIES = [
  { key: 'cervezas', name: 'Cervezas', art: 'beer' },
  { key: 'licores', name: 'Licores', art: 'spirit' },
  { key: 'cocteles', name: 'Cócteles', art: 'cocktail' },
  { key: 'picar', name: 'Para picar', art: 'food' },
  { key: 'sin', name: 'Sin alcohol', art: 'soft' },
];
// [categoría, nombre, precio, costo, foto, descripción, unidad, existencias (null = sin control), recomendado, etiquetas]
const PRODUCTS = [
  ['cervezas', 'Club Colombia Dorada', 9000, 3600, 'club-dorada', 'Lager dorada, la de siempre en Bogotá. Bien fría.', 'und', 96, true, ''],
  ['cervezas', 'Club Colombia Roja', 9500, 3800, 'club-roja', 'Roja maltosa, con cuerpo y final tostado.', 'und', 48, false, ''],
  ['cervezas', 'Águila', 8000, 3000, 'aguila', 'Lager ligera para la tanda larga.', 'und', 120, false, ''],
  ['cervezas', 'Póker', 8000, 3000, 'poker', 'La del partido. Por canasta sale mejor.', 'und', 120, false, ''],
  ['cervezas', 'Corona', 14000, 6500, 'corona', 'Mexicana, con su limón en el pico.', 'und', 48, false, ''],
  ['cervezas', 'Stella Artois', 14000, 6800, 'stella', 'Lager belga servida en su copa.', 'und', 24, false, ''],
  ['cervezas', 'Michelada Club Colombia', 12000, 4200, 'michelada', 'Limón, sal en el borde y salsas de la casa.', 'und', null, true, 'Martes'],
  ['licores', 'Aguardiente Antioqueño · trago', 14000, 4500, 'aguardiente', 'Sin azúcar, con su rodaja de limón.', 'trago', null, false, ''],
  ['licores', 'Aguardiente Antioqueño · media', 95000, 32000, 'aguardiente', '375 ml para la mesa, con hielo y limones.', 'media', 12, true, ''],
  ['licores', 'Aguardiente Antioqueño · botella', 170000, 60000, 'aguardiente', '750 ml. Incluye hielo, limones y soda.', 'botella', 12, false, ''],
  ['licores', 'Ron Viejo de Caldas · botella', 165000, 58000, 'ron', 'Tradicional 750 ml con hielo, limón y Coca-Cola.', 'botella', 8, false, ''],
  ['licores', 'Old Parr 12 años · trago', 28000, 9000, 'whisky', 'Whisky escocés en las rocas.', 'trago', null, false, ''],
  ['licores', 'Old Parr 12 años · botella', 360000, 150000, 'whisky', '750 ml con hielo y soda.', 'botella', 6, false, ''],
  ['licores', 'Tequila José Cuervo · shot', 18000, 5000, 'tequila', 'Con sal y limón.', 'trago', null, false, ''],
  ['cocteles', 'Mojito', 30000, 8000, 'mojito', 'Ron blanco, hierbabuena, limón y soda.', 'und', null, true, ''],
  ['cocteles', 'Margarita', 32000, 9000, 'margarita', 'Tequila, triple sec y limón, con borde de sal.', 'und', null, false, ''],
  ['cocteles', 'Piña colada', 30000, 8500, 'pina-colada', 'Ron, crema de coco y piña.', 'und', null, false, ''],
  ['cocteles', 'Gin tonic', 34000, 10000, 'gin-tonic', 'Ginebra, tónica, pepino y pimienta rosa.', 'und', null, false, ''],
  ['cocteles', 'Aperol spritz', 36000, 12000, 'aperol', 'Aperol, prosecco y soda con naranja.', 'und', null, false, ''],
  ['cocteles', 'Cuba libre', 26000, 7000, 'cuba-libre', 'Ron Viejo de Caldas, Coca-Cola y limón.', 'und', null, false, ''],
  ['picar', 'Picada de la casa · para 2', 78000, 32000, 'picada', 'Carne, chorizo, morcilla, chicharrón, papa criolla y arepa.', 'und', null, true, 'Para compartir'],
  ['picar', 'Chicharrón con arepa', 32000, 12000, 'chicharron', 'Chicharrón carnudo con arepa de maíz y limón.', 'und', null, false, ''],
  ['picar', 'Empanadas x6', 18000, 6000, 'empanadas', 'De pipián y carne, con ají de la casa.', 'und', null, false, ''],
  ['picar', 'Patacones con hogao', 20000, 6000, 'patacones', 'Plátano verde crocante con hogao y queso costeño.', 'und', null, false, ''],
  ['picar', 'Papas a la francesa', 16000, 4500, 'papas', 'Canasta grande con salsas.', 'und', null, false, ''],
  ['picar', 'Alitas BBQ x8', 34000, 13000, 'alitas', 'Alitas en salsa BBQ con papas.', 'und', null, false, ''],
  ['picar', 'Tabla de quesos y carnes frías', 46000, 19000, 'tabla', 'Quesos, jamón serrano, salami y aceitunas.', 'und', null, false, 'Para compartir'],
  ['sin', 'Limonada de coco', 14000, 4000, 'limonada-coco', 'Limón, leche de coco y hielo frappé.', 'und', null, true, ''],
  ['sin', 'Coca-Cola', 6000, 2500, 'gaseosa', 'Botella de 400 ml con hielo.', 'und', 48, false, ''],
  ['sin', 'Soda de frutos rojos', 12000, 3500, 'soda-frutos', 'Soda con frutos rojos y hierbabuena.', 'und', null, false, ''],
];
const TABLES = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => ['Mesa ' + n, 'Salón', 4]),
  ['Terraza 1', 'Terraza', 6], ['Terraza 2', 'Terraza', 6], ['Terraza 3', 'Terraza', 4],
  ['Barra 1', 'Barra', 2], ['Barra 2', 'Barra', 2],
];

async function main() {
  // 1. Plataforma: crear el bar (o recuperar su administrador si ya existe)
  const p = await call('POST', '/platform/login', { username: SUPER, password: SUPER_PASS });
  if (p.mustChangePassword) throw new Error('El súper administrador debe cambiar su clave antes de correr este script');
  const temp = 'temporal-' + Math.random().toString(36).slice(2, 10);
  let venue = (await call('GET', '/platform/venues', null, p.token)).find(v => v.slug === SLUG);
  if (!venue) {
    venue = await call('POST', '/platform/venues', {
      name: 'Candela Brava', slug: SLUG, contactName: 'Demo Brindix', contactPhone: '',
      adminName: 'Valentina Ríos', adminUsername: 'admin', adminPassword: temp, sampleMenu: false,
    }, p.token);
    console.log('Bar creado:', SLUG);
  } else {
    await call('POST', `/platform/venues/${venue.id}/reset-admin`, { password: temp }, p.token);
    console.log('El bar ya existía: se reinicia la clave del administrador');
  }
  const A = await staffLogin('admin', temp, ADMIN_PASS);

  // 2. Marca y reglas del bar
  const logo = await upload('candela-mark.png', 'logo', A);
  const v = await call('GET', '/admin/venue', null, A);
  await call('PUT', '/admin/venue', {
    name: 'Candela Brava', tagline: 'Bar de barrio en Chapinero · cerveza fría, aguardiente y música a pedido',
    logoUrl: logo, wifiName: 'CandelaBrava', wifiPassword: 'brindemos2026',
    clientOrdersEnabled: true, waiterCanCharge: true, musicEnabled: true, songApproval: false, maxSongsPerTable: 3,
  }, A);
  console.log('Marca lista (logo, Wi-Fi, reglas)', v.slug);

  // 3. Mesas
  const existing = await call('GET', '/admin/tables', null, A);
  let order = 0;
  for (const [name, zone, seats] of TABLES) {
    order++;
    const t = existing.find(x => x.name === name);
    if (t) await call('PUT', `/admin/tables/${t.id}`, { name, zone, seats, sortOrder: order, active: true }, A);
    else await call('POST', '/admin/tables', { name, zone, seats, sortOrder: order, active: true }, A);
  }
  const tables = await call('GET', '/admin/tables', null, A);
  const table = name => tables.find(t => t.name === name);

  // 4. Carta: categorías y productos con foto
  const cats = await call('GET', '/admin/categories', null, A);
  const catId = {};
  let co = 0;
  for (const c of CATEGORIES) {
    co++;
    const found = cats.find(x => x.name === c.name);
    const body = { name: c.name, icon: '', art: c.art, sortOrder: co, active: true };
    catId[c.key] = found ? (await call('PUT', `/admin/categories/${found.id}`, body, A)).id : (await call('POST', '/admin/categories', body, A)).id;
  }
  const have = await call('GET', '/admin/products', null, A);
  const photoUrl = {};
  const prodId = {};
  let po = 0;
  for (const [cat, name, price, cost, img, description, unit, stock, featured, tags] of PRODUCTS) {
    po++;
    photoUrl[img] ??= await upload(img + '.jpg', 'products', A);
    const body = {
      categoryId: catId[cat], name, description, price, cost, imageUrl: photoUrl[img], unit,
      trackStock: stock !== null, minStock: stock !== null ? Math.max(3, Math.round(stock * 0.15)) : 0,
      available: true, featured, tags, sortOrder: po, initialStock: stock ?? null,
    };
    const found = have.find(x => x.name === name);
    prodId[name] = found ? (await call('PUT', `/admin/products/${found.id}`, body, A)).id : (await call('POST', '/admin/products', body, A)).id;
  }
  console.log(`Carta: ${CATEGORIES.length} categorías, ${PRODUCTS.length} productos con foto`);

  // 5. Banners de producto para el TV y la carta
  for (const b of await call('GET', '/admin/banners', null, A)) await call('DELETE', `/admin/banners/${b.id}`, null, A);
  const banners = [
    ['Martes de micheladas', 'Michelada Club Colombia a $ 12.000 toda la noche', photoUrl['michelada'], 'amber', 'Michelada Club Colombia'],
    ['Hora feliz de tequila', '2 shots José Cuervo por $ 30.000 hasta las 10 p. m.', await upload('shots.jpg', 'banners', A), 'neon', 'Tequila José Cuervo · shot'],
    ['Media de Antioqueño y picada', 'Combo para la mesa por $ 160.000', photoUrl['picada'], 'berry', 'Picada de la casa · para 2'],
    ['Pide tu canción', 'Escanea el QR de tu mesa y ponla en la lista', await upload('barra.jpg', 'banners', A), 'amber', null],
  ];
  let bo = 0;
  for (const [title, subtitle, imageUrl, theme, product] of banners) {
    await call('POST', '/admin/banners', { title, subtitle, imageUrl, theme, durationSeconds: 9, sortOrder: ++bo, active: true, startsAt: null, endsAt: null, productId: product ? prodId[product] : null }, A);
  }
  console.log('Banners:', banners.length);

  // 6. Equipo
  const users = await call('GET', '/admin/users', null, A);
  for (const [name, username] of [['Laura Gómez', 'laura'], ['Andrés Pérez', 'andres']]) {
    const u = users.find(x => x.username === username);
    if (u) await call('PUT', `/admin/users/${u.id}`, { name, role: 'WAITER', active: true, password: temp }, A);
    else await call('POST', '/admin/users', { name, username, password: temp, role: 'WAITER' }, A);
  }
  const L = await staffLogin('laura', temp, WAITER_PASS);
  const N = await staffLogin('andres', temp, WAITER_PASS);
  const ids = Object.fromEntries((await call('GET', '/staff/waiters', null, A)).map(w => [w.name, w.id]));
  console.log('Equipo: admin, laura, andres');

  // 7. Una noche en curso
  const cash = await call('GET', '/admin/cash', null, A);
  if (!cash.open) {
    await call('POST', '/admin/cash/open', { openingCash: 200000, note: 'Base del viernes' }, A);
    await call('POST', '/admin/cash/movements', { direction: 'OUT', category: 'RESTOCK', method: 'CASH', amount: 24000, description: 'Hielo y limones' }, A);
  }
  const board = await call('GET', '/staff/board', null, A);
  const free = name => !board.tables.find(t => t.name === name)?.tabId;
  const item = (name, quantity, note) => ({ productId: prodId[name], quantity, note: note ?? null });
  async function tab(name, token, customerName, rounds) {
    if (!free(name)) return null;
    let t = await call('POST', `/staff/tables/${table(name).id}/open`, { customerName }, token);
    for (const r of rounds) {
      t = await call('POST', `/staff/tabs/${t.id}/rounds`, { items: r.items, note: null, assignedTo: null }, token);
      const last = t.rounds[t.rounds.length - 1];
      if (r.deliver) await call('POST', `/staff/rounds/${last.id}/deliver`, {}, token);
    }
    return await call('GET', `/staff/tabs/${t.id}`, null, token);
  }
  const t1 = await tab('Mesa 1', L, 'Amigos de la oficina', [
    { items: [item('Club Colombia Dorada', 6), item('Picada de la casa · para 2', 1)], deliver: true },
    { items: [item('Águila', 6)], deliver: true },
  ]);
  if (t1) await call('POST', `/staff/tabs/${t1.id}/charge`, { roundIds: [t1.rounds[0].id], discount: 0, tip: 7800, method: 'NEQUI', note: null, release: false }, L);
  await tab('Mesa 3', N, 'Cumpleaños de Sofía', [
    { items: [item('Aguardiente Antioqueño · media', 1), item('Coca-Cola', 4)], deliver: true },
    { items: [item('Mojito', 2), item('Empanadas x6', 1)], deliver: false },
  ]);
  await tab('Terraza 1', L, null, [{ items: [item('Margarita', 2), item('Patacones con hogao', 1)], deliver: true }]);
  const tb = await tab('Barra 1', A, null, [{ items: [item('Tequila José Cuervo · shot', 2)], deliver: true }]);
  if (tb) await call('POST', `/staff/tabs/${tb.id}/charge`, { roundIds: tb.rounds.map(r => r.id), discount: 0, tip: 0, method: 'CASH', note: null, release: true }, A);
  await tab('Terraza 2', N, 'Partido Colombia', [{ items: [item('Póker', 12, 'Una canasta, bien frías')], deliver: true }]);
  const m5 = table('Mesa 5');
  if (free('Mesa 5')) {
    await call('POST', `/public/${SLUG}/tables/${m5.code}/orders`, { clientName: 'Camila', note: null, items: [item('Michelada Club Colombia', 2), item('Papas a la francesa', 1)] });
    await call('POST', `/public/${SLUG}/tables/${m5.code}/call?type=WAITER`).catch(() => {});
  }
  const songs = [['Provenza', 'Karol G', 'Mesa 1'], ['La Bicicleta', 'Carlos Vives, Shakira', 'Mesa 3'], ['Tusa', 'Karol G, Nicki Minaj', 'Mesa 3'], ['Me gustas tú', 'Manu Chao', 'Terraza 1']];
  const queue = await call('GET', `/public/${SLUG}/music/queue`).catch(() => null);
  if (!queue || !(queue.upNext?.length || queue.nowPlaying)) {
    for (const [title, artist, tname] of songs) {
      await call('POST', `/public/${SLUG}/tables/${table(tname).code}/songs`, { title, artist, ref: null, albumImage: null, durationMs: 210000, requestedBy: null }).catch(e => console.log('canción:', e.message));
    }
    await call('POST', '/admin/music/next', {}, A).catch(() => {});
  }
  console.log('Noche en curso: caja abierta, 5 mesas, pedido desde el QR en Mesa 5, música en cola');
  console.log('\nCarta del cliente (Mesa 4):', `/${SLUG}/m/${table('Mesa 4').code}`);
  console.log('Pantalla del TV:', `/${SLUG}/pantalla`);
  void ids;
}

main().catch(e => { console.error(e.message); process.exit(1); });
