const STORAGE_KEY = 'bakar_wishlist';

export function getWishlist() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
  } catch {
    return [];
  }
}

export function isWishlisted(productId) {
  return getWishlist().includes(String(productId));
}

export function toggleWishlist(productId) {
  const id = String(productId || '');
  if (!id) return false;
  const items = getWishlist();
  const index = items.indexOf(id);
  const isSaved = index === -1;
  if (isSaved) items.push(id);
  else items.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('bakar:wishlist-change', { detail: { ids: items } }));
  return isSaved;
}
