/* Escenario determinista: nada usa relojes ni animaciones CSS. window.stageAt(t) pinta el cuadro exacto del segundo t,
   así Playwright puede grabar cuadro por cuadro sin saltos. La copa de Brindix mueve la boca con el volumen de la voz. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const easeOut = p => 1 - Math.pow(1 - clamp(p), 3);
  const easeInOut = p => { p = clamp(p); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const MASCOT = (id, talking) => `
  <svg viewBox="0 0 120 140" aria-hidden="true">
    <defs>
      <linearGradient id="liq${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd166"/><stop offset=".55" stop-color="#ffb238"/><stop offset="1" stop-color="#ff7a45"/>
      </linearGradient>
      ${talking ? `<clipPath id="mc${id}"><path class="mouth-clip" d="M52 75 Q60 77 68 75 Q60 84 52 75 Z"/></clipPath>` : ''}
    </defs>
    ${talking ? `<g class="notes" opacity="0">
      <g class="n1"><path d="M6 30 v-14 l10 -3 v14" fill="none" stroke="#3ee0d0" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="4" cy="30" r="3.2" fill="#3ee0d0"/><circle cx="14" cy="27" r="3.2" fill="#3ee0d0"/></g>
      <g class="n2"><path d="M110 22 v-13" stroke="#ff4f8b" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M110 9 q6 2 6 8" fill="none" stroke="#ff4f8b" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="107.5" cy="22" r="3.4" fill="#ff4f8b"/></g>
    </g>` : ''}
    <line x1="74" y1="22" x2="88" y2="58" stroke="#e9d8a6" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="80" cy="36" r="6.5" fill="#7cb342"/><circle cx="81.5" cy="35" r="2.2" fill="#e53935"/>
    <path d="M17 56 C14 12, 106 12, 103 56" fill="none" stroke="#2a2236" stroke-width="7" stroke-linecap="round"/>
    <path d="M17 56 C14 12, 106 12, 103 56" fill="none" stroke="#8b7fa8" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    <path d="M18 44 L102 44 L65 94 Q60 100 55 94 Z" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.75)" stroke-width="2.5" stroke-linejoin="round"/>
    <path class="liquid" d="M27 52 L93 52 L63 91 Q60 95 57 91 Z" fill="url(#liq${id})"/>
    <path d="M31 55 L46 55 L40 64 Z" fill="rgba(255,255,255,.35)"/>
    <path d="M20 44 a11 11 0 0 1 22 0 Z" fill="#c6f36b" stroke="#8bc34a" stroke-width="1.5"/>
    <path d="M31 44 L25 37 M31 44 L31 34 M31 44 L37 37" stroke="#8bc34a" stroke-width="1.2"/>
    <g class="eyes">
      <ellipse cx="50" cy="66" rx="4.2" ry="5" fill="#2a1606"/><circle cx="51.5" cy="64" r="1.5" fill="#fff"/>
      <ellipse cx="70" cy="66" rx="4.2" ry="5" fill="#2a1606"/><circle cx="71.5" cy="64" r="1.5" fill="#fff"/>
    </g>
    <path class="brows" d="M45 58 q5 -3 10 0 M65 58 q5 -3 10 0" fill="none" stroke="#2a1606" stroke-width="1.8" stroke-linecap="round" opacity="0"/>
    <circle cx="43" cy="74" r="3.5" fill="#ff7aa8" opacity=".55"/><circle cx="77" cy="74" r="3.5" fill="#ff7aa8" opacity=".55"/>
    ${talking ? `<path class="mouth" d="M52 75 Q60 77 68 75 Q60 84 52 75 Z" fill="#7a2e12" stroke="#2a1606" stroke-width="2" stroke-linejoin="round"/>
      <ellipse class="tongue" cx="60" cy="84" rx="5.5" ry="3" fill="#ff7a6b" clip-path="url(#mc${id})"/>`
      : `<path d="M52 75 Q60 84 68 75" fill="#7a2e12" stroke="#2a1606" stroke-width="2" stroke-linejoin="round"/>`}
    <rect x="7" y="46" width="15" height="26" rx="7" fill="#ff4f8b"/><rect x="10" y="50" width="5" height="18" rx="2.5" fill="#ff8fb5"/>
    <rect x="98" y="46" width="15" height="26" rx="7" fill="#ff4f8b"/><rect x="105" y="50" width="5" height="18" rx="2.5" fill="#ff8fb5"/>
    <rect x="57" y="96" width="6" height="28" rx="3" fill="rgba(255,255,255,.7)"/>
    <ellipse cx="60" cy="127" rx="25" ry="6" fill="rgba(255,255,255,.75)"/>
    <ellipse cx="60" cy="125.5" rx="19" ry="3" fill="rgba(255,255,255,.35)"/>
  </svg>`;

  // Proporción ancho/alto del marco de cada dispositivo (la pantalla adentro queda con la proporción de la captura).
  const DEVICE_RATIO = { phone: 0.472, laptop: 1.466, tv: 1.6 };

  function layout(fmt, W, H) {
    if (fmt === 'horizontal') return {
      tag: { left: .06 * W, top: .2 * H }, head: { left: .06 * W, top: .26 * H, width: .34 * W, size: .074 * H },
      device: { cx: .70 * W, cy: .47 * H, maxW: .52 * W, maxH: .74 * H },
      corner: { w: .12 * W, x: .075 * W, bottom: .86 * H },
      subs: { top: .885 * H, left: .08 * W, right: .08 * W, size: .043 * H },
      hero: { w: .15 * W, top: .09 * H, content: .45 * H, big: .1 * H },
      outro: { w: .1 * W, top: .06 * H, content: .32 * H, big: .09 * H },
    };
    if (fmt === 'cuadrado') return {
      tag: { left: .06 * W, top: .125 * H }, head: { left: .06 * W, top: .17 * H, width: .88 * W, size: .068 * W },
      device: { cx: .5 * W, cy: .555 * H, maxW: .78 * W, maxH: .47 * H },
      corner: { w: .19 * W, x: .025 * W, bottom: .975 * H },
      subs: { top: .835 * H, left: .23 * W, right: .05 * W, size: .043 * W },
      hero: { w: .27 * W, top: .11 * H, content: .5 * H, big: .095 * W },
      outro: { w: .17 * W, top: .09 * H, content: .32 * H, big: .085 * W },
    };
    return {
      tag: { left: .065 * W, top: .085 * H }, head: { left: .065 * W, top: .118 * H, width: .87 * W, size: .08 * W },
      device: { cx: .5 * W, cy: .52 * H, maxW: .86 * W, maxH: .55 * H },
      corner: { w: .27 * W, x: .70 * W, bottom: .875 * H },
      subs: { top: .885 * H, left: .06 * W, right: .06 * W, size: .048 * W },
      hero: { w: .44 * W, top: .19 * H, content: .48 * H, big: .115 * W },
      outro: { w: .3 * W, top: .12 * H, content: .355 * H, big: .1 * W },
    };
  }

  let D, L, scenes = [], mascot, subs;

  function words(text) {
    // La última palabra va en ámbar: es la que remata el titular.
    const ws = String(text).split(/\s+/).filter(Boolean);
    return ws.map((w, i) => `<span class="w${i === ws.length - 1 ? ' hl' : ''}">${esc(w)}</span>`).join(' ');
  }

  function chunks(say) {
    // Subtítulos en frases cortas: corta en la puntuación o cada 7 palabras; cada palabra pesa según sus letras.
    const ws = String(say).split(/\s+/).filter(Boolean);
    const out = []; let cur = [];
    ws.forEach((w, i) => {
      cur.push(w);
      if (cur.length >= 7 || /[.,;:!?…]$/.test(w) && cur.length >= 3 || i === ws.length - 1) { out.push(cur); cur = []; }
    });
    const weight = w => w.length + 2;
    const total = ws.reduce((a, w) => a + weight(w), 0) || 1;
    let acc = 0;
    return out.map(c => {
      const from = acc / total;
      const marks = c.map(w => { const m = acc / total; acc += weight(w); return m; });
      return { words: c, from, to: acc / total, marks };
    });
  }

  function deviceHtml(kind, src) {
    const img = src ? `<img src="${src}" alt="">` : '';
    if (kind === 'phone') return `<div class="frame"></div><div class="screen">${img}</div><div class="notch"></div>`;
    if (kind === 'tv') return `<div class="panel"></div><div class="screen">${img}</div><div class="stand"></div>`;
    return `<div class="lid"></div><div class="screen">${img}</div><div class="base"></div>`;
  }

  function build() {
    const W = D.width, H = D.height;
    L = layout(D.format, W, H);
    $('.mini-logo').innerHTML = MASCOT('logo', false);
    const root = $('#scenes');
    root.innerHTML = '';
    scenes = D.scenes.map((s, i) => {
      const el = document.createElement('div');
      el.className = 'scene';
      const kind = s.shot === 'intro' ? 'intro' : s.shot === 'cierre' ? 'outro' : 'shot';
      if (kind === 'shot') {
        const dev = s.device || 'phone';
        const r = DEVICE_RATIO[dev];
        let w = L.device.maxW, h = w / r;
        if (h > L.device.maxH) { h = L.device.maxH; w = h * r; }
        el.innerHTML = `
          ${s.label ? `<div class="tag" style="left:${L.tag.left}px;top:${L.tag.top}px">${esc(s.label)}</div>` : ''}
          <h1 class="head" style="left:${L.head.left}px;top:${L.head.top + (s.label ? 0 : -L.head.size * .4)}px;width:${L.head.width}px;font-size:${L.head.size}px">${words(s.headline)}</h1>
          <div class="device ${dev}" style="left:${L.device.cx - w / 2}px;top:${L.device.cy - h / 2}px;width:${w}px;height:${h}px">${deviceHtml(dev, D.captures[s.shot])}</div>`;
      } else {
        const box = kind === 'intro' ? L.hero : L.outro;
        const extra = kind === 'intro'
          ? (D.eyebrow ? `<div class="tag" style="position:static">${esc(D.eyebrow)}</div>` : '')
          : `<div class="cta-card">${D.qr ? `<img src="${D.qr}" alt="">` : ''}<div><b>brindix.cania.app</b><span>Escanea y pide tu demo gratis</span></div></div>`;
        el.innerHTML = `<div class="hero ${kind}" style="top:${box.content}px;bottom:auto;justify-content:flex-start">
          ${kind === 'intro' ? extra : ''}
          <h1 class="big" style="font-size:${box.big}px">${words(s.headline)}</h1>
          ${kind === 'outro' ? extra : ''}</div>`;
        if (kind === 'intro') el.querySelectorAll('.hero .w').forEach(x => x.style.display = 'inline-block');
      }
      root.appendChild(el);
      return {
        s, kind, el, head: [...el.querySelectorAll('.w')], device: el.querySelector('.device'), img: el.querySelector('.device img'),
        tag: el.querySelector('.tag'), cta: el.querySelector('.cta-card'), chunks: chunks(s.say),
      };
    });

    mascot = $('#mascot');
    mascot.innerHTML = MASCOT('main', true);
    mascot.style.width = L.hero.w + 'px';
    mascot.style.height = L.hero.w * 140 / 120 + 'px';
    mascot.style.left = '0px'; mascot.style.top = '0px';
    mascot.style.transformOrigin = '0 0';

    subs = $('#subs');
    Object.assign(subs.style, { top: L.subs.top + 'px', left: L.subs.left + 'px', right: L.subs.right + 'px', fontSize: L.subs.size + 'px' });
  }

  // Dónde está la copa según la escena: grande en la portada y el cierre, en la esquina presentando las pantallas.
  function mascotTarget(sc) {
    const W = D.width;
    if (sc.kind === 'shot') { const c = L.corner; return { x: c.x, y: c.bottom - c.w * 140 / 120, w: c.w }; }
    const b = sc.kind === 'intro' ? L.hero : L.outro;
    return { x: (W - b.w) / 2, y: b.top, w: b.w };
  }

  function levelAt(sc, t) {
    const s = sc.s;
    if (!s.levels || t < s.voiceAt || t > s.voiceAt + s.voiceLen) return 0;
    const f = (t - s.voiceAt) * D.fps;
    const i = Math.floor(f), lv = s.levels;
    const a = lv[i] || 0, b = lv[i + 1] || 0, p = lv[i - 1] || 0;
    return clamp((p * .25 + lerp(a, b, f - i) * .75));
  }

  function sceneIndex(t) {
    for (let i = scenes.length - 1; i >= 0; i--) if (t >= scenes[i].s.start) return i;
    return 0;
  }

  window.stageAt = function (t) {
    const idx = sceneIndex(t);
    const FADE = .4;

    scenes.forEach((sc, i) => {
      const s = sc.s;
      const isLast = i === scenes.length - 1;
      const inP = i === 0 ? 1 : easeOut((t - s.start) / FADE);
      const outP = isLast ? 0 : easeInOut((t - s.end) / FADE);
      const visible = t >= s.start - .01 && (isLast || t <= s.end + FADE);
      if (!visible) { sc.el.style.opacity = 0; sc.el.style.visibility = 'hidden'; return; }
      sc.el.style.visibility = 'visible';
      sc.el.style.opacity = clamp(inP * (1 - outP));
      sc.el.style.transform = `translateY(${-outP * 2}%)`;
      const local = t - s.start;

      sc.head.forEach((w, k) => {
        const p = easeOut((local - .12 - k * .075) / .5);
        w.style.opacity = p;
        w.style.transform = `translateY(${(1 - p) * 45}%)`;
      });
      if (sc.tag) {
        const p = easeOut((local - .05) / .45);
        sc.tag.style.opacity = p;
        sc.tag.style.transform = `translateY(${(1 - p) * 30}%)`;
      }
      if (sc.device) {
        const p = easeOut((local - .15) / .7);
        const dur = Math.max(1, s.end - s.start);
        const k = clamp(local / dur);
        // Entra subiendo y se queda flotando apenas; la captura hace un Ken Burns lento hacia abajo.
        const float = Math.sin(local * 1.1) * .4;
        sc.device.style.opacity = p;
        sc.device.style.transform = `translateY(${(1 - p) * 9 + float}%) scale(${.92 + .08 * p}) rotate(${(1 - p) * -2}deg)`;
        if (sc.img) sc.img.style.transform = `scale(${1.02 + .06 * k}) translateY(${-2.2 * k}%)`;
      }
      if (sc.cta) {
        const p = easeOut((local - .55) / .6);
        sc.cta.style.opacity = p;
        sc.cta.style.transform = `translateY(${(1 - p) * 25}%) scale(${.94 + .06 * p})`;
      }
    });

    // Copa: posición, rebote, parpadeo y boca.
    const cur = scenes[idx];
    let box = mascotTarget(cur);
    if (idx > 0) {
      const p = easeInOut((t - cur.s.start) / .7);
      if (p < 1) {
        const prev = mascotTarget(scenes[idx - 1]);
        box = { x: lerp(prev.x, box.x, p), y: lerp(prev.y, box.y, p), w: lerp(prev.w, box.w, p) };
      }
    }
    const lv = levelAt(cur, t);
    const bob = Math.sin(t * 2.1) * .018 * box.w;
    const tilt = Math.sin(t * 1.3) * 2.2 + lv * 2.5 * Math.sin(t * 9);
    const squash = 1 + lv * .035;
    // Entrada de la copa en el primer segundo: sube con un pequeño rebote.
    const enter = easeOut(t / .9);
    const scale = box.w / L.hero.w;
    mascot.style.opacity = clamp(t / .35);
    mascot.style.transform = `translate(${box.x}px, ${box.y + bob - lv * .03 * box.w + (1 - enter) * box.w * .5}px) scale(${scale * squash}, ${scale / squash}) rotate(${tilt}deg)`;

    const blinkPhase = (t + 1.3) % 3.6;
    const blink = blinkPhase < .14 ? 1 - Math.sin(blinkPhase / .14 * Math.PI) * .9 : 1;
    $('.eyes', mascot).setAttribute('transform', `translate(0 66) scale(1 ${blink.toFixed(3)}) translate(0 -66)`);
    $('.brows', mascot).setAttribute('opacity', (lv > .55 ? clamp((lv - .55) * 3) : 0).toFixed(2));

    const open = lv;
    const top = 75 - open * 1.5, upper = 77 - open * 3, lower = 84 + open * 11, wide = open * 2;
    const d = `M${52 - wide} ${top} Q60 ${upper} ${68 + wide} ${top} Q60 ${lower} ${52 - wide} ${top} Z`;
    $('.mouth', mascot).setAttribute('d', d);
    $('.mouth-clip', mascot).setAttribute('d', d);
    const tongue = $('.tongue', mascot);
    tongue.setAttribute('cy', (lower - 3.5).toFixed(2));
    tongue.setAttribute('opacity', clamp((open - .15) * 2).toFixed(2));

    const heroW = cur.kind === 'shot' ? 0 : 1;
    const notes = $('.notes', mascot);
    notes.setAttribute('opacity', (heroW * (.6 + .4 * Math.sin(t * 2))).toFixed(2));
    $('.n1', mascot).setAttribute('transform', `translate(0 ${(Math.sin(t * 2.4) * 4).toFixed(2)})`);
    $('.n2', mascot).setAttribute('transform', `translate(0 ${(Math.sin(t * 2.4 + 1.6) * 4).toFixed(2)})`);
    // El trago baja de a poco a lo largo del video, como si se lo fuera tomando.
    const drink = clamp(t / D.total) * 8;
    $('.liquid', mascot).setAttribute('transform', `translate(0 ${drink.toFixed(2)})`);

    // Subtítulos: la frase que se está diciendo, con la palabra actual resaltada.
    let html = '';
    const s = cur.s;
    if (t >= s.voiceAt && s.voiceLen > 0) {
      const p = clamp((t - s.voiceAt) / s.voiceLen);
      const ch = cur.chunks.find(c => p < c.to) || cur.chunks[cur.chunks.length - 1];
      if (ch) {
        const n = ch.marks.reduce((acc, m, k) => (p >= m ? k : acc), 0);
        html = '<span>' + ch.words.map((w, k) => k === n && p < 1 ? `<span class="now">${esc(w)}</span>` : esc(w)).join(' ') + '</span>';
      }
    }
    if (subs.innerHTML !== html) subs.innerHTML = html;
    subs.style.opacity = cur.kind === 'outro' && t > s.voiceAt + s.voiceLen + .4 ? clamp(1 - (t - s.voiceAt - s.voiceLen - .4) / .4) : 1;
  };

  window.ready = false;
  window.load = function (data) {
    D = data;
    build();
    const imgs = [...document.images].map(i => i.decode().catch(() => null));
    Promise.all([document.fonts.ready, ...imgs]).then(() => { window.stageAt(0); window.ready = true; });
  };
})();
