/**
 * Generic composable HTTP/SSE primitives for REST APIs.
 *
 * @example
 *   import http from 'http';
 *   import { route, routes, jsonResponse } from '@yarkivaev/simple-server';
 *
 *   const api = routes([
 *     route('GET', '/health', async (req, res) => {
 *       jsonResponse({ ok: true }).send(res);
 *     })
 *   ]);
 *   http.createServer((req, res) => api.handle(req, res)).listen(3000);
 */

export { default as route } from './src/objects/route.js';
export { default as jsonResponse } from './src/objects/jsonResponse.js';
export { default as errorResponse } from './src/objects/errorResponse.js';
export { default as sseResponse } from './src/objects/sseResponse.js';
export { default as timeExpression } from './src/objects/timeExpression.js';
export { default as pagination } from './src/objects/pagination.js';
export { default as cursor } from './src/objects/cursor.js';
export { default as virtualClock } from './src/objects/virtualClock.js';

export { default as routes } from './src/server/routes.js';
export {
    parseRequestTimeoutMs,
    DEFAULT_REQUEST_TIMEOUT_MS,
    default as runWithRequestTimeout
} from './src/server/requestTimeout.js';
export { default as readBody } from './src/server/readBody.js';
export { default as sendRouteError } from './src/server/sendRouteError.js';
