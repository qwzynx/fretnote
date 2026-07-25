const GENIUS_TOKEN_KEY = "fretnote_genius_token";

export function getGeniusToken(): string {
  return localStorage.getItem(GENIUS_TOKEN_KEY) ?? "";
}

export function saveGeniusToken(token: string): void {
  localStorage.setItem(GENIUS_TOKEN_KEY, token.trim());
}
