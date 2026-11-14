import { db } from '../../database/connection.js';

export interface Asset {
  id: number;
  media: 'image' | 'video';
  title: string;
  caption: string;
  file_ref: string;
  thumb_ref: string;
  source: 'upload' | 'url' | 'api';
  ref: string;
  used_count: number;
  last_used_at: string | null;
  archived: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export const assetsStore = {
  create(a: { media: 'image' | 'video'; title: string; caption: string; fileRef: string; thumbRef?: string; source: Asset['source']; ref?: string; status?: Asset['status'] }): number {
    return Number(
      db.prepare('INSERT INTO assets (media, title, caption, file_ref, thumb_ref, source, ref, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(a.media, a.title, a.caption, a.fileRef, a.thumbRef ?? '', a.source, a.ref ?? '', a.status ?? 'approved').lastInsertRowid,
    );
  },
  get(id: number): Asset | undefined {
    return db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as Asset | undefined;
  },
  byRef(ref: string): Asset | undefined {
    return ref ? (db.prepare('SELECT * FROM assets WHERE ref = ?').get(ref) as Asset | undefined) : undefined;
  },
  /** The library: what the administrator already validated. */
  list(): Asset[] {
    return db.prepare(`SELECT * FROM assets WHERE archived = 0 AND status = 'approved' ORDER BY id DESC`).all() as Asset[];
  },
  /** «Por validar»: what the project's software sent and nobody has chosen yet. */
  pending(): Asset[] {
    return db.prepare(`SELECT * FROM assets WHERE status = 'pending' ORDER BY id DESC`).all() as Asset[];
  },
  setStatus(id: number, status: Asset['status']): void {
    db.prepare('UPDATE assets SET status = ? WHERE id = ?').run(status, id);
  },
  update(id: number, title: string, caption: string): void {
    db.prepare('UPDATE assets SET title = ?, caption = ? WHERE id = ?').run(title, caption, id);
  },
  setThumb(id: number, thumbRef: string): void {
    db.prepare('UPDATE assets SET thumb_ref = ? WHERE id = ?').run(thumbRef, id);
  },
  delete(id: number): void {
    db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  },
  /** The video the automation should publish next: the one used the fewest times, then the oldest. */
  nextVideo(): Asset | undefined {
    return db.prepare(`SELECT * FROM assets WHERE media = 'video' AND archived = 0 AND status = 'approved' ORDER BY used_count ASC, COALESCE(last_used_at, '') ASC, id ASC LIMIT 1`).get() as Asset | undefined;
  },
  availableVideos(): number {
    return (db.prepare(`SELECT COUNT(*) AS n FROM assets WHERE media = 'video' AND archived = 0 AND status = 'approved'`).get() as { n: number }).n;
  },
  markUsed(id: number): void {
    db.prepare(`UPDATE assets SET used_count = used_count + 1, last_used_at = datetime('now') WHERE id = ?`).run(id);
  },
};
