const env = import.meta.env;
import { logClientError } from './client-logger.js';

const useLocalViteApiProxy = env.DEV
  && typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const supabaseUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim().replace(/\/+$/, '') : '';
const defaultApiBaseUrl = useLocalViteApiProxy
  ? '/api'
  : `${supabaseUrl || 'https://boeclmicaowgehrxhifx.supabase.co'}/functions/v1/store-api`;
const configuredApiBaseUrl = typeof env.VITE_API_BASE_URL === 'string' && env.VITE_API_BASE_URL.trim()
  ? env.VITE_API_BASE_URL.trim()
  : defaultApiBaseUrl;
const apiBaseUrl = useLocalViteApiProxy
  ? '/api'
  : configuredApiBaseUrl.replace(/\/+$/, '');
const usesSupabaseFunction = /\/functions\/v1\/store-api$/i.test(apiBaseUrl);
const supabasePublicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || supabasePublicKey;

const supportedRoutes = new Set([
  'GET /products',
  'GET /products-page',
  'GET /products-banners',
  'GET /categories',
  'GET /offers',
  'GET /shipping',
  'GET /app-update',
  'GET /order-status',
  'POST /create-order'
]);

async function callStoreApi(path, options) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...options.headers };
  if (usesSupabaseFunction && supabasePublicKey) headers.apikey ||= supabasePublicKey;
  if (usesSupabaseFunction && supabaseAnonKey) headers.Authorization ||= `Bearer ${supabaseAnonKey}`;
  const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  headers['X-Request-Id'] = requestId;
  if (options.body != null && !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'omit'
    });
  } catch (error) {
    const requestError = new Error('تعذر الاتصال بخادم المتجر. تحقق من الإنترنت وحاول مرة أخرى.', { cause: error });
    requestError.requestId = requestId;
    logClientError('api.transport.failed', error, { request_id: requestId, method, route: path.split('?')[0] });
    throw requestError;
  }

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const message = result && typeof result.error === 'string'
      ? result.error
      : `تعذر إتمام الطلب من خادم المتجر (HTTP ${response.status}).`;
    const requestError = new Error(message);
    requestError.requestId = requestId;
    requestError.status = response.status;
    throw requestError;
  }

  if (result === null && response.status !== 204) {
    const requestError = new Error('استجابة خادم المتجر غير صالحة. حاول مرة أخرى.');
    requestError.requestId = requestId;
    throw requestError;
  }
  return result;
}

export async function apiFetch(path, options = {}) {
  let url;
  try {
    url = new URL(path, 'https://store-api.invalid');
  } catch (error) {
    throw new Error('مسار طلب API غير صالح.', { cause: error });
  }

  const method = (options.method || 'GET').toUpperCase();
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (supportedRoutes.has(`${method} ${pathname}`)) {
    return callStoreApi(`${pathname}${url.search}`, options);
  }

  throw new Error(`مسار API غير مدعوم: ${method} ${pathname}.`);
}

export async function getProducts(ids) {
  if (!Array.isArray(ids)) return apiFetch('/products');
  const uniqueIds = [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))].sort();
  const products = [];
  for (let start = 0; start < uniqueIds.length; start += 40) {
    const params = new URLSearchParams();
    uniqueIds.slice(start, start + 40).forEach(id => params.append('id', id));
    const result = await apiFetch(`/products?${params}`);
    if (Array.isArray(result)) products.push(...result);
  }
  return products;
}
export const getProductsPage = ({ categoryId, categoryName, cursor } = {}) => {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  if (categoryName) params.set('categoryName', categoryName);
  if (cursor) params.set('cursor', cursor);
  const search = params.toString();
  return apiFetch(`/products-page${search ? `?${search}` : ''}`);
};
export const getCategories = () => apiFetch('/categories');
export const getAppUpdateStatus = () => apiFetch('/app-update');
export async function getProductsPageBanners() {
  try {
    const banners = await apiFetch('/products-banners');
    return Array.isArray(banners)
      ? banners.filter(banner => banner && banner.is_active !== false && typeof banner.url === 'string' && banner.url.startsWith('https://'))
      : [];
  } catch (error) {
    // Banners are optional; older backend deployments should not block the catalog.
    if (error?.status === 404) return [];
    throw error;
  }
}
export const getTrackedOrder = async orderCode => {
  const result = await apiFetch(`/order-status?orderCode=${encodeURIComponent(orderCode)}`);
  return result.order;
};
