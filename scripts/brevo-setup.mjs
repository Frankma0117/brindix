// Diagnóstico y configuración de Brevo para cania.app (lo corre scripts/brevo-setup.sh dentro de Docker).
// Variables: BREVO_API_KEY (obligatoria), HOSTINGER_TOKEN (opcional, para crear los registros DNS solo),
//            DOMAIN (cania.app), TO (correo de prueba), FROM (remitente deseado).
const KEY = process.env.BREVO_API_KEY;
const HOST_TOKEN = process.env.HOSTINGER_TOKEN || '';
const DOMAIN = process.env.DOMAIN || 'cania.app';
const TO = process.env.TO || '';
const FROM = process.env.FROM || `no-responder@${DOMAIN}`;
const out = (...a) => console.log(...a);

async function brevo(method, path, body) {
  const r = await fetch('https://api.brevo.com/v3' + path, {
    method, headers: { 'api-key': KEY, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { ok: r.ok, status: r.status, data };
}

async function main() {
  if (!KEY) { out('Falta la API key de Brevo'); process.exit(2); }

  // 1. Cuenta
  const acc = await brevo('GET', '/account');
  if (!acc.ok) { out(`La API key no sirve (${acc.status}): ${JSON.stringify(acc.data)}`); process.exit(1); }
  out(`\n== Cuenta Brevo: ${acc.data.email} · ${acc.data.companyName || ''}`);
  for (const p of acc.data.plan || []) out(`   plan ${p.type}${p.credits != null ? ` · créditos ${p.credits}` : ''}`);
  if (acc.data.relay) out(`   SMTP: ${acc.data.relay.enabled ? 'activo' : 'NO activo'} (${acc.data.relay.data?.userName || ''})`);

  // 2. Por qué no llegaron: últimos eventos del correo transaccional
  out('\n== Últimos envíos según Brevo');
  const ev = await brevo('GET', `/smtp/statistics/events?limit=25&sort=desc${TO ? `&email=${encodeURIComponent(TO)}` : ''}`);
  const events = ev.data?.events || [];
  if (!events.length) out('   (sin eventos registrados todavía)');
  for (const e of events.slice(0, 12)) out(`   ${e.date}  ${e.event.padEnd(12)} ${e.email}  ${e.subject || ''}${e.reason ? '  → ' + e.reason : ''}${e.from ? '  (de ' + e.from + ')' : ''}`);

  // 3. Remitentes
  const senders = (await brevo('GET', '/senders')).data?.senders || [];
  out('\n== Remitentes en Brevo');
  for (const s of senders) out(`   ${s.active ? 'activo  ' : 'INACTIVO'}  ${s.name} <${s.email}>`);

  // 4. Dominio: alta + registros DNS
  let dom = await brevo('GET', `/senders/domains/${DOMAIN}`);
  if (!dom.ok) {
    const created = await brevo('POST', '/senders/domains', { name: DOMAIN });
    out(created.ok ? `\n== Dominio ${DOMAIN} agregado a Brevo` : `\nNo pude agregar ${DOMAIN}: ${JSON.stringify(created.data)}`);
    dom = await brevo('GET', `/senders/domains/${DOMAIN}`);
  }
  const d = dom.data || {};
  out(`\n== Dominio ${DOMAIN}: ${d.authenticated ? 'AUTENTICADO' : 'sin autenticar'}${d.verified ? ' · verificado' : ''}`);
  const recs = Object.entries(d.dns_records || {}).map(([k, r]) => ({ key: k, ...r }));
  if (recs.length) {
    out('   Registros DNS que deben estar en Hostinger (Dominios → cania.app → DNS → Agregar registro):');
    for (const r of recs) out(`   - ${String(r.type || r.key).padEnd(12)} nombre: ${r.host_name || '@'}\n           valor: ${r.value ?? ''}\n           estado: ${r.status ? 'OK' : 'falta'}`);
  }

  // 5. Opcional: crear los registros en Hostinger
  if (HOST_TOKEN && recs.some(r => !r.status)) {
    out('\n== Creando los registros en Hostinger…');
    const zone = recs.filter(r => !r.status && r.type && r.value).map(r => {
      let name = (r.host_name || '@').replace(new RegExp(`\\.?${DOMAIN.replace('.', '\\.')}\\.?$`), '') || '@';
      return { name, type: r.type, ttl: 3600, records: [{ content: r.value }] };
    });
    const h = await fetch(`https://developers.hostinger.com/api/dns/v1/zones/${DOMAIN}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${HOST_TOKEN}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ overwrite: false, zone }),
    });
    out(`   Hostinger respondió ${h.status}: ${(await h.text()).slice(0, 300)}`);
  }

  // 6. Intentar autenticar (si el DNS ya está)
  if (!d.authenticated) {
    const a = await brevo('PUT', `/senders/domains/${DOMAIN}/authenticate`);
    out(`\n== Autenticación: ${a.ok ? 'pedida a Brevo' : 'todavía no'} ${a.data?.message ? '· ' + a.data.message : ''}`);
    const again = await brevo('GET', `/senders/domains/${DOMAIN}`);
    d.authenticated = again.data?.authenticated;
  }

  // 7. Remitente deseado
  if (d.authenticated && !senders.some(s => s.email === FROM)) {
    const c = await brevo('POST', '/senders', { name: 'Brindix', email: FROM });
    out(`\n== Remitente ${FROM}: ${c.ok ? 'creado' : JSON.stringify(c.data)}`);
  }

  // 8. Remitente que funcionará hoy: el del dominio si está autenticado; si no, uno ya activo de la cuenta.
  const active = senders.find(s => s.active);
  const useFrom = d.authenticated ? FROM : (active?.email || '');
  out(`\nREMITENTE_LISTO=${useFrom}`);
  out(`DOMINIO_AUTENTICADO=${d.authenticated ? 'si' : 'no'}`);

  // 9. Correo de prueba por la API (muestra el id que Brevo asigna)
  if (TO && useFrom) {
    const t = await brevo('POST', '/smtp/email', {
      sender: { name: 'Brindix', email: useFrom }, to: [{ email: TO }],
      subject: 'Prueba de correo de Brindix',
      htmlContent: '<p>Si lees esto, Brindix ya puede enviarte correos (códigos de recuperación y avisos).</p>',
    });
    out(`\n== Correo de prueba a ${TO} desde ${useFrom}: ${t.ok ? 'enviado (' + (t.data?.messageId || '') + ')' : JSON.stringify(t.data)}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
