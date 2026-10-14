import { useEffect, useState } from 'react';
import { getAsset } from './db';

// Object URLs are cached for the lifetime of the page; assets are immutable once written.
const cache = new Map<string, Promise<string | null>>();

export function assetUrl(id: string): Promise<string | null> {
  let p = cache.get(id);
  if (!p) {
    p = getAsset(id).then((b) => (b ? URL.createObjectURL(b) : null));
    cache.set(id, p);
  }
  return p;
}

export function forgetAsset(id: string): void {
  const p = cache.get(id);
  cache.delete(id);
  p?.then((u) => u && URL.revokeObjectURL(u));
}

export function useAssetUrl(id: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!id) {
      setUrl(null);
      return;
    }
    assetUrl(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}
