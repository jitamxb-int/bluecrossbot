export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidUrl(value: string): boolean {
  // TODO: validate URL format
  return true;
}

export function isAllowedExtension(filename: string, allowed: string[]): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return allowed.includes(ext);
}
