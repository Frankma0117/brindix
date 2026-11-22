// Contrato del video: lo que el panel de publicidad de cada proyecto edita y envía al taller.
export type Pose = 'wave' | 'point' | 'celebrate' | 'idle' | 'none';
export type Format = '9x16' | '16x9' | '1x1';

export interface Callout {
  /** Punto que señala, en % del recuadro del teléfono (0-100). */
  x: number;
  y: number;
  text: string;
}

export interface Scene {
  /** Ruta bajo public/, p. ej. "proyectos/canix/imagenes/m-home.jpg". */
  image: string;
  title: string;
  sub?: string;
  callouts?: Callout[];
  mascot?: {pose: Pose; side?: 'left' | 'right'};
  /** Segundos que dura la escena (mínimo 5; +1.2 s por recuadro). */
  seconds?: number;
}

export interface Brand {
  name: string;
  /** Colores del degradado de marca y del acento. */
  from: string;
  mid: string;
  to: string;
  accent: string;
  bgFrom: string;
  bgTo: string;
  /** Ruta bajo public/ del logo cuadrado. */
  logo: string;
  /** Mascota: 'canix' (SVG de cuerpo completo incluido) o ruta de imagen bajo public/ (PNG con fondo transparente). */
  mascot: 'canix' | string;
}

export interface VideoSpec {
  brand: Brand;
  format: Format;
  intro: {title: string; sub?: string; seconds?: number};
  scenes: Scene[];
  outro: {title: string; cta: string; seconds?: number};
  /** Guía paso a paso: insignia «Paso N de M» y barra de progreso en cada escena. */
  guide?: boolean;
}

export const FPS = 30;
export const SIZES: Record<Format, {w: number; h: number}> = {
  '9x16': {w: 1080, h: 1920},
  '16x9': {w: 1920, h: 1080},
  '1x1': {w: 1080, h: 1080},
};

export const framesOf = (s: number | undefined, d: number) => Math.round((s ?? d) * FPS);

export const sceneFrames = (s: Scene) => framesOf(s.seconds, Math.max(5, 2.6 + (s.callouts?.length ?? 0) * 1.2));

export function totalFrames(spec: VideoSpec): number {
  return (
    framesOf(spec.intro.seconds, 3) +
    spec.scenes.reduce((a, s) => a + sceneFrames(s), 0) +
    framesOf(spec.outro.seconds, 4)
  );
}
