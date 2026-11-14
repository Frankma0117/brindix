import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { fromRoot } from '../config/paths.js';

/**
 * Where the files live: this server's disk (data/files, served at /files) or, when DO_SPACES_* are
 * set, an S3-compatible bucket (public-read). A reference is the Spaces key, or "local:<folder>/<name>".
 * The networks download the media themselves (Meta, TikTok...), so both kinds are public on purpose.
 */
export const LOCAL_DIR = fromRoot('data', 'files');
const spaces = env.spaces;
let client: S3Client | undefined;

export const usesSpaces = (): boolean => !!(spaces.endpoint && spaces.bucket && spaces.accessKeyId && spaces.secretAccessKey);

function s3(): S3Client {
  if (!client) {
    const region = spaces.region || spaces.endpoint.match(/^https?:\/\/([a-z0-9-]+)\.digitaloceanspaces\.com/i)?.[1] || 'us-east-1';
    client = new S3Client({ endpoint: spaces.endpoint, region, credentials: { accessKeyId: spaces.accessKeyId, secretAccessKey: spaces.secretAccessKey } });
  }
  return client;
}

const folderOf = (folder: string) => `${spaces.prefix}${folder}/`;

function safeLocal(ref: string): string | null {
  const path = resolve(LOCAL_DIR, ref.slice(6));
  return path.startsWith(LOCAL_DIR + sep) ? path : null;
}

/** Stores bytes in a folder and returns the reference. */
export async function putFile(folder: string, name: string, data: Buffer, contentType: string): Promise<string> {
  if (usesSpaces()) {
    const key = `${folderOf(folder)}${name}`;
    await s3().send(new PutObjectCommand({ Bucket: spaces.bucket, Key: key, Body: data, ContentType: contentType, ACL: 'public-read', CacheControl: 'public, max-age=31536000, immutable' }));
    return key;
  }
  const path = join(LOCAL_DIR, folder, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  return `local:${folder}/${name}`;
}

/** Same, from a file already on disk (big uploads: never held in memory). The source is removed afterwards. */
export async function putFileFromPath(folder: string, name: string, sourcePath: string, contentType: string): Promise<string> {
  try {
    if (usesSpaces()) {
      const key = `${folderOf(folder)}${name}`;
      await s3().send(new PutObjectCommand({ Bucket: spaces.bucket, Key: key, Body: createReadStream(sourcePath), ContentLength: statSync(sourcePath).size, ContentType: contentType, ACL: 'public-read' }));
      return key;
    }
    const path = join(LOCAL_DIR, folder, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, readFileSync(sourcePath));
    return `local:${folder}/${name}`;
  } finally {
    rmSync(sourcePath, { force: true });
  }
}

export async function readFile(ref: string): Promise<Buffer | null> {
  if (ref.startsWith('local:')) {
    const path = safeLocal(ref);
    return path && existsSync(path) ? readFileSync(path) : null;
  }
  if (!ref) return null;
  const res = await fetch(publicUrl(ref), { signal: AbortSignal.timeout(5 * 60_000) }).catch(() => null);
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

/** Address the browser (and the networks) use. Local files are relative: see mediaAccess for the absolute one. */
export function publicUrl(ref: string | undefined | null): string {
  if (!ref) return '';
  if (ref.startsWith('local:')) return `${env.basePath}/files/${ref.slice(6)}`;
  return `https://${spaces.bucket}.${spaces.endpoint.replace(/^https?:\/\//, '')}/${ref}`;
}

/** Deletes every file of a folder. Best effort: a leftover is harmless. */
export async function deleteFolder(folder: string): Promise<void> {
  rmSync(join(LOCAL_DIR, folder), { recursive: true, force: true });
  if (!usesSpaces()) return;
  try {
    const prefix = folderOf(folder);
    const listed = await s3().send(new ListObjectsV2Command({ Bucket: spaces.bucket, Prefix: prefix }));
    const keys = (listed.Contents ?? []).map((o) => o.Key!).filter((k) => k.startsWith(prefix));
    if (keys.length) await s3().send(new DeleteObjectsCommand({ Bucket: spaces.bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }));
  } catch (err) {
    console.error('[STORAGE] Could not delete %s (harmless leftover):', folder, (err as Error).message);
  }
}
