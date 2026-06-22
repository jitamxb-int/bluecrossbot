const raw = import.meta.env as Record<string, any>

export const ENV = {
  VITE_API_BASE_URL: raw.VITE_API_BASE_URL ? raw.VITE_API_BASE_URL + '/api/v1' : '',
}

export default ENV
