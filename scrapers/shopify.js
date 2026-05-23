// GlowPrice — Scraper Shopify (sites avec /products.json)
// Fonctionne pour : Beautizshop, Zwine, HmizatChezSara, Beautyvana,
//                   KBeauty-Maroc, SkinSouk, MonPara, BeautyStation
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BRANDS = [
  'CeraVe','La Roche-Posay','Bioderma','Eucerin','Avène','Vichy','ISDIN','Nuxe','SVR',
  'Uriage','Ducray','Kérastase','Olaplex','K18','The Ordinary','COSRX','Anua','Skin1004',
  'Beauty of Joseon','Round Lab','Torriden','Isntree','Mielle','Gisou','Rare Beauty',
  'Charlotte Tilbury','Fenty Beauty','Huda Beauty','Makeup by Mario','Summer Fridays',
  'Paula\'s Choice','Filorga','Lierac','ACM','Noreva','Cetaphil','Clarins','Benefit',
  'NARS','Too Faced','NYX','MAC','Lancôme','Givenchy','Dior Beauty','YSL Beauté',
];

function extractBrand(name, vendor) {
  if (vendor && vendor.length > 1 && vendor !== 'Default') return vendor;
  const n = name.toLowerCase();
  for (const b of BRANDS) {
    if (n.includes(b.toLowerCase())) return b;
  }
  return name.split(' ').slice(0, 2).join(' ');
}

function extractVolume(name) {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|L|oz)\b/i);
  return m ? `${m[1]}${m[2].toLowerCase()}` : null;
}

function normalizeCategory(text) {
  const t = (text || '').toLowerCase();
  if (/solaire|spf|sun/.test(t)) return 'sun';
  if (/maquillage|makeup|mascara|rouge|blush|fond de teint|contour|highlighter/.test(t)) return 'makeup';
  if (/cheveu|hair|shampoo|après-shampoo|capillaire|keratine/.test(t)) return 'hair';
  if (/coréen|k-beauty|korean/.test(t)) return 'kbeauty';
  if (/sérum|serum|ampoule|essence/.test(t)) return 'serum';
  if (/corps|body|douche|bain|mains|pieds/.test(t)) return 'body';
  if (/parfum|eau de parfum|fragrance/.test(t)) return 'parfum';
  return 'skincare';
}

function makeSlug(name, brand) {
  return `${brand}-${name}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .substring(0, 100) + '-' + Math.random().toString(36).substring(2, 6);
}

async function scrapeShopifySite(shopName, baseUrl) {
  const shop = await prisma.shop.findUnique({ where: { name: shopName } });
  if (!shop) { console.log(`  ⚠ Shop "${shopName}" introuvable`); return 0; }

  let page = 1, total = 0;
  const t0 = Date.now();
  console.log(`\n  🌿 ${shopName}`);

  while (page <= 100) {
    try {
      const res = await axios.get(`${baseUrl}/products.json?limit=250&page=${page}`, {
        timeout: 25000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GlowPriceBot/1.0; +https://glowprice.ma)' },
      });

      const products = res.data?.products || [];
      if (!products.length) break;

      for (const p of products) {
        try {
          const variant = p.variants?.[0];
          if (!variant) continue;
          const price = parseFloat(variant.price);
          if (!price || price < 5 || price > 50000) continue;

          const compareAt = parseFloat(variant.compare_at_price || '0');
          const discountPct = compareAt > price ? Math.round((1 - price / compareAt) * 100) : null;
          const brand = extractBrand(p.title, p.vendor);
          const cat = normalizeCategory(`${p.product_type} ${(p.tags || []).join(' ')}`);
          const slug = makeSlug(p.title, brand);
          const imageUrl = p.images?.[0]?.src || null;

          const product = await prisma.product.upsert({
            where: { slug },
            create: {
              name: p.title.substring(0, 200),
              brand, category: cat,
              volume: extractVolume(p.title),
              imageUrl, tags: (p.tags || []).slice(0, 10), slug,
            },
            update: { imageUrl: imageUrl || undefined, updatedAt: new Date() },
          });

          await prisma.price.upsert({
            where: { productId_shopId: { productId: product.id, shopId: shop.id } },
            create: {
              productId: product.id, shopId: shop.id,
              price, oldPrice: compareAt > price ? compareAt : null, discountPct,
              inStock: variant.available,
              stockLevel: !variant.available ? 'out' : 'in',
              productUrl: `${baseUrl}/products/${p.handle}`,
              imageUrl,
            },
            update: {
              price, oldPrice: compareAt > price ? compareAt : null, discountPct,
              inStock: variant.available, stockLevel: !variant.available ? 'out' : 'in',
              scrapedAt: new Date(),
            },
          });

          total++;
        } catch (e) {
          if (!e.message?.includes('Unique constraint')) { /* ignorer doublons */ }
        }
      }

      console.log(`    Page ${page}: ${products.length} produits (total: ${total})`);
      if (products.length < 250) break;
      page++;
      await new Promise(r => setTimeout(r, 700 + Math.random() * 600));
    } catch (e) {
      console.error(`    ❌ Page ${page}: ${e.message}`);
      if (page === 1) break;
      break;
    }
  }

  const ms = Date.now() - t0;
  await prisma.scrapeLog.create({
    data: { shopId: shop.id, status: 'success', productsFound: total, durationMs: ms },
  }).catch(() => {});

  console.log(`    ✅ ${shopName}: ${total} produits en ${(ms/1000).toFixed(1)}s`);
  return total;
}

const SHOPIFY_SITES = [
  { name: 'Beautizshop.com',    url: 'https://beautizshop.com' },
  { name: 'Zwine.ma',           url: 'https://zwine.ma' },
  { name: 'HmizatChezSara.com', url: 'https://hmizatchezsara.com' },
  { name: 'Beautyvana.ma',      url: 'https://beautyvana.ma' },
  { name: 'KBeauty-Maroc.com',  url: 'https://kbeauty-maroc.com' },
  { name: 'SkinSouk.ma',        url: 'https://skinsouk.ma' },
  { name: 'MonPara.ma',         url: 'https://monpara.ma' },
  { name: 'BeautyStation.ma',   url: 'https://beautystation.ma' },
  { name: 'Inty.ma',            url: 'https://inty.ma' },
  { name: 'PalmarosaShop.com',  url: 'https://palmarosashop.com' },
];

async function runShopify() {
  const t0 = Date.now();
  console.log('\n🌿 GlowPrice — Scraping Shopify (sites rapides)');
  console.log('📅', new Date().toLocaleString('fr-MA'));

  let grand = 0;
  // Parallèle par groupes de 2
  for (let i = 0; i < SHOPIFY_SITES.length; i += 2) {
    const batch = SHOPIFY_SITES.slice(i, i + 2);
    const results = await Promise.allSettled(
      batch.map(site => scrapeShopifySite(site.name, site.url))
    );
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') grand += r.value;
      else console.error(`  ❌ ${batch[j].name}: ${r.reason?.message}`);
    });
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ Total Shopify: ${grand} produits en ${((Date.now()-t0)/1000/60).toFixed(1)} min`);
  await prisma.$disconnect();
  return grand;
}

if (require.main === module) {
  runShopify()
    .then(n => { console.log(`🎉 ${n} produits chargés !`); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { runShopify, scrapeShopifySite };
