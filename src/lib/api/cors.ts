import { NextResponse } from 'next/server';

export interface CorsOptions {
  origin: string | string[];
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
}

const defaultOptions: CorsOptions = {
  origin: process.env.NODE_ENV === 'development' ? '*' : 'https://yourdomain.com',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

/**
 * Applies CORS headers to a response
 * @param response The response to add headers to
 * @param options CORS options
 * @returns Response with CORS headers
 */
export function applyCors(
  response: NextResponse,
  options: Partial<CorsOptions> = {}
): NextResponse {
  const opts = { ...defaultOptions, ...options };

  const origin = Array.isArray(opts.origin) ? opts.origin.join(',') : opts.origin;

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', opts.methods.join(','));
  response.headers.set('Access-Control-Allow-Headers', opts.allowedHeaders.join(','));

  if (opts.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

/**
 * Handles CORS preflight requests
 * @param options CORS options
 * @returns NextResponse for OPTIONS requests
 */
export function handleCorsPrelight(options: Partial<CorsOptions> = {}): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return applyCors(response, options);
}
