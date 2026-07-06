export interface LoginRequest {
  email: string
  password: string
}

export interface Tokens {
  accessToken: string
  refreshToken?: string
}

export interface AdminInfo {
  email: string
}

// Envelope returned by POST /auth/login (matches the httpClient token contract).
export interface LoginResponse {
  success: boolean
  message: string
  timestamp: string
  data: {
    tokens: Tokens
    user: AdminInfo
  }
}

export interface ChangePasswordRequest {
  email: string
  current_password: string
  new_password: string
  confirm_new_password: string
}

export interface ChangePasswordResponse {
  success: boolean
  message: string
}
