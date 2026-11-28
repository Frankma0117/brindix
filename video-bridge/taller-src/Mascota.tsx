import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import type {Pose} from './spec';

/**
 * Canix de cuerpo completo (mismo diseño que el casco del logo: casco blanco, visor oscuro,
 * ojos LED cian, hexágono degradado en el pecho). No es un sticker: es la mascota para video.
 */
export const CanixBody: React.FC<{pose: Pose; height: number; colors: {from: string; mid: string; to: string}}> = ({pose, height, colors}) => {
  const f = useCurrentFrame();
  const bob = 0; // la mascota queda quieta: solo se mueve la boca
  const wiggle = Math.sin(f / 3.2) * 12;
  let left = 8;
  let right = -8;
  if (pose === 'wave') right = -150 + wiggle;
  if (pose === 'point') right = -96;
  if (pose === 'celebrate') {
    left = 150 - wiggle * 0.5;
    right = -150 + wiggle * 0.5;
  }
  const arm = (cx: number, a: number) => (
    <g transform={`rotate(${a} ${cx} 142)`}>
      <rect x={cx - 11} y={134} width={22} height={66} rx={11} fill="url(#cxBody)" />
      <circle cx={cx} cy={204} r={12} fill="#1b2150" />
    </g>
  );
  return (
    <svg width={(height * 200) / 330} height={height} viewBox="0 0 200 330" style={{transform: `translateY(${bob}px)`, overflow: 'visible'}}>
      <defs>
        <linearGradient id="cxHex" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors.from} />
          <stop offset="0.55" stopColor={colors.mid} />
          <stop offset="1" stopColor={colors.to} />
        </linearGradient>
        <linearGradient id="cxBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe5fa" />
        </linearGradient>
        <radialGradient id="cxGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#5ff0ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#5ff0ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="322" rx="52" ry="7" fill="rgba(0,0,0,.28)" />
      {/* piernas y botas */}
      <rect x="72" y="214" width="24" height="84" rx="12" fill="url(#cxBody)" />
      <rect x="104" y="214" width="24" height="84" rx="12" fill="url(#cxBody)" />
      <ellipse cx="82" cy="306" rx="22" ry="12" fill="#1b2150" />
      <ellipse cx="118" cy="306" rx="22" ry="12" fill="#1b2150" />
      {/* brazos detrás del torso */}
      {arm(64, left)}
      {arm(136, right)}
      {/* cuello y torso */}
      <rect x="88" y="108" width="24" height="18" rx="6" fill="#cfd8f6" />
      <rect x="58" y="120" width="84" height="104" rx="36" fill="url(#cxBody)" />
      <polygon points="100,146 119,157 119,179 100,190 81,179 81,157" fill="url(#cxHex)" stroke="url(#cxHex)" strokeWidth="6" strokeLinejoin="round" />
      <path d="M92 170 L100 158 L108 170 Z" fill="#fff" opacity="0.92" />
      {/* cabeza */}
      <rect x="36" y="46" width="18" height="40" rx="9" fill="#cfd8f6" />
      <rect x="146" y="46" width="18" height="40" rx="9" fill="#cfd8f6" />
      <rect x="48" y="14" width="104" height="100" rx="40" fill="url(#cxBody)" />
      <path d="M62 26 Q76 18 92 18" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.9" />
      <rect x="60" y="34" width="80" height="58" rx="26" fill="#121735" />
      <ellipse cx="100" cy="66" rx="32" ry="17" fill="url(#cxGlow)" />
      <path d="M76 70 Q85 56 94 70" stroke="#3fe6ff" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M106 70 Q115 56 124 70" stroke="#3fe6ff" strokeWidth="7" strokeLinecap="round" fill="none" />
    </svg>
  );
};

/** Brindix de cuerpo completo: la copa con audífonos del logo, con brazos y piernas. Mismo lienzo 200x330 que Canix. */
/** Apertura de la boca (0-1): varios senos de distinta frecuencia, ~4 aperturas/s a 30 fps, con amplitud y pausas variables. */
export const mouthOpen = (f: number): number => {
  const syl = 0.5 + 0.5 * Math.sin((f / 30) * Math.PI * 2 * 4.2);
  const syl2 = 0.5 + 0.5 * Math.sin((f / 30) * Math.PI * 2 * 2.7 + 1.3);
  const amp = 0.55 + 0.45 * Math.sin(f / 11 + Math.sin(f / 37) * 2);
  const phrase = Math.sin(f / 26) > -0.75 ? 1 : 0.15;
  return Math.max(0, Math.min(1, (syl * 0.65 + syl2 * 0.35) * amp * phrase * 1.15));
};

export const BrindixBody: React.FC<{pose: Pose; height: number; talking?: boolean}> = ({pose, height, talking = true}) => {
  const f = useCurrentFrame();
  const o = talking ? mouthOpen(f) : 0;
  const mouthD = talking
    ? `M52 74 Q60 ${74 - o * 1.5} 68 74 Q60 ${74 + 5 + o * 15} 52 74 Z`
    : 'M52 75 Q60 84 68 75';
  const bob = 0; // la mascota queda quieta: solo se mueve la boca
  return (
    <svg width={(height * 200) / 200} height={height} viewBox="0 0 200 200" style={{transform: `translateY(${bob}px)`, overflow: 'visible'}}>
      <defs>
        <linearGradient id="bxLiq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd166" />
          <stop offset="0.55" stopColor="#ffb238" />
          <stop offset="1" stopColor="#ff7a45" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="196" rx="52" ry="7" fill="rgba(0,0,0,.28)" />
      <g transform="translate(10 0) scale(1.5)">
        <line x1="74" y1="22" x2="88" y2="58" stroke="#e9d8a6" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="80" cy="36" r="6.5" fill="#7cb342" />
        <circle cx="81.5" cy="35" r="2.2" fill="#e53935" />
        <path d="M17 56 C14 12, 106 12, 103 56" fill="none" stroke="#2a2236" strokeWidth="7" strokeLinecap="round" />
        <path d="M17 56 C14 12, 106 12, 103 56" fill="none" stroke="#8b7fa8" strokeWidth="2" strokeLinecap="round" opacity=".7" />
        <path d="M18 44 L102 44 L65 94 Q60 100 55 94 Z" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.9)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M27 52 L93 52 L63 91 Q60 95 57 91 Z" fill="url(#bxLiq)" />
        <path d="M31 55 L46 55 L40 64 Z" fill="rgba(255,255,255,.35)" />
        <path d="M20 44 a11 11 0 0 1 22 0 Z" fill="#c6f36b" stroke="#8bc34a" strokeWidth="1.5" />
        <ellipse cx="50" cy="66" rx="4.2" ry="5" fill="#2a1606" />
        <circle cx="51.5" cy="64" r="1.5" fill="#fff" />
        <ellipse cx="70" cy="66" rx="4.2" ry="5" fill="#2a1606" />
        <circle cx="71.5" cy="64" r="1.5" fill="#fff" />
        <circle cx="43" cy="74" r="3.5" fill="#ff7aa8" opacity=".55" />
        <circle cx="77" cy="74" r="3.5" fill="#ff7aa8" opacity=".55" />
        <path d={mouthD} fill="#7a2e12" stroke="#2a1606" strokeWidth="2" strokeLinejoin="round" />
        <rect x="7" y="46" width="15" height="26" rx="7" fill="#ff4f8b" />
        <rect x="10" y="50" width="5" height="18" rx="2.5" fill="#ff8fb5" />
        <rect x="98" y="46" width="15" height="26" rx="7" fill="#ff4f8b" />
        <rect x="105" y="50" width="5" height="18" rx="2.5" fill="#ff8fb5" />
        <rect x="57" y="96" width="6" height="28" rx="3" fill="rgba(255,255,255,.8)" />
        <ellipse cx="60" cy="127" rx="25" ry="6" fill="rgba(255,255,255,.85)" />
      </g>
    </svg>
  );
};

export const Mascota: React.FC<{
  kind: string;
  pose: Pose;
  height: number;
  colors: {from: string; mid: string; to: string};
  talking?: boolean;
}> = ({kind, pose, height, colors, talking = true}) => {
  const f = useCurrentFrame();
  if (pose === 'none') return null;
  if (kind === 'brindix') return <BrindixBody pose={pose} height={height} talking={talking} />;
  if (kind === 'canix') return <CanixBody pose={pose} height={height} colors={colors} />;
  return (
    <Img
      src={staticFile(kind)}
      style={{height, width: 'auto', transform: `translateY(0px)`, filter: 'drop-shadow(0 20px 30px rgba(0,0,0,.4))'}}
    />
  );
};

/** Ancho real de la mascota según su tipo (el vaso de Brindix es cuadrado; Canix es 200x330). */
export const mascotWidth = (kind: string, h: number) => (kind === 'canix' ? (h * 200) / 330 : h);
