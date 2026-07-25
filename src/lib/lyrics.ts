import { similarity } from "@/lib/text-similarity";
import { searchGenius, getGeniusLyrics } from "@/lib/genius";

function pickBest(
  data: { trackName?: string; artistName?: string; plainLyrics?: string }[],
  artist: string,
  title: string,
): string | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  let best = data[0];
  let bestScore = -1;
  for (const item of data) {
    const titleScore = similarity(item.trackName ?? "", title);
    const artistScore = similarity(item.artistName ?? "", artist);
    const score = titleScore * 0.6 + artistScore * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best?.plainLyrics ?? null;
}

async function tryGenius(artist: string, title: string): Promise<string | null> {
  try {
    const hits = await searchGenius(`${title} ${artist}`.trim());
    if (hits.length === 0) return null;

    let best = hits[0];
    let bestScore = -1;
    for (const hit of hits) {
      const score = similarity(hit.title, title) * 0.6 + similarity(hit.artist, artist) * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = hit;
      }
    }

    const lyrics = await getGeniusLyrics(best.url);
    return lyrics || null;
  } catch {
    return null;
  }
}

export async function fetchLyrics(artist: string, title: string): Promise<string | null> {
  const headers = { "User-Agent": "Fretnote/1.0 (https://github.com/fretnote)" };

  // 0. Genius (if a token is configured)
  const geniusLyrics = await tryGenius(artist, title);
  if (geniusLyrics) return geniusLyrics;

  // 1. lrclib — artist + title
  try {
    const url = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      const lyrics = pickBest(data, artist, title);
      if (lyrics) return lyrics;
    }
  } catch { /* fall through */ }

  // 2. lrclib — title only (catches artist typos)
  try {
    const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      const lyrics = pickBest(data, artist, title);
      if (lyrics) return lyrics;
    }
  } catch { /* fall through */ }

  // 3. lyrics.ovh fallback
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics) return data.lyrics as string;
    }
  } catch { /* all sources failed */ }

  return null;
}
