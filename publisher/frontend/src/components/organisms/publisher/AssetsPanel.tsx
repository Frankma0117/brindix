import { useRef, useState } from 'react';
import { Link2, Trash2, Upload } from 'lucide-react';
import type { Api } from '../../../services/api.ts';
import { errMsg } from '../../../services/api.ts';
import { Card } from '../../atoms/Card.tsx';
import { Button } from '../../atoms/Button.tsx';
import { Hint, Input, Label } from '../../atoms/Input.tsx';
import { useToast } from '../../molecules/Toast.tsx';

export interface LibraryAsset {
  id: number;
  media: 'image' | 'video';
  title: string;
  url: string;
  source: 'upload' | 'url' | 'api';
  usedCount: number;
}

/** Adds files to the library: upload from this device, or import from a link. */
export function AssetsAdder({ api, onAdded }: { api: Api; onAdded: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'upload' | 'import' | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy('upload');
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('file', file, file.name);
      await api.uploadForm('/api/admin/assets', form);
      toast.success('Listo: el archivo quedó en la biblioteca.');
      setTitle('');
      onAdded();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function importUrl() {
    setBusy('import');
    try {
      await api.post('/api/admin/assets/import', { url, title });
      toast.success('Listo: el archivo se descargó y quedó en la biblioteca.');
      setUrl('');
      setTitle('');
      onAdded();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-extrabold text-ink dark:text-white">Agregar a la biblioteca</h2>
      <p className="mb-4 mt-1 text-sm text-gray-dark">Sube tus videos e imágenes (MP4, MOV, WEBM, JPG, PNG, WEBP; hasta 300 MB). Desde aquí los programas, o la automatización los publica por turnos.</p>
      <div className="mb-4">
        <Label htmlFor="as-title">Título (opcional)</Label>
        <Input id="as-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Cómo preparar un mojito" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        <Button onClick={() => input.current?.click()} loading={busy === 'upload'}>
          <Upload size={16} /> Subir un archivo
        </Button>
      </div>
      <div className="mt-5 border-t border-gray-medium pt-4 dark:border-white/10">
        <Label htmlFor="as-url">O desde un enlace (https)</Label>
        <div className="flex flex-wrap gap-2">
          <Input id="as-url" className="min-w-0 flex-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/video.mp4" />
          <Button variant="secondary" onClick={importUrl} loading={busy === 'import'} disabled={!url.trim()}>
            <Link2 size={16} /> Traer
          </Button>
        </div>
        <Hint>El archivo se descarga y se guarda aquí. Para Instagram y TikTok, los videos deben ser MP4 (H.264).</Hint>
      </div>
    </Card>
  );
}

/** The files already in the library, with delete. */
export function AssetsList({ api, assets, onChanged }: { api: Api; assets: LibraryAsset[]; onChanged: () => void }) {
  const toast = useToast();
  const [asking, setAsking] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function remove(id: number) {
    setBusy(id);
    try {
      await api.del(`/api/admin/assets/${id}`);
      toast.success('Borrado.');
      onChanged();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(null);
      setAsking(null);
    }
  }

  if (!assets.length) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-extrabold text-ink dark:text-white">
        Biblioteca <span className="text-gray-dark">({assets.length})</span>
      </h2>
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {assets.map((a) => (
          <Card key={a.id} className="overflow-hidden">
            {a.media === 'video' ? <video src={a.url} muted playsInline preload="metadata" className="aspect-[9/16] w-full bg-black object-cover" /> : <img src={a.url} alt={a.title} className="aspect-square w-full object-cover" />}
            <div className="p-3">
              <p className="line-clamp-2 text-sm font-semibold text-ink dark:text-white">{a.title}</p>
              <p className="text-xs text-gray-dark">
                {a.source === 'api' ? 'Enviado por el proyecto' : a.source === 'url' ? 'Desde un enlace' : 'Subido'}
                {a.usedCount > 0 ? ` · publicado ${a.usedCount} ${a.usedCount === 1 ? 'vez' : 'veces'} por la automatización` : ''}
              </p>
              <div className="mt-2 flex justify-end">
                {asking === a.id ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    ¿Borrar?
                    <Button size="sm" variant="danger" loading={busy === a.id} onClick={() => void remove(a.id)}>
                      Sí
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                      No
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" aria-label="Borrar" onClick={() => setAsking(a.id)}>
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
