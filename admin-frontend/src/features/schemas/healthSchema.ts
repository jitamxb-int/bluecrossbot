export const healthResponseShape = {
  status:      { type: 'string', expected: 'ok' },
  service:     { type: 'string' },
  environment: { type: 'string' },
  version:     { type: 'string' },
};

export const readinessResponseShape = {
  status: { type: 'string', oneOf: ['ready', 'degraded'] },
  qdrant: { type: 'string' },
};
