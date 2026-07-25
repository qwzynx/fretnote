import { invoke } from "@tauri-apps/api/core";
import { getGeniusToken } from "@/lib/genius-settings";

export interface GeniusHit {
  id: number;
  title: string;
  artist: string;
  url: string;
  thumbnailUrl?: string;
}

interface RawGeniusHit {
  id: number;
  title: string;
  artist: string;
  url: string;
  thumbnail_url?: string;
}

export async function searchGenius(query: string): Promise<GeniusHit[]> {
  const token = getGeniusToken();
  if (!token) return [];

  const hits = await invoke<RawGeniusHit[]>("genius_search", { token, query });
  return hits.map((h) => ({
    id: h.id,
    title: h.title,
    artist: h.artist,
    url: h.url,
    thumbnailUrl: h.thumbnail_url,
  }));
}

export async function getGeniusLyrics(url: string): Promise<string> {
  return invoke<string>("genius_get_lyrics", { url });
}
