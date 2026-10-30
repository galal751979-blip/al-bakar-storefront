import './bottom-nav.js';
import { getAppUpdateStatus } from './api.js';

const forcedUpdateStorageKey = 'bk-forced-update-revision';
let forcedUpdateCheckRunning = false;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initMobileMenu();
  updateCartCount();
  startForcedUpdateChecks();
});

function startForcedUpdateChecks() {
  if (typeof window === 'undefined') return;
  const check = () => {
    if (document.visibilityState === 'visible') void checkForcedUpdate();
  };
  window.addEventListener('storage', event => {
    if (event.key !== forcedUpdateStorageKey || !event.newValue || forcedUpdateCheckRunning) return;
    forcedUpdateCheckRunning = true;
    void applyForcedUpdate();
  });
  check();
  window.setInterval(check, 90_000);
  document.addEventListener('visibilitychange', check);
}

async function checkForcedUpdate() {
  if (forcedUpdateCheckRunning) return;
  try {
    const update = await getAppUpdateStatus();
    if (update?.forceUpdate !== true || !update.revision) return;
    let appliedRevision = '';
    try { appliedRevision = localStorage.getItem(forcedUpdateStorageKey) || ''; } catch { /* Storage can be disabled. */ }
    if (String(update.revision) === appliedRevision) return;
    forcedUpdateCheckRunning = true;
    try { localStorage.setItem(forcedUpdateStorageKey, String(update.revision)); } catch { /* Continue with the update for this session. */ }
    await applyForcedUpdate();
  } catch (error) {
    // Update checks are best-effort and must never interrupt shopping.
  }
}

async function applyForcedUpdate() {
  const controller = navigator.serviceWorker?.controller;
  let registration = null;
  try { registration = await navigator.serviceWorker?.getRegistration(); } catch { /* A browser may block service worker access. */ }
  if (registration) {
    const controllerChanged = controller
      ? new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
      : Promise.resolve();
    try { await registration.update(); } catch { /* Reload below still picks up network-hosted files. */ }
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    await Promise.race([
      controllerChanged,
      new Promise(resolve => window.setTimeout(resolve, registration.waiting || registration.installing ? 8000 : 1500))
    ]);
  }
  window.location.reload();
}

function initThemeToggle() {
  const headerInner = document.querySelector('.site-header .header-inner');
  if (!headerInner || headerInner.querySelector('[data-theme-toggle]')) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'theme-toggle';
  toggle.dataset.themeToggle = '';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.innerHTML = '<i class="fas fa-moon" aria-hidden="true"></i><span>داكن</span>';

  const actions = headerInner.querySelector('.header-actions');
  if (actions) {
    actions.prepend(toggle);
  } else {
    toggle.classList.add('theme-toggle-standalone');
    headerInner.append(toggle);
  }

  const updateToggle = () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن');
    toggle.title = isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن';
    toggle.innerHTML = isDark
      ? '<i class="fas fa-sun" aria-hidden="true"></i><span>فاتح</span>'
      : '<i class="fas fa-moon" aria-hidden="true"></i><span>داكن</span>';
  };

  toggle.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem('bakar-theme', nextTheme);
    } catch {
      // Keep the selected mode for this page even if storage is unavailable.
    }
    updateToggle();
  });

  updateToggle();
}

function initMobileMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');

  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mainNav.classList.toggle('open');
      menuToggle.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (mainNav.classList.contains('open') && !mainNav.contains(e.target) && e.target !== menuToggle) {
        mainNav.classList.remove('open');
        menuToggle.classList.remove('active');
      }
    });

    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        menuToggle.classList.remove('active');
      });
    });
  }
}

function getCart() {
  try {
    const data = localStorage.getItem('bakar_cart');
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(item => {
      if (!item || typeof item !== 'object') return null;

      return {
        ...item,
        id: String(item.id || item.productId || Date.now()),
        name: String(item.name || item.title || 'منتج بدون اسم'),
        price: parseFloat(item.price) || 0,
        qty: parseInt(item.qty || item.quantity || 1, 10),
        image: item.image || item.image_url || 'assets/images/placeholder.svg'
      };
    }).filter(item => item !== null && item.price > 0);
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('bakar_cart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const cart = getCart();
  const totalCount = cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
  
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = totalCount;
  });
}

function addToCart(product) {
  if (!product || !product.price || parseFloat(product.price) <= 0) return;
  
  const cart = getCart();
  const productId = String(product.id || Date.now());
  const existingIndex = cart.findIndex(item => String(item.id) === productId);

  if (existingIndex > -1) {
    if (cart[existingIndex].qty >= 99) {
      showToast('الحد الأقصى 99 قطعة من المنتج الواحد.');
      return;
    }
    cart[existingIndex].qty += 1;
  } else {
    cart.push({
      ...product,
      id: productId,
      name: String(product.name || 'منتج'),
      price: parseFloat(product.price),
      image: product.image || product.image_url || 'assets/images/placeholder.svg',
      qty: 1
    });
  }

  saveCart(cart);
  showToast('تمت الإضافة إلى السلة بنجاح 🛒');
  
  document.querySelectorAll('.cart-count').forEach(el => {
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 300);
  });
}

window.addToCart = addToCart;

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

