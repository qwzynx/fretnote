const KEY = "fretnote_recent";
const MAX = 10;

export function recordView(noteId: string): void {
  const ids = getRecentIds().filter((id) => id !== noteId);
  ids.unshift(noteId);
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {}
}

export function getRecentIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
