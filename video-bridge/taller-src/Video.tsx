import React from 'react';
import {AbsoluteFill, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Mascota, mascotWidth} from './Mascota';
import {SIZES, framesOf, sceneFrames, type Brand, type Callout, type Scene, type VideoSpec} from './spec';

const ease = Easing.bezier(0.23, 1, 0.32, 1);
const font = 'Nunito, "Segoe UI", Arial, sans-serif';
const PHONE_RATIO = 585 / 1266;

interface Layout {
  W: number;
  H: number;
  title: {x: number; y: number; w: number; align: 'center' | 'left'; size: number; subSize: number};
  phone: {x: number; y: number; w: number; h: number};
  col: {x: number; w: number; attach: 'left' | 'right'; minY: number; maxY: number};
  mascot: {x: number; y: number; h: number};
  fs: number;
}

function layoutFor(format: VideoSpec['format'], mirror: boolean, mascotKind: string): Layout {
  const {w: W, h: H} = SIZES[format];
  let L: Layout;
  if (format === '9x16') {
    const ph = 1168;
    L = {
      W, H,
      title: {x: 0, y: 130, w: W, align: 'center', size: 80, subSize: 42},
      phone: {x: 50, y: 470, w: ph * PHONE_RATIO, h: ph},
      col: {x: 625, w: 410, attach: 'left', minY: 480, maxY: 1390},
      mascot: {x: 650, y: 1450, h: 400},
      fs: 34,
    };
  } else if (format === '16x9') {
    const ph = 980;
    L = {
      W, H,
      title: {x: 90, y: 120, w: 740, align: 'left', size: 72, subSize: 38},
      phone: {x: 1330, y: 50, w: ph * PHONE_RATIO, h: ph},
      col: {x: 870, w: 380, attach: 'right', minY: 80, maxY: 940},
      mascot: {x: 160, y: 470, h: 560},
      fs: 30,
    };
  } else {
    const ph = 760;
    L = {
      W, H,
      title: {x: 0, y: 100, w: W, align: 'center', size: 52, subSize: 28},
      phone: {x: 50, y: 270, w: ph * PHONE_RATIO, h: ph},
      col: {x: 450, w: 340, attach: 'left', minY: 270, maxY: 730},
      mascot: {x: 770, y: 760, h: 270},
      fs: 28,
    };
  }
  if (mirror) {
    const flip = (x: number, w: number) => W - x - w;
    L.phone.x = flip(L.phone.x, L.phone.w);
    L.col.x = flip(L.col.x, L.col.w);
    L.col.attach = L.col.attach === 'left' ? 'right' : 'left';
    L.mascot.x = flip(L.mascot.x, mascotWidth(mascotKind, L.mascot.h));
    if (L.title.align === 'left') L.title.x = flip(L.title.x, L.title.w);
  }
  return L;
}

const gradOf = (b: Brand) => `linear-gradient(135deg,${b.from} 0%,${b.mid} 55%,${b.to} 100%)`;

const Bg: React.FC<{brand: Brand; total: number}> = ({brand, total}) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [0, total], [0, 40]);
  return (
    <AbsoluteFill style={{background: `linear-gradient(${160 + a}deg,${brand.bgFrom} 0%,${brand.bgTo} 100%)`}}>
      <div style={{position: 'absolute', width: 900, height: 900, borderRadius: '50%', top: -300, right: -300, background: `radial-gradient(circle,${brand.from}59,transparent 70%)`}} />
      <div style={{position: 'absolute', width: 900, height: 900, borderRadius: '50%', bottom: -300, left: -300, background: `radial-gradient(circle,${brand.to}59,transparent 70%)`}} />
    </AbsoluteFill>
  );
};

interface Placed {
  c: Callout;
  y: number;
  h: number;
  lines: number;
}

function place(callouts: Callout[], L: Layout): Placed[] {
  const charsPerLine = Math.max(8, Math.floor((L.col.w - 92) / (L.fs * 0.5)));
  const items = callouts
    .map((c) => {
      const lines = Math.max(1, Math.ceil(c.text.length / charsPerLine));
      return {c, lines, h: lines * L.fs * 1.25 + 44, y: 0};
    })
    .sort((a, b) => a.c.y - b.c.y);
  let cursor = L.col.minY;
  items.forEach((it) => {
    const want = L.phone.y + (it.c.y / 100) * L.phone.h - it.h / 2;
    it.y = Math.max(want, cursor);
    cursor = it.y + it.h + 16;
  });
  const over = cursor - 16 - L.col.maxY;
  if (over > 0) items.forEach((it) => (it.y -= over));
  return items;
}

const CalloutBox: React.FC<{p: Placed; n: number; i: number; L: Layout; brand: Brand; frames: number}> = ({p, n, i, L, brand, frames}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const step = Math.max(14, (frames - 18 - 48) / Math.max(1, n));
  const start = 18 + i * step;
  const s = spring({frame: f - start, fps, config: {damping: 15, stiffness: 140}});
  const line = interpolate(f, [start + 6, start + 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const fromLeft = L.col.attach === 'left';
  const bx = fromLeft ? L.col.x : L.col.x + L.col.w;
  const by = p.y + p.h / 2;
  const tx = L.phone.x + (p.c.x / 100) * L.phone.w;
  const ty = L.phone.y + (p.c.y / 100) * L.phone.h;
  const ring = interpolate((f - start) % 40, [0, 40], [0.4, 1.6]);
  const ringO = interpolate((f - start) % 40, [0, 40], [0.7, 0]);
  return (
    <>
      <svg width={L.W} height={L.H} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={bx} y1={by} x2={bx + (tx - bx) * line} y2={by + (ty - by) * line} stroke={brand.accent} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
        <circle cx={tx} cy={ty} r={11 * Math.min(1, s)} fill={brand.accent} stroke="#fff" strokeWidth={3} />
        {f > start && <circle cx={tx} cy={ty} r={26 * ring} fill="none" stroke={brand.accent} strokeWidth={3} opacity={ringO} />}
      </svg>
      <div
        style={{
          position: 'absolute', left: L.col.x, top: p.y, width: L.col.w, height: p.h, boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px 0 14px', borderRadius: 26,
          background: 'rgba(255,255,255,.96)', boxShadow: '0 14px 40px rgba(0,0,0,.35)', border: `3px solid ${brand.accent}`,
          opacity: Math.min(1, s * 1.3), transform: `scale(${0.8 + 0.2 * Math.min(1, s)})`, transformOrigin: fromLeft ? 'left center' : 'right center',
          fontFamily: font, fontWeight: 800, fontSize: L.fs, lineHeight: 1.25, color: '#121735',
        }}
      >
        <div style={{flex: '0 0 auto', width: L.fs * 1.5, height: L.fs * 1.5, borderRadius: '50%', background: gradOf(brand), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: L.fs * 0.9}}>
          {i + 1}
        </div>
        <span>{p.c.text}</span>
      </div>
    </>
  );
};

const GuideBar: React.FC<{index: number; count: number; frames: number; L: Layout; brand: Brand}> = ({index, count, frames, L, brand}) => {
  const f = useCurrentFrame();
  const k = L.W > L.H ? 0.85 : L.H === L.W ? 0.8 : 1;
  const prog = interpolate(f, [0, frames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bw = L.W - 120;
  const gap = 8;
  const segW = (bw - gap * (count - 1)) / count;
  return (
    <>
      <div style={{position: 'absolute', left: 60, top: 18, width: bw, height: 10, display: 'flex', gap}}>
        {Array.from({length: count}).map((_, j) => {
          const fill = j < index ? 1 : j === index ? prog : 0;
          return (
            <div key={j} style={{width: segW, height: 10, borderRadius: 5, background: 'rgba(255,255,255,.22)', overflow: 'hidden'}}>
              <div style={{width: `${fill * 100}%`, height: '100%', background: gradOf(brand)}} />
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, top: 44, width: L.W, display: 'flex', justifyContent: 'center'}}>
        <div style={{padding: `${8 * k}px ${28 * k}px`, borderRadius: 100, background: gradOf(brand), color: '#fff', fontFamily: font, fontWeight: 900, fontSize: 32 * k, lineHeight: 1.2, boxShadow: '0 8px 24px rgba(0,0,0,.35)'}}>
          Paso {index + 1} de {count}
        </div>
      </div>
    </>
  );
};

const SceneView: React.FC<{scene: Scene; spec: VideoSpec; frames: number; index: number}> = ({scene, spec, frames, index}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {brand} = spec;
  const pose = scene.mascot?.pose ?? 'none';
  const mirror = scene.mascot?.side === 'left';
  const L = layoutFor(spec.format, mirror, brand.mascot);
  const inP = spring({frame: f, fps, config: {damping: 17, stiffness: 110}});
  const fade = interpolate(f, [frames - 8, frames], [1, 0], {extrapolateLeft: 'clamp'});
  const tx = interpolate(f, [4, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const placed = place(scene.callouts ?? [], L);
  const mIn = spring({frame: f - 10, fps, config: {damping: 14}});
  const t = L.title;
  return (
    <AbsoluteFill style={{opacity: fade}}>
      <div style={{position: 'absolute', left: t.x, top: t.y, width: t.w, boxSizing: 'border-box', padding: '0 60px', textAlign: t.align, fontFamily: font, opacity: tx, transform: `translateY(${(1 - tx) * 22}px)`}}>
        <div style={{fontWeight: 900, fontSize: t.size, color: '#fff', lineHeight: 1.08}}>{scene.title}</div>
        {scene.sub && <div style={{fontWeight: 700, fontSize: t.subSize, color: brand.accent, marginTop: 16}}>{scene.sub}</div>}
      </div>
      <div
        style={{
          position: 'absolute', left: L.phone.x, top: L.phone.y, width: L.phone.w, height: L.phone.h, borderRadius: 56, overflow: 'hidden',
          border: '9px solid #e4e9fb', boxSizing: 'border-box', boxShadow: '0 40px 100px rgba(0,0,0,.5)',
          transform: `translateY(${(1 - inP) * 240}px) scale(${0.94 + 0.06 * inP})`,
        }}
      >
        <Img src={staticFile(scene.image)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top'}} />
      </div>
      {placed.map((p, i) => (
        <CalloutBox key={i} p={p} n={placed.length} i={i} L={L} brand={brand} frames={frames} />
      ))}
      {pose !== 'none' && (
        <div style={{position: 'absolute', left: L.mascot.x, top: L.mascot.y, transform: `translateY(${(1 - Math.min(1, mIn)) * 160}px) scaleX(${mirror ? -1 : 1})`, opacity: Math.min(1, mIn * 1.5)}}>
          <Mascota kind={brand.mascot} pose={pose} height={L.mascot.h} colors={brand} talking={f > 12 && f < frames - 10} />
        </div>
      )}
      {spec.guide && <GuideBar index={index} count={spec.scenes.length} frames={frames} L={L} brand={brand} />}
    </AbsoluteFill>
  );
};

const Intro: React.FC<{spec: VideoSpec; frames: number}> = ({spec, frames}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {brand} = spec;
  const s = spring({frame: f, fps, config: {damping: 14, stiffness: 120}});
  const t = interpolate(f, [14, 32], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const out = interpolate(f, [frames - 10, frames], [1, 0], {extrapolateLeft: 'clamp'});
  const wide = spec.format === '16x9';
  const k = wide ? 0.7 : 1;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: out, fontFamily: font, textAlign: 'center'}}>
      <Img src={staticFile(brand.logo)} style={{width: 340 * k, height: 340 * k, transform: `scale(${s})`, filter: `drop-shadow(0 0 60px ${brand.accent}66)`}} />
      <div style={{marginTop: 36 * k, fontWeight: 900, fontSize: 110 * k, color: '#fff', opacity: t, transform: `translateY(${(1 - t) * 30}px)`, padding: '0 60px', lineHeight: 1.05}}>{spec.intro.title}</div>
      {spec.intro.sub && <div style={{fontWeight: 700, fontSize: 46 * k, color: '#cfd8f6', opacity: t, marginTop: 14, padding: '0 60px'}}>{spec.intro.sub}</div>}
    </AbsoluteFill>
  );
};

const Outro: React.FC<{spec: VideoSpec}> = ({spec}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {brand} = spec;
  const s = spring({frame: f, fps, config: {damping: 14}});
  const t = interpolate(f, [10, 30], [0, 1], {extrapolateRight: 'clamp', easing: ease});
  const wide = spec.format === '16x9';
  const k = wide ? 0.62 : spec.format === '1x1' ? 0.7 : 1;
  const mh = 520 * k;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily: font, textAlign: 'center'}}>
      <div style={{transform: `translateY(${(1 - Math.min(1, s)) * 120}px)`, opacity: Math.min(1, s * 1.5)}}>
        <Mascota kind={brand.mascot} pose="celebrate" height={mh} colors={brand} talking={false} />
      </div>
      <div style={{fontWeight: 900, fontSize: 84 * k, color: '#fff', marginTop: 30 * k, opacity: t, padding: '0 60px', lineHeight: 1.1}}>{spec.outro.title}</div>
      <div style={{marginTop: 40 * k, padding: `${24 * k}px ${64 * k}px`, borderRadius: 100, background: gradOf(brand), color: '#fff', fontWeight: 800, fontSize: 52 * k, opacity: t, transform: `translateY(${(1 - t) * 20}px)`}}>{spec.outro.cta}</div>
    </AbsoluteFill>
  );
};

export const PromoVideo: React.FC<VideoSpec> = (spec) => {
  const introF = framesOf(spec.intro.seconds, 3);
  const outroF = framesOf(spec.outro.seconds, 4);
  let at = introF;
  const total = introF + spec.scenes.reduce((a, s) => a + sceneFrames(s), 0) + outroF;
  return (
    <AbsoluteFill>
      <Bg brand={spec.brand} total={total} />
      <Sequence from={0} durationInFrames={introF}>
        <Intro spec={spec} frames={introF} />
      </Sequence>
      {spec.scenes.map((s, i) => {
        const fr = sceneFrames(s);
        const from = at;
        at += fr;
        return (
          <Sequence key={i} from={from} durationInFrames={fr}>
            <SceneView scene={s} spec={spec} frames={fr} index={i} />
          </Sequence>
        );
      })}
      <Sequence from={at} durationInFrames={outroF}>
        <Outro spec={spec} />
      </Sequence>
    </AbsoluteFill>
  );
};
