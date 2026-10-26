import { safeImageUrl } from './html-utils.js';
import { logClientError } from './client-logger.js';

const CART_KEY = 'bakar_cart';
const MAX_QUANTITY = 99;
let cartItems = [];

document.addEventListener('DOMContentLoaded', initializeCartPage, { once: true });
window.addEventListener('storage', event => {
  if (event.key === CART_KEY) initializeCartPage();
});
window.addEventListener('resize', updateCartLayout, { passive: true });

function initializeCartPage() {
  cartItems = readCart();
  document.getElementById('cartLoadingState')?.remove();
  setupCartActions();
  renderCartPage();
}

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCartItem).filter(Boolean);
  } catch (error) {
    logClientError('cart.read.failed', error);
    return [];
  }
}

function normalizeCartItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const rawId = item.id ?? item.productId;
  if (rawId == null || String(rawId).trim() === '') return null;

  const rawQuantity = Number.parseInt(item.qty ?? item.quantity ?? 1, 10);
  const quantity = Number.isInteger(rawQuantity) && rawQuantity > 0
    ? Math.min(rawQuantity, MAX_QUANTITY)
    : 1;
  const rawPrice = Number(item.price);
  const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null;

  return {
    ...item,
    id: String(rawId),
    name: String(item.name ?? item.title ?? 'منتج بدون اسم'),
    price,
    qty: quantity,
    image: safeImageUrl(String(item.image || item.image_urls?.[0] || item.image_url || '')),
    isOffer: Boolean(item.isOffer || String(rawId).startsWith('offer_'))
  };
}

function setupCartActions() {
  const container = document.getElementById('cartItemsContainer');
  if (!container || container.dataset.actionsReady === 'true') return;
  container.dataset.actionsReady = 'true';
  container.addEventListener('click', handleCartAction);

  document.querySelectorAll('a[href="checkout.html"]').forEach(link => {
    link.addEventListener('click', event => {
      if (!cartItems.some(item => item.price === null)) return;
      event.preventDefault();
      window.alert('يوجد منتج بلا سعر صالح. احذفه أو حدّث سعره قبل إتمام الشراء.');
    });
  });
}

function handleCartAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const index = Number.parseInt(button.dataset.index, 10);
  if (!Number.isInteger(index) || !cartItems[index]) return;

  if (button.dataset.action === 'increase') {
    if (cartItems[index].qty >= MAX_QUANTITY) return;
    cartItems[index].qty += 1;
    saveCart();
    return;
  }

  if (button.dataset.action === 'decrease') {
    if (cartItems[index].qty <= 1) return;
    cartItems[index].qty -= 1;
    saveCart();
    return;
  }

  if (button.dataset.action === 'remove') {
    const card = button.closest('.cart-item-card');
    button.disabled = true;
    card?.classList.add('removing');
    window.setTimeout(() => {
      cartItems.splice(index, 1);
      saveCart();
    }, 300);
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    renderCartPage();
  } catch (error) {
    logClientError('cart.update.failed', error);
    window.alert('تعذر حفظ السلة على هذا الجهاز.');
  }
}

function renderCartPage() {
  const container = document.getElementById('cartItemsContainer');
  if (!container) return;
  container.replaceChildren();

  if (cartItems.length === 0) {
    showEmptyCart();
    updateCartBadge();
    return;
  }

  document.getElementById('emptyCartScreen').style.display = 'none';
  cartItems.forEach((item, index) => container.append(createCartItemCard(item, index)));
  updateCartLayout();
  updateCartSummary();
  updateCartBadge();
  updateItemCount();
}

function createCartItemCard(item, index) {
  const card = document.createElement('article');
  card.className = 'cart-item-card';
  card.id = `cartItemRow_${index}`;
  card.style.animation = `fadeInUp 0.5s ease backwards ${Math.min(index, 10) * 0.1}s`;

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'item-img-wrapper';
  const image = document.createElement('img');
  image.src = item.image;
  image.alt = item.name;
  image.onerror = () => {
    image.onerror = null;
    image.src = 'assets/images/placeholder.svg';
  };
  imageWrapper.append(image);

  const info = document.createElement('div');
  info.className = 'item-info';
  if (item.isOffer) {
    const offerLabel = document.createElement('span');
    offerLabel.textContent = 'باقة عرض حصري';
    offerLabel.style.cssText = 'color:var(--burgundy);font-size:0.8rem;font-weight:700;margin-bottom:5px;display:block';
    info.append(offerLabel);
  }

  const title = document.createElement('h3');
  title.className = 'item-title';
  title.textContent = item.name;
  const unitPrice = document.createElement('div');
  unitPrice.className = 'item-price-unit';
  unitPrice.textContent = item.price === null
    ? 'السعر غير متاح'
    : `${item.price.toLocaleString('ar-EG')} ج.م للوحدة`;

  const actions = document.createElement('div');
  actions.className = 'item-actions-row';
  const quantityControl = document.createElement('div');
  quantityControl.className = 'qty-control';
  quantityControl.append(
    createActionButton('decrease', index, '−', 'تقليل الكمية', item.qty <= 1),
    createQuantityDisplay(item.qty),
    createActionButton('increase', index, '+', 'زيادة الكمية', item.qty >= MAX_QUANTITY)
  );

  const itemTotal = document.createElement('div');
  itemTotal.className = 'item-price-total';
  itemTotal.textContent = item.price === null
    ? '—'
    : `${(item.price * item.qty).toLocaleString('ar-EG')} ج.م`;
  actions.append(quantityControl, itemTotal);
  info.append(title, unitPrice, actions);

  const removeButton = createActionButton('remove', index, '', `حذف ${item.name}`, false);
  removeButton.className = 'btn-remove';
  const trashIcon = document.createElement('i');
  trashIcon.className = 'fas fa-trash-alt';
  trashIcon.setAttribute('aria-hidden', 'true');
  removeButton.append(trashIcon);

  card.append(imageWrapper, info, removeButton);
  return card;
}

function createActionButton(action, index, label, accessibleName, disabled) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = action === 'remove' ? 'btn-remove' : 'qty-btn';
  button.dataset.action = action;
  button.dataset.index = String(index);
  button.textContent = label;
  button.setAttribute('aria-label', accessibleName);
  button.disabled = disabled;
  return button;
}

function createQuantityDisplay(quantity) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'qty-input';
  input.value = String(quantity);
  input.readOnly = true;
  input.setAttribute('aria-label', 'الكمية');
  return input;
}

function updateCartSummary() {
  const subtotal = cartItems.reduce((sum, item) => item.price === null
    ? sum
    : sum + item.price * item.qty, 0);
  const subtotalText = `${subtotal.toLocaleString('ar-EG')} ج.م`;
  ['summarySubtotal', 'summaryTotal', 'mobileSummaryTotal'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = subtotalText;
  });

  const hasInvalidPrice = cartItems.some(item => item.price === null);
  const warning = document.getElementById('cartPriceWarning');
  if (warning) warning.style.display = hasInvalidPrice ? 'block' : 'none';
}

function updateItemCount() {
  const count = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const label = document.getElementById('cartItemCountText');
  if (label) label.textContent = `لديك ${count} منتج في السلة.`;
}

function updateCartBadge() {
  const count = cartItems.reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('.cart-count').forEach(badge => {
    badge.textContent = count > 99 ? '99+' : String(count);
  });
}

function showEmptyCart() {
  document.getElementById('cartMainLayout').style.display = 'none';
  document.getElementById('mobileStickyCheckout').style.display = 'none';
  document.getElementById('emptyCartScreen').style.display = 'block';
  document.getElementById('cartItemCountText').textContent = 'سلة التسوق فارغة حالياً.';
  const warning = document.getElementById('cartPriceWarning');
  if (warning) warning.style.display = 'none';
}

function updateCartLayout() {
  if (cartItems.length === 0) return;
  const isMobile = window.matchMedia('(max-width: 992px)').matches;
  document.getElementById('cartMainLayout').style.display = isMobile ? 'flex' : 'grid';
  document.getElementById('mobileStickyCheckout').style.display = isMobile ? 'flex' : 'none';
}
