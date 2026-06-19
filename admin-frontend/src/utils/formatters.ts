export function formatDate(isoString?: string): string {
  // TODO: format ISO date to locale string
  return isoString ?? '';
}

export function formatDuration(seconds: number): string {
  // TODO: convert to mm:ss or hh:mm:ss
  return `${seconds}s`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}hours ${m}mins` : `${h}hours`;
}

export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
