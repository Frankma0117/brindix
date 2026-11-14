import { useState } from 'react';
import { Check, Send, X } from 'lucide-react';
import type { Api } from '../../../services/api.ts';
import { errMsg } from '../../../services/api.ts';
import type { PublisherPost } from '../../../types/publisher.ts';
import { Card } from '../../atoms/Card.tsx';
import { Button } from '../../atoms/Button.tsx';
import { EmptyState } from '../../molecules/EmptyState.tsx';
import { useToast } from '../../molecules/Toast.tsx';

export interface PendingAsset {
  id: number;
  media: 'image' | 'video';
  title: string;
  caption: string;
  url: string;
  thumbUrl: string;
  source: 'upload' | 'url' | 'api';
  createdAt: string;
}

/**
 * «Por validar»: the videos and images the project's own software generated and sent. Nothing is published
 * until the administrator chooses it: publish it now, keep it in the library, or discard it.
 */
export function PendingPanel({ api, items, onChanged, onPublish }: { api: Api; items: PendingAsset[]; onChanged: () => void; onPublish: (post: PublisherPost) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<number | null>(null);

  async function act(id: number, action: 'publish' | 'approve' | 'discard') {
    setBusy(`${action}${id}`);
    try {
      const res = await api.post<{ post?: PublisherPost }>(`/api/admin/assets/${id}/validate`, { action });
      toast.success(action === 'publish' ? 'Listo: elige las redes y los textos.' : action === 'approve' ? 'Listo: quedó en la biblioteca.' : 'Descartado.');
      onChanged();
      if (action === 'publish' && res.post) onPublish(res.post);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(null);
      setAsking(null);
    }
  }

  if (!items.length) {
    return <EmptyState title="No hay nada por validar" description="Cuando el proyecto genere un video nuevo aparece aquí, y tú eliges cuál se publica." />;
  }
  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => (
        <Card key={a.id} className="overflow-hidden">
          {a.media === 'video' ? (
            <video src={a.url} poster={a.thumbUrl || undefined} controls playsInline preload="metadata" className="aspect-[9/16] w-full bg-black object-contain" />
          ) : (
            <img src={a.url} alt={a.title} className="max-h-[420px] w-full object-contain" />
          )}
          <div className="p-4">
            <p className="line-clamp-2 font-display font-extrabold text-ink dark:text-white">{a.title}</p>
            {a.caption && <p className="mt-1 line-clamp-3 text-sm text-gray-dark">{a.caption}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" loading={busy === `publish${a.id}`} onClick={() => void act(a.id, 'publish')}>
                <Send size={13} /> Publicar este
              </Button>
              <Button size="sm" variant="secondary" loading={busy === `approve${a.id}`} onClick={() => void act(a.id, 'approve')}>
                <Check size={13} /> Guardar
              </Button>
              {asking === a.id ? (
                <span className="ml-auto flex items-center gap-1.5 text-xs">
                  ¿Descartar?
                  <Button size="sm" variant="danger" loading={busy === `discard${a.id}`} onClick={() => void act(a.id, 'discard')}>
                    Sí
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                    No
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAsking(a.id)}>
                  <X size={13} /> Descartar
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
