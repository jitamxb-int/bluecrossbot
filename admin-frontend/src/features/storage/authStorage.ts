const AUTH_KEY = 'bcb_admin_tokens'
const EMAIL_KEY = 'bcb_admin_email'

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

/** True only when a real access token is stored (rejects empty/garbage values). */
export function isAuthenticated(): boolean {
  return !!getStoredTokens()?.accessToken
}

export function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(tokens))
}

export function clearTokens(): void {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(EMAIL_KEY)
}

// Persisted logged-in admin email — so the Change Credentials page has it after reload.
export function getAdminEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY)
}

export function saveAdminEmail(email: string): void {
  localStorage.setItem(EMAIL_KEY, email)
}
