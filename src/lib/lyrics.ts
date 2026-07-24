function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let overlap = 0;
  for (const g of ba) if (bb.has(g)) overlap++;
  return (2 * overlap) / (ba.size + bb.size);
}

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

export async function fetchLyrics(artist: string, title: string): Promise<string | null> {
  const headers = { "User-Agent": "Fretnote/1.0 (https://github.com/fretnote)" };

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
