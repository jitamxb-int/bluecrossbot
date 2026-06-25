export const ROUTES = {
  UPLOAD: '/upload',
  MANAGE: '/manage',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
