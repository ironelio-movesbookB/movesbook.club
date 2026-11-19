import { prisma } from '@/lib/prisma';
import { findExistingTable } from '@/lib/club/legacyTableLookup';
import { fetchProcedureCustomerOptions } from './clubMembers';
import { fetchClubOperatorOptions } from './clubOperators';
import { listCompanies } from '@/lib/club/archives/clubArchiveService';
import type { ClubAuthContext } from './types';
import { isHardwareProductSector, shopSector } from '@/lib/shop/sectors';
import { nextSellingNumber } from '@/lib/shop/nextSellingNumber';
import { PROCEDURE_TYPE_CODES } from './types';

const PRODUCT_TABLE_CANDIDATES = ['products', 'product'];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type ProductSaleFormProduct = {
  id: string;
  name: string;
  cost: number;
  sector: string;
  allowMultipleUnits: boolean;
};

export type ProductSaleFormOptions = {
  products: ProductSaleFormProduct[];
  members: { id: string; name: string }[];
  operators: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  currentOperatorId: string | null;
  nextSellingNumber: string;
};

export async function fetchProductSaleFormOptions(
  ctx: ClubAuthContext
): Promise<ProductSaleFormOptions> {
  const products: ProductSaleFormProduct[] = [];
  const shopRows = await prisma.shopProduct.findMany({
    where: { workspaceKind: 'club', workspaceId: ctx.club.id },
    orderBy: { name: 'asc' },
    take: 500,
  });
  for (const row of shopRows) {
    if (isHardwareProductSector(row.sector)) continue;
    products.push({
      id: row.id,
      name: text(row.name) || `Product ${row.id}`,
      cost: num(row.price),
      sector: shopSector(row.sector),
      allowMultipleUnits: row.allowMultipleUnits,
    });
  }

  if (products.length === 0) {
    const productTable = await findExistingTable(PRODUCT_TABLE_CANDIDATES);
    if (productTable) {
      const rows = await prisma.$queryRawUnsafe<
        { id: bigint | number; product_name: string | null; price: string | number | null }[]
      >(`SELECT id, product_name, price FROM \`${productTable}\` ORDER BY product_name ASC LIMIT 500`);
      for (const row of rows) {
        products.push({
          id: String(row.id),
          name: text(row.product_name) || `Product ${row.id}`,
          cost: num(row.price),
          sector: 'Shop',
          allowMultipleUnits: true,
        });
      }
    }
  }

  const [members, operators, companies, procedureType] = await Promise.all([
    fetchProcedureCustomerOptions(ctx.club.id),
    fetchClubOperatorOptions(ctx.club.id),
    listCompanies(ctx),
    prisma.procedureType.findFirst({
      where: { code: PROCEDURE_TYPE_CODES.PRODUCT_SALE, isActive: true },
      select: { id: true },
    }),
  ]);
  return {
    products,
    members,
    operators,
    companies,
    currentOperatorId: ctx.userId,
    nextSellingNumber: await nextSellingNumber(ctx.club.id, procedureType?.id),
  };
}
