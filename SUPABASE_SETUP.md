# إعداد متجر ال بكار على Supabase

## التشغيل المحلي

ملف `.env.local` يحتوي إعدادات Supabase العامة التي يستخدمها المتجر. انسخ `.env.example` إليه عند تجهيز جهاز جديد، ثم أدخل رابط المشروع والمفتاحين العامين من إعدادات Supabase. شغّل الموقع بالأمر `npm run dev` وافتح `http://127.0.0.1:5173`.

طلبات `/api/*` في Vite تمر عبر proxy إلى Edge Function `store-api`. في النشر المباشر، يشير `VITE_API_BASE_URL` إلى:

```text
https://<project-ref>.supabase.co/functions/v1/store-api
```

## البيانات والمسارات

- `catalog_products`, `catalog_categories`, و`catalog_product_banners` تخدم صفحات الكتالوج.
- `app_records` يحتفظ بسجلات Firebase السابقة مع اسم المجموعة ومعرّف المستند الأصلي، ويشمل المنتجات والأقسام والعروض والطلبات والأرشيف والإعدادات وسجلات الإدارة.
- `store-api` يقدم المنتجات وصفحاتها، الأقسام، بانرات المنتجات، العروض، رسوم الشحن، تتبع الطلب وإنشاءه.
- إنشاء الطلب يتحقق من الأسعار والمخزون في الخادم ويحفظ الطلب ويخصم المخزون ذريًا عبر `create_bakar_order`.

تم ترحيل 699 سجلًا من Firestore إلى Supabase مع الحفاظ على معرّفات المستندات. صور البانرات تستخدم روابط Cloudinary المحفوظة في البيانات.

## المفاتيح

المتصفح يستخدم فقط `VITE_SUPABASE_PUBLISHABLE_KEY` و`VITE_SUPABASE_ANON_KEY`. لا تضع `SUPABASE_SECRET_KEY` أو `SUPABASE_SERVICE_ROLE_KEY` في `.env.local` أو ملفات الواجهة؛ تحتفظ بها بيئة Edge Function على الخادم.

## التحقق المحلي

```powershell
npm run dev
```

افتح `/products.html` و`/offers.html`، وأكمل الطلب من صفحة السلة. مسارات API محلية مثل `http://127.0.0.1:5173/api/categories` تستخدم Supabase مباشرة عبر proxy.

## النشر على GitHub Pages

سير العمل `.github/workflows/deploy-pages.yml` يبني `dist` وينشره عند كل دفع إلى `main`. اضبط مصدر GitHub Pages على **GitHub Actions**، وأضف متغيرات المستودع العامة التالية من **Settings > Secrets and variables > Actions > Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY`

لا تضف مفتاح Supabase السري إلى GitHub؛ الواجهة تحتاج المفتاحين العامين فقط. إعداد Vite يضبط تلقائيًا مسار المشروع في GitHub Pages ويحوّل روابط الموقع القديمة في HTML وsitemap إلى عنوان النشر.
