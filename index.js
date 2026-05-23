// GlowPrice Morocco — Serveur principal
// Design: fond blanc, nuances de vert
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const path = require('path');

const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ── SHOPS (seed au démarrage) ─────────────────────────────────
const SHOPS = [
  { name:'Beautizshop.com',    url:'https://beautizshop.com',        logoColor:'#E8F5EE',textColor:'#1A6A3A',deliveryHrs:72,shipCost:35,freeFrom:1000 },
  { name:'Zwine.ma',           url:'https://zwine.ma',               logoColor:'#D4EDDA',textColor:'#155724',deliveryHrs:24,shipCost:30  },
  { name:'HmizatChezSara.com', url:'https://hmizatchezsara.com',     logoColor:'#C3E6CB',textColor:'#0D4A1E',deliveryHrs:48,shipCost:25  },
  { name:'Beautyvana.ma',      url:'https://beautyvana.ma',          logoColor:'#E8F5EE',textColor:'#1A6A3A',deliveryHrs:48,shipCost:30  },
  { name:'KBeauty-Maroc.com',  url:'https://kbeauty-maroc.com',      logoColor:'#D4EDDA',textColor:'#155724',deliveryHrs:48,shipCost:30  },
  { name:'SkinSouk.ma',        url:'https://skinsouk.ma',            logoColor:'#C3E6CB',textColor:'#0D4A1E',deliveryHrs:48,shipCost:25  },
  { name:'MonPara.ma',         url:'https://monpara.ma',             logoColor:'#E8F5EE',textColor:'#1A6A3A',deliveryHrs:48,shipCost:0,freeFrom:250 },
  { name:'BeautyStation.ma',   url:'https://beautystation.ma',       logoColor:'#D4EDDA',textColor:'#155724',deliveryHrs:48,shipCost:30  },
  { name:'Inty.ma',            url:'https://inty.ma',                logoColor:'#C3E6CB',textColor:'#0D4A1E',deliveryHrs:48,shipCost:0,freeFrom:200 },
  { name:'PalmarosaShop.com',  url:'https://palmarosashop.com',      logoColor:'#E8F5EE',textColor:'#1A6A3A',deliveryHrs:48,shipCost:30  },
  { name:'Parapharmacie.ma',   url:'https://parapharmacie.ma',       logoColor:'#D4EDDA',textColor:'#155724',deliveryHrs:24,shipCost:30  },
  { name:'UniversParadiscount.ma',url:'https://universparadiscount.ma',logoColor:'#C3E6CB',textColor:'#0D4A1E',deliveryHrs:24,shipCost:0 },
  { name:'BeautyMall.ma',      url:'https://beautymall.ma',          logoColor:'#E8F5EE',textColor:'#1A6A3A',deliveryHrs:48,shipCost:30  },
  { name:'BeautyMarket.ma',    url:'https://beautymarket.ma',        logoColor:'#D4EDDA',textColor:'#155724',deliveryHrs:48,shipCost:0,freeFrom:300 },
  { name:'LaMaisonPara.ma',    url:'https://lamaisonpara.ma',        logoColor:'#C3E6CB',textColor:'#0D4A1E',deliveryHrs:24,shipCost:25  },
  { name:'NovaPara.ma',        url:'https://novapara.ma',            logoColor:'#E8F5EE',textColor:'#1A6A3A',deliveryHrs:24,shipCost:0,freeFrom:399 },
  { name:'PHBeauty.ma',        url:'https://phbeauty.ma',            logoColor:'#D4EDDA',textColor:'#155724',deliveryHrs:24,shipCost:25  },
  { name:'MarjaneMall.ma',     url:'https://www.marjanemall.ma',     logoColor:'#C3E6CB',textColor:'#0D4A1E',deliveryHrs:72,shipCost:40  },
  { name:'Mapara.ma',          url:'https://mapara.ma',              logoColor:'#E8F5EE',textColor:'#1A6A3A',deliveryHrs:48,shipCost:30  },
  { name:'CotePara.ma',        url:'https://cotepara.ma',            logoColor:'#D4EDDA',textColor:'#155724',deliveryHrs:48,shipCost:30  },
  { name:'GlobalPara.ma',      url:'https://globalpara.ma',          logoColor:'#C3E6CB',textColor:'#0D4A1E',deliveryHrs:48,shipCost:0,freeFrom:399 },
  { name:'Parapharma.ma',      url:'https://parapharma.ma',          logoColor:'#E8F5EE',textColor:'#1A6A3A',deliveryHrs:48,shipCost:30  },
  { name:'HaytamParfumerie.com',url:'https://haytamparfumerie.com',  logoColor:'#D4EDDA',textColor:'#155724',deliveryHrs:48,shipCost:30,freeFrom:1000 },
  { name:'AccessoriesShop.ma', url:'https://www.accessoriesshop.ma', logoColor:'#C3E6CB',textColor:'#0D4A1E',deliveryHrs:48,shipCost:30  },
  { name:'Jumia.ma',           url:'https://www.jumia.ma',           logoColor:'#E8F5EE',textColor:'#1A6A3A',deliveryHrs:24,shipCost:29  },
];

async function seedShops() {
  for (const s of SHOPS) {
    await prisma.shop.upsert({
      where: { name: s.name }, create: s, update: {}
    }).catch(() => {});
  }
  console.log(`✅ ${SHOPS.length} enseignes prêtes`);
}

// ── SETUP BDD ─────────────────────────────────────────────────
async function setupDB() {
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', timeout: 60000 });
    console.log('✅ Base de données prête');
    await seedShops();
  } catch (e) {
    console.log('⚠️  DB push échoué:', e.message);
  }
}

// ── API ROUTES ────────────────────────────────────────────────
app.get('/', (req, res) => res.json({
  app: 'GlowPrice Morocco 🌿',
  version: '2.0',
  description: 'Comparateur prix beauté — 25 enseignes',
  endpoints: ['/api/products', '/api/deals', '/api/search?q=', '/api/stats', '/api/shops'],
}));

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

app.get('/api/stats', async (req, res) => {
  try {
    const [products, prices, shops, lastScrape] = await Promise.all([
      prisma.product.count(),
      prisma.price.count(),
      prisma.shop.count({ where: { active: true } }),
      prisma.scrapeLog.findFirst({ where: { status: 'success' }, orderBy: { ranAt: 'desc' } }),
    ]);
    const logs = await prisma.scrapeLog.findMany({
      orderBy: { ranAt: 'desc' }, take: 20,
      include: { shop: { select: { name: true } } },
    });
    res.json({ products, prices, shops, last_scrape: lastScrape?.ranAt, logs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products', async (req, res) => {
  try {
    const { q, cat, brand, page = '1', limit = '40', sort = 'newest', promo } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};
    if (cat && cat !== 'all') where.category = cat;
    if (brand) where.brand = { contains: brand, mode: 'insensitive' };
    if (q) where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { brand: { contains: q, mode: 'insensitive' } },
      { tags: { hasSome: [q.toLowerCase()] } },
    ];
    if (promo === 'true') where.prices = { some: { discountPct: { gt: 0 }, inStock: true } };

    const orderBy = {
      newest:     { updatedAt: 'desc' },
      price_asc:  { prices: { _min: { price: 'asc' } } },
      price_desc: { prices: { _min: { price: 'desc' } } },
      popular:    { prices: { _count: 'desc' } },
    }[sort] || { updatedAt: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: Number(limit), orderBy,
        include: { prices: { include: { shop: true }, orderBy: { price: 'asc' } } },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(p => ({
        ...p,
        min_price:     p.prices[0]?.price ?? null,
        max_price:     p.prices[p.prices.length - 1]?.price ?? null,
        avg_price:     p.prices.length ? Math.round(p.prices.reduce((s, x) => s + x.price, 0) / p.prices.length) : null,
        total_shops:   p.prices.length,
        max_discount:  Math.max(...p.prices.map(x => x.discountPct ?? 0), 0),
        savings:       p.prices.length > 1 ? Math.round(p.prices[p.prices.length - 1].price - p.prices[0].price) : 0,
        cheapest_shop: p.prices[0]?.shop?.name ?? null,
      })),
      total, page: Number(page), pages: Math.ceil(total / Number(limit)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: { prices: { include: { shop: true }, orderBy: { price: 'asc' } } },
    });
    if (!p) return res.status(404).json({ error: 'Produit non trouvé' });
    const pr = p.prices;
    res.json({
      ...p,
      min_price:     pr[0]?.price ?? null,
      max_price:     pr[pr.length - 1]?.price ?? null,
      savings:       pr.length > 1 ? Math.round(pr[pr.length - 1].price - pr[0].price) : 0,
      cheapest_shop: pr[0]?.shop?.name ?? null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (q.length < 2) return res.json({ products: [] });
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name:  { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
        ],
        prices: { some: { inStock: true } },
      },
      include: { prices: { include: { shop: true }, orderBy: { price: 'asc' }, take: 1 } },
      take: 30,
    });
    res.json({ products: products.map(p => ({ ...p, min_price: p.prices[0]?.price })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/deals', async (req, res) => {
  try {
    const deals = await prisma.product.findMany({
      where: { prices: { some: { discountPct: { gt: 10 }, inStock: true } } },
      include: { prices: { include: { shop: true }, orderBy: { price: 'asc' }, take: 1 } },
      take: 40,
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ deals: deals.map(p => ({ ...p, min_price: p.prices[0]?.price, max_discount: p.prices[0]?.discountPct ?? 0 })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/categories', async (req, res) => {
  try {
    const cats = await prisma.product.groupBy({
      by: ['category'], _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    res.json({ categories: cats.map(c => ({ category: c.category, count: c._count.id })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/brands', async (req, res) => {
  try {
    const brands = await prisma.product.groupBy({
      by: ['brand'], _count: { id: true },
      orderBy: { _count: { id: 'desc' } }, take: 60,
    });
    res.json({ brands: brands.map(b => ({ brand: b.brand, count: b._count.id })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/shops', async (req, res) => {
  try {
    const shops = await prisma.shop.findMany({
      where: { active: true },
      include: { _count: { select: { prices: true } } },
      orderBy: { prices: { _count: 'desc' } },
    });
    res.json({ shops });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN: LANCER LE SCRAPING ─────────────────────────────────
app.post('/api/admin/scrape', async (req, res) => {
  const { secret } = req.body;
  if (secret !== (process.env.ADMIN_SECRET || 'glowprice-admin-2026')) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  res.json({ message: '🌿 Scraping lancé en arrière-plan !' });
  setTimeout(async () => {
    try {
      const { runShopify } = require('./scrapers/shopify');
      const n = await runShopify();
      console.log(`✅ Scraping terminé: ${n} produits`);
    } catch (e) { console.error('Scraping erreur:', e.message); }
  }, 500);
});

// ── CRON QUOTIDIEN ────────────────────────────────────────────
cron.schedule('0 3 * * *', async () => {
  console.log('⏰ Scraping quotidien — 3h AM Maroc');
  try {
    const { runShopify } = require('./scrapers/shopify');
    await runShopify();
  } catch (e) { console.error('Cron erreur:', e.message); }
}, { timezone: 'Africa/Casablanca' });

// ── DÉMARRAGE ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  console.log('\n🌿 ================================');
  console.log('   GlowPrice Morocco v2.0');
  console.log('   Comparateur Beauté Maroc');
  console.log('🌿 ================================\n');

  if (process.env.DATABASE_URL) {
    await setupDB();
    const n = await prisma.product.count().catch(() => 0);
    const p = await prisma.price.count().catch(() => 0);
    console.log(`\n📦 Produits: ${n} | Prix: ${p}`);
    if (n === 0) {
      console.log('\n💡 Base vide — dis à l\'Agent Replit:');
      console.log('   "Run the scraper: node scrapers/shopify.js"');
    }
  } else {
    console.log('⚠️  DATABASE_URL manquante — ajoute dans Secrets 🔒');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 API sur port ${PORT}`);
    console.log(`📊 Stats: /api/stats`);
    console.log(`📦 Produits: /api/products`);
  });
}

start();
