
export const DIPLOY_BRAND = {
  name: 'Diploy',
  company: 'Bisht Technologies Private Limited',
  website: 'https://diploy.in',
  email: 'cs@diploy.in',
  copyright: '© 2025 Diploy',
  product: 'AgentLabs'
} as const;

export const DIPLOY_VERSION = {
  core: '1.0.0',
  api: 'v1',
  build: process.env.BUILD_NUMBER || 'dev'
} as const;

export const DIPLOY_HEADERS = {
  author: 'X-Author',
  version: 'X-Api-Version',
  requestId: 'X-Request-Id'
} as const;

export const DIPLOY_HEADER_KEY = DIPLOY_HEADERS.author;
export const DIPLOY_HEADER_VALUE = DIPLOY_BRAND.name;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;
