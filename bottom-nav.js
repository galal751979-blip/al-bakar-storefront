import { logClientError } from './client-logger.js';

document.addEventListener('DOMContentLoaded', initializeBottomNavigation, { once: true });

function initializeBottomNavigation() {
  if (document.querySelector('.bakar-bottom-nav')) return;

  const currentPage = getCurrentPage();
  const navigation = document.createElement('nav');
  navigation.className = 'bakar-bottom-nav floating-nav';
  navigation.setAttribute('aria-label', 'التنقل الرئيسي');
  navigation.innerHTML = `
    <a class="nav-item" href="index.html" data-page="home" aria-label="الرئيسية">
      <i class="fas fa-house icon" aria-hidden="true"></i><span class="name">الرئيسية</span>
    </a>
    <a class="nav-item" href="products.html" data-page="products" aria-label="المنتجات">
      <i class="fas fa-box-open icon" aria-hidden="true"></i><span class="name">المنتجات</span>
    </a>
    <a class="nav-item" href="offers.html" data-page="offers" aria-label="العروض">
      <i class="fas fa-tags icon" aria-hidden="true"></i><span class="name">العروض</span>
    </a>
    <a class="nav-item" href="cart.html" data-page="cart" aria-label="السلة">
      <i class="fas fa-bag-shopping icon" aria-hidden="true"></i><span class="name">السلة</span>
      <span class="bakar-bottom-nav-count cart-count" aria-live="polite">0</span>
    </a>
    <a class="nav-item" href="contact.html" data-page="contact" aria-label="تواصل معنا">
      <i class="fas fa-headset icon" aria-hidden="true"></i><span class="name">تواصل</span>
    </a>
  `;

  const activeLink = navigation.querySelector(`[data-page="${currentPage}"]`);
  activeLink?.setAttribute('aria-current', 'page');

  let navigationPending = false;
  navigation.addEventListener('click', event => {
    const link = event.target.closest('a.nav-item');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === '_blank' || link.hasAttribute('download') || link.origin !== window.location.origin) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    event.preventDefault();
    if (navigationPending) return;

    navigationPending = true;
    link.classList.add('is-bouncing');
    window.setTimeout(() => window.location.assign(link.href), 520);
  });

  document.body.append(navigation);
  updateBottomNavCartCount();
  window.addEventListener('storage', event => {
    if (event.key === 'bakar_cart') updateBottomNavCartCount();
  });

}

function getCurrentPage() {
  const fileName = window.location.pathname.split('/').pop()?.toLowerCase();
  if (!fileName || fileName === 'index.html') return 'home';
  if (fileName === 'product.html' || fileName === 'products.html') return 'products';
  if (fileName === 'offer.html' || fileName === 'offers.html') return 'offers';
  if (fileName === 'cart.html' || fileName === 'checkout.html') return 'cart';
  if (fileName === 'contact.html') return 'contact';
  return 'home';
}

function updateBottomNavCartCount() {
  let total = 0;
  try {
    const cart = JSON.parse(localStorage.getItem('bakar_cart') || '[]');
    if (Array.isArray(cart)) {
      total = cart.reduce((sum, item) => sum + (Number.parseInt(item?.qty, 10) || 1), 0);
    }
  } catch (error) {
    logClientError('navigation.cart_count.read_failed', error);
  }
  document.querySelectorAll('.bakar-bottom-nav-count').forEach(badge => {
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.hidden = total === 0;
  });
}
