export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeImageUrl(value, fallback = 'assets/images/placeholder.svg') {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  // Some products store images directly as base64 data URLs.
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/]+={0,2}$/i.test(raw)) {
    return raw;
  }

  try {
    const assetPath = raw.startsWith('/') && !raw.startsWith('//') ? raw.slice(1) : raw;
    const url = new URL(assetPath, document.baseURI);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}
