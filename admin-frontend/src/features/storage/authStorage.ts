const AUTH_KEY = 'bcb_admin_tokens'

export interface StoredTokens {
  accessToken: string
  refreshToken?: string
}

export function getStoredTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as StoredTokens) : null
  } catch {
    return null
  }
}

export function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(tokens))
}

export function clearTokens(): void {
  localStorage.removeItem(AUTH_KEY)
}
