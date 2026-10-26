import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  const [repositoryOwner = '', repositoryName = ''] = (process.env.GITHUB_REPOSITORY || '').split('/');
  const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';
  const isUserSite = repositoryName.toLowerCase() === `${repositoryOwner}.github.io`.toLowerCase();
  const defaultBase = isGitHubPagesBuild && repositoryName && !isUserSite ? `/${repositoryName}/` : '/';
  const requestedBase = env.VITE_BASE_PATH || defaultBase;
  const base = `/${requestedBase.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
  const siteOrigin = (env.VITE_SITE_ORIGIN || (isGitHubPagesBuild && repositoryOwner ? `https://${repositoryOwner}.github.io` : '')).replace(/\/+$/, '');
  const siteRoot = siteOrigin ? new URL(base, `${siteOrigin}/`).href : '';
  const supabaseUrl = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  const anonKey = env.VITE_SUPABASE_ANON_KEY || publishableKey;
  const useSupabaseProxy = Boolean(supabaseUrl && publishableKey);

  let outputDir = resolve(root, 'dist');
  const githubPagesMetadata = {
    name: 'github-pages-metadata',
    apply: 'build',
    configResolved(config) {
      outputDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      if (!siteRoot) return;
      const sitePrefix = siteRoot.replace(/\/+$/, '');
      for (const entry of await readdir(outputDir, { withFileTypes: true })) {
        if (!entry.isFile() || !/\.(?:html|xml|txt)$/i.test(entry.name)) continue;
        const filePath = resolve(outputDir, entry.name);
        const contents = await readFile(filePath, 'utf8');
        const rewritten = contents.replaceAll('https://al-bakar.web.app', sitePrefix);
        if (rewritten !== contents) await writeFile(filePath, rewritten);
      }
    }
  };

  return {
    base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'مؤسسة ال بكار للأجهزة المنزلية',
        short_name: 'ال بكار',
        description: 'تسوق الأجهزة المنزلية من مؤسسة ال بكار.',
        lang: 'ar',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f7faf8',
        theme_color: '#087f4f',
        icons: [
          {
            src: `${base}app-icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globIgnores: ['**/*.mp4'],
        // Preserve multipage routes such as product.html?id=... in the precache.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^id$/, /^cat$/]
      }
    }),
    githubPagesMetadata
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '^/api/': {
        target: useSupabaseProxy ? supabaseUrl : 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: useSupabaseProxy,
        ...(useSupabaseProxy ? {
          rewrite: path => path.replace(/^\/api/, '/functions/v1/store-api'),
          headers: {
            apikey: publishableKey,
            Authorization: `Bearer ${anonKey}`
          }
        } : {})
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        products: resolve(root, 'products.html'),
        product: resolve(root, 'product.html'),
        wishlist: resolve(root, 'wishlist.html'),
        policies: resolve(root, 'policies.html'),
        offers: resolve(root, 'offers.html'),
        offer: resolve(root, 'offer.html'), // السطر الجديد بتاع صفحة تفاصيل العرض
        cart: resolve(root, 'cart.html'),
        checkout: resolve(root, 'checkout.html'),
        contact: resolve(root, 'contact.html')
      }
    }
  }
  };
});
