import fs from 'node:fs/promises';
import path from 'node:path';

const INR_TO_AC_RATE = 10;
const catalogPath = path.resolve(process.cwd(), 'data', 'shop.json');

let cachedCatalog = null;

function createItemId(game, amount) {
  return `${game}:${amount}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function loadCatalog() {
  if (cachedCatalog) return cachedCatalog;

  const raw = await fs.readFile(catalogPath, 'utf8');
  const parsed = JSON.parse(raw);

  const products = parsed.products.map((product, gameIndex) => ({
    gameIndex,
    game: product.game,
    description: product.description,
    denominations: product.denominations.map((denomination, packageIndex) => {
      const costAc = Math.round(Number(denomination.discounted_price) * INR_TO_AC_RATE);
      return {
        packageIndex,
        amount: denomination.amount,
        originalPriceInr: Number(denomination.original_price),
        discountedPriceInr: Number(denomination.discounted_price),
        costAc,
        itemId: createItemId(product.game, denomination.amount)
      };
    })
  }));

  cachedCatalog = { products, conversionRate: INR_TO_AC_RATE };
  return cachedCatalog;
}

export async function getGameByIndex(gameIndex) {
  const catalog = await loadCatalog();
  return catalog.products[gameIndex] ?? null;
}

export async function getPackageByIndexes(gameIndex, packageIndex) {
  const game = await getGameByIndex(gameIndex);
  if (!game) return null;
  return game.denominations[packageIndex] ?? null;
}
