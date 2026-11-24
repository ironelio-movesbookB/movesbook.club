import { prisma } from '@/lib/prisma';
import { findExistingTable } from '@/lib/club/legacyTableLookup';
import { fetchProcedureCustomerOptions } from './clubMembers';
import { fetchClubOperatorOptions } from './clubOperators';
import { listCompanies } from '@/lib/club/archives/clubArchiveService';
import type { ClubAuthContext } from './types';

const PRODUCT_TABLE_CANDIDATES = ['products', 'product'];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type ProductSaleFormOptions = {
  products: { id: string; name: string; cost: number }[];
  members: { id: string; name: string }[];
  operators: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  currentOperatorId: string | null;
};

export async function fetchProductSaleFormOptions(
  ctx: ClubAuthContext
): Promise<ProductSaleFormOptions> {
  const products: { id: string; name: string; cost: number }[] = [];
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
      });
    }
  }

  const [members, operators, companies] = await Promise.all([
    fetchProcedureCustomerOptions(ctx.club.id),
    fetchClubOperatorOptions(ctx.club.id),
    listCompanies(ctx),
  ]);

  return {
    products,
    members,
    operators,
    companies,
    currentOperatorId: ctx.userId,
  };
}
