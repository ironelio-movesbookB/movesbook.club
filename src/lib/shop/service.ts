import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ProcedureService } from '@/lib/procedures/ProcedureService';
import { ensureDefaultInstallment } from '@/lib/procedures/installmentService';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import { fetchProcedureCustomerOptions, fetchSingleUserOptions } from '@/lib/procedures/clubMembers';
import type { ShopWorkspace } from './auth';
import { personName } from './auth';
import { sellingArchiveSector, sellingPerformedBy, shopSector } from './sectors';
import { formatSellingNumber } from './sellingNumber';
import { findPublicOrg, publicOrgCard } from '@/lib/club/publicOrg';
import { createMemberOnlinePayment, type MemberOnlineProvider } from '@/lib/club/memberOnlinePayments';
import { memberGatewayReady } from '@/lib/club/memberPaymentMethods';
import { loadStoredMemberPaymentMethods } from '@/lib/club/memberPaymentMethodsStore';
import { getMemberPaymentMode } from '@/lib/payments/paymentSettings';

export type ShopHeaderMode = 'logo' | 'banner';

export function shopHeaderMode(value: unknown): ShopHeaderMode {
  return value === 'banner' ? 'banner' : 'logo';
}

export type ShopPaymentMethod = 'onsite' | 'bank_transfer' | 'online';

/** The club's own card or PayPal account, when one is connected for the current site mode. */
async function shopOnlineProvider(workspaceId: string): Promise<MemberOnlineProvider | null> {
  const stored = await loadStoredMemberPaymentMethods(workspaceId);
  const siteMode = await getMemberPaymentMode();
  if (memberGatewayReady(stored, 'stripe', siteMode)) return 'stripe';
  if (memberGatewayReady(stored, 'paypal', siteMode)) return 'paypal';
  return null;
}

export async function shopOnlinePaymentReady(workspaceId: string): Promise<boolean> {
  return Boolean(await shopOnlineProvider(workspaceId).catch(() => null));
}

/** Without any method switched on the shop would take no orders, so paying on site stays available. */
function shopPaymentMethods(
  settings: { onsitePaymentEnabled: boolean; bankTransferEnabled: boolean; onlinePaymentEnabled: boolean },
  onlineReady: boolean,
) {
  const online = settings.onlinePaymentEnabled && onlineReady;
  const bankTransfer = settings.bankTransferEnabled;
  return { onsite: settings.onsitePaymentEnabled || (!online && !bankTransfer), bankTransfer, online };
}

export type ShopLineInput = { productId: string; quantity: number };

export type ShopBuyerInput = {
  memberUserId?: string | null;
  customerId?: string | null;
  firstName?: string;
  surname?: string;
  email?: string;
  phone?: string;
  taxCode?: string;
  paid?: boolean;
};

const procedureService = new ProcedureService();

function money(value: Prisma.Decimal | number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function slugify(value: string) {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'shop';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type SaleStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

function statusOut(status: SaleStatus): 'pending' | 'completed' | 'cancelled' {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';
  return 'pending';
}

function statusIn(status: string): SaleStatus {
  if (status === 'completed' || status === 'COMPLETED') return 'COMPLETED';
  if (status === 'cancelled' || status === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}

export function productDto(row: {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  price: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  quantity: number;
  imageUrl: string | null;
  isVisible: boolean;
  hideFromShop: boolean;
  allowMultipleUnits: boolean;
  allowNonMembers: boolean;
  sector?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    clubId: row.workspaceId,
    name: row.name,
    description: row.description,
    price: money(row.price),
    vatRate: money(row.vatRate),
    quantity: row.quantity,
    imageUrl: row.imageUrl ?? '',
    isVisible: row.isVisible,
    hideFromShop: row.hideFromShop,
    allowMultipleUnits: row.allowMultipleUnits,
    allowNonMembers: row.allowNonMembers,
    sector: row.sector || 'Shop',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type SaleItem = {
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
};

type SaleRow = {
  id: string;
  orderNumber: string;
  workspaceId: string;
  customerId: string | null;
  memberUserId: string | null;
  customerName: string;
  customerEmail: string;
  status: SaleStatus;
  paid: boolean;
  paidAmount: number;
  restAmount: number;
  paymentMethod: string;
  source: string;
  sector: string;
  operatorName: string;
  subtotal: number;
  discount: number;
  procedureRecordId: string | null;
  receiptNumber: string | null;
  invoiceNumber: string | null;
  createdAt: Date;
  items: SaleItem[];
  customer: SaleParty;
};

type SaleParty = {
  firstName: string;
  surname: string;
  email: string;
  phone: string;
  taxCode: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  dateOfBirth: string;
  photoUrl: string;
};

export function orderDto(
  row: SaleRow,
  shop?: { slug: string; name: string } | null,
) {
  const subtotal = money(row.subtotal);
  const discount = money(row.discount);
  const productCount = row.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    clubId: row.workspaceId,
    clubSlug: shop?.slug ?? '',
    clubName: shop?.name ?? '',
    customerId: row.customerId,
    memberUserId: row.memberUserId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    items: row.items.map((item) => ({
      productId: item.productId ?? '',
      name: item.name,
      price: money(item.unitPrice),
      quantity: item.quantity,
    })),
    subtotal,
    discount,
    total: money(subtotal - discount),
    paidAmount: money(row.paidAmount),
    restAmount: money(row.restAmount),
    productCount,
    firstProduct: row.items[0]?.name || '-',
    performedBy: sellingPerformedBy(row.source),
    sector: sellingArchiveSector(row.source, row.sector),
    operatorName: sellingPerformedBy(row.source) === 'Member' ? '-' : row.operatorName || '-',
    status: statusOut(row.status),
    paid: row.paid,
    paymentStatus: row.paid ? 'paid' : 'unpaid',
    paymentMethod: row.paymentMethod,
    source: row.source,
    procedureRecordId: row.procedureRecordId,
    receiptNumber: row.receiptNumber,
    invoiceNumber: row.invoiceNumber,
    orderDate: row.createdAt.toISOString().slice(0, 10),
    customer: row.customer
      ? {
          firstName: row.customer.firstName,
          surname: row.customer.surname,
          email: row.customer.email,
          phone: row.customer.phone,
          taxCode: row.customer.taxCode,
          address: row.customer.address,
          city: row.customer.city,
          province: row.customer.province,
          postalCode: row.customer.postalCode,
          dateOfBirth: row.customer.dateOfBirth,
          photoUrl: row.customer.photoUrl,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function ensureShopSettings(workspace: ShopWorkspace) {
  const existing = await prisma.shopSettings.findUnique({
    where: {
      workspaceKind_workspaceId: {
        workspaceKind: workspace.kind,
        workspaceId: workspace.id,
      },
    },
  });
  if (existing) return existing;

  let slug = slugify(workspace.name);
  for (let n = 0; n < 20; n += 1) {
    const candidate = n === 0 ? slug : `${slug}-${n + 1}`;
    const taken = await prisma.shopSettings.findUnique({ where: { slug: candidate } });
    if (!taken) {
      slug = candidate;
      break;
    }
  }

  return prisma.shopSettings.create({
    data: {
      workspaceKind: workspace.kind,
      workspaceId: workspace.id,
      slug,
      displayName: workspace.name,
      shopDescription: '',
      shopActive: true,
    },
  });
}

export function settingsDto(
  row: Awaited<ReturnType<typeof ensureShopSettings>>,
  workspace: ShopWorkspace,
) {
  return {
    clubId: workspace.id,
    shopName: row.displayName?.trim() || workspace.name,
    shopDescription: row.shopDescription ?? '',
    shopActive: row.shopActive,
    orderEmailsEnabled: row.orderEmailsEnabled,
    headerMode: shopHeaderMode(row.headerMode),
    onsitePaymentEnabled: row.onsitePaymentEnabled,
    bankTransferEnabled: row.bankTransferEnabled,
    bankTransferDetails: row.bankTransferDetails ?? '',
    onlinePaymentEnabled: row.onlinePaymentEnabled,
    shopAlert: row.shopAlert ?? '',
    afterSalesInfo: row.afterSalesInfo ?? '',
    slug: row.slug,
    publicPath: `/our-shop/shop/${row.slug}`,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProducts(workspace: ShopWorkspace) {
  const rows = await prisma.shopProduct.findMany({
    where: { workspaceKind: workspace.kind, workspaceId: workspace.id },
    orderBy: { name: 'asc' },
  });
  return rows.map(productDto);
}

export async function findProduct(workspace: ShopWorkspace, id: string) {
  return prisma.shopProduct.findFirst({
    where: { id, workspaceKind: workspace.kind, workspaceId: workspace.id },
  });
}

export async function saveProduct(
  workspace: ShopWorkspace,
  input: {
    id?: string;
    name: string;
    description?: string;
    price: number;
    vatRate: number;
    quantity: number;
    imageUrl?: string;
    isVisible?: boolean;
    hideFromShop?: boolean;
    allowMultipleUnits?: boolean;
    allowNonMembers?: boolean;
    sector?: string;
  },
) {
  const hideFromShop = input.hideFromShop ?? input.isVisible === false;
  const data = {
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    price: money(input.price),
    vatRate: money(input.vatRate),
    quantity: Math.max(0, Math.floor(input.quantity)),
    imageUrl: input.imageUrl?.trim() || null,
    hideFromShop,
    isVisible: !hideFromShop,
    allowMultipleUnits: input.allowMultipleUnits ?? true,
    allowNonMembers: input.allowNonMembers ?? true,
    sector: shopSector(input.sector),
  };
  if (!data.name) throw new Error('Enter a product name.');

  if (input.id) {
    const existing = await prisma.shopProduct.findFirst({
      where: { id: input.id, workspaceKind: workspace.kind, workspaceId: workspace.id },
    });
    if (!existing) throw new Error('This product could not be found.');
    const saved = await prisma.shopProduct.update({ where: { id: existing.id }, data });
    return productDto(saved);
  }

  const saved = await prisma.shopProduct.create({
    data: { ...data, workspaceKind: workspace.kind, workspaceId: workspace.id },
  });
  return productDto(saved);
}

export async function duplicateProduct(workspace: ShopWorkspace, id: string) {
  const existing = await prisma.shopProduct.findFirst({
    where: { id, workspaceKind: workspace.kind, workspaceId: workspace.id },
  });
  if (!existing) throw new Error('This product could not be found.');
  const saved = await prisma.shopProduct.create({
    data: {
      workspaceKind: workspace.kind,
      workspaceId: workspace.id,
      name: `${existing.name} (copy)`.slice(0, 200),
      description: existing.description,
      price: existing.price,
      vatRate: existing.vatRate,
      quantity: existing.quantity,
      imageUrl: existing.imageUrl,
      isVisible: existing.isVisible,
      hideFromShop: existing.hideFromShop,
      allowMultipleUnits: existing.allowMultipleUnits,
      allowNonMembers: existing.allowNonMembers,
      sector: existing.sector,
    },
  });
  return productDto(saved);
}

export async function deleteProduct(workspace: ShopWorkspace, id: string) {
  const existing = await prisma.shopProduct.findFirst({
    where: { id, workspaceKind: workspace.kind, workspaceId: workspace.id },
  });
  if (!existing) throw new Error('This product could not be found.');
  await prisma.shopProduct.delete({ where: { id: existing.id } });
}

async function nextOrderNumber(workspace: ShopWorkspace) {
  const procedureType = await procedureService.getProcedureTypeByCode(PROCEDURE_TYPE_CODES.PRODUCT_SALE);
  const count = procedureType
    ? await prisma.procedureRecord.count({
        where: { procedureTypeId: procedureType.id, clubId: workspace.id },
      })
    : 0;
  return formatSellingNumber(count + 1);
}

function extractTaxCodes(raw: string | null | undefined) {
  if (!raw) return [];
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === 'string' && /fiscal|tax.?code|codice/i.test(key) && child.trim()) {
        found.push(child.trim());
      } else if (child && typeof child === 'object') {
        walk(child);
      }
    }
  };
  try {
    walk(JSON.parse(raw));
  } catch {
    return [];
  }
  return found;
}

function normalizeTaxCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

async function ownerTaxCodesByUser(userIds: string[]) {
  if (!userIds.length) return new Map<string, string[]>();
  const extras = await prisma.userProfileExtras.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, ownerJson: true },
  });
  return new Map(
    extras.map((row) => [row.userId, extractTaxCodes(row.ownerJson).map(normalizeTaxCode)]),
  );
}

export async function findMemberByTaxCode(workspace: ShopWorkspace, taxCode: string) {
  const needle = normalizeTaxCode(taxCode);
  if (!needle) return null;

  if (workspace.kind === 'club') {
    const members = await prisma.clubMember.findMany({
      where: { clubId: workspace.id },
      include: {
        member: {
          select: { id: true, email: true, name: true, firstName: true, surname: true },
        },
        profile: { select: { profileJson: true } },
      },
      take: 2000,
    });
    const ownerCodes = await ownerTaxCodesByUser(members.map((row) => row.member.id));
    for (const row of members) {
      const codes = [
        ...extractTaxCodes(row.profile?.profileJson).map(normalizeTaxCode),
        ...(ownerCodes.get(row.member.id) ?? []),
      ];
      if (codes.includes(needle)) {
        return {
          userId: row.member.id,
          name: personName(row.member),
          email: row.member.email,
        };
      }
    }
    return null;
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId: workspace.id },
    include: {
      athlete: {
        select: { id: true, email: true, name: true, firstName: true, surname: true },
      },
      profile: { select: { profileJson: true } },
    },
    take: 2000,
  });
  const ownerCodes = await ownerTaxCodesByUser(members.map((row) => row.athlete.id));
  for (const row of members) {
    const codes = [
      ...extractTaxCodes(row.profile?.profileJson).map(normalizeTaxCode),
      ...(ownerCodes.get(row.athlete.id) ?? []),
    ];
    if (codes.includes(needle)) {
      return {
        userId: row.athlete.id,
        name: personName(row.athlete),
        email: row.athlete.email,
      };
    }
  }
  return null;
}

async function customerNameOf(input: ShopBuyerInput, memberName?: string) {
  if (memberName) return memberName;
  const name = [input.firstName, input.surname].filter(Boolean).join(' ').trim();
  return name || 'Customer';
}

async function assertWorkspaceMember(workspace: ShopWorkspace, userId: string) {
  if (workspace.kind === 'club') {
    const row = await prisma.clubMember.findFirst({
      where: { clubId: workspace.id, memberId: userId },
      select: { id: true },
    });
    if (!row) throw new Error('The selected member is not in this club.');
    return;
  }
  const row = await prisma.teamMember.findFirst({
    where: { teamId: workspace.id, athleteId: userId },
    select: { id: true },
  });
  if (!row) throw new Error('The selected member is not in this team.');
}

async function resolveBuyer(workspace: ShopWorkspace, input: ShopBuyerInput) {
  if (input.memberUserId) {
    await assertWorkspaceMember(workspace, input.memberUserId);
    const user = await prisma.user.findUnique({
      where: { id: input.memberUserId },
      select: { id: true, email: true, name: true, firstName: true, surname: true },
    });
    if (!user) throw new Error('The selected member could not be found.');
    return {
      memberUserId: user.id,
      customerId: input.customerId ?? null,
      name: personName(user),
      email: user.email,
    };
  }

  const name = await customerNameOf(input);
  if (name === 'Customer' && !input.email && !input.taxCode) {
    throw new Error('Choose a member or enter their name.');
  }
  return {
    memberUserId: null,
    customerId: null,
    name,
    email: (input.email ?? '').trim(),
  };
}

async function pricedLines(workspace: ShopWorkspace, items: ShopLineInput[], nonMember: boolean) {
  if (!items.length) throw new Error('Add at least one product.');
  const ids = items.map((item) => item.productId);
  const products = await prisma.shopProduct.findMany({
    where: { id: { in: ids }, workspaceKind: workspace.kind, workspaceId: workspace.id },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  return items.map((item) => {
    const product = byId.get(item.productId);
    const quantity = Math.floor(Number(item.quantity));
    if (!product) throw new Error('One of the products is no longer available.');
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Enter a valid quantity.');
    if (!product.allowMultipleUnits && quantity > 1) {
      throw new Error(`${product.name} can only be ordered one at a time.`);
    }
    if (nonMember && !product.allowNonMembers) {
      throw new Error(`${product.name} is available to members only.`);
    }
    if (product.quantity < quantity) {
      throw new Error(`${product.name} does not have enough stock.`);
    }
    return { product, quantity, unitPrice: money(product.price) };
  });
}

async function writeDeadline(
  workspace: ShopWorkspace,
  order: {
    id: string;
    orderNumber: string;
    customerEmail?: string;
    discount?: number;
    source?: string;
    paymentMethod?: string;
  },
  memberUserId: string | null,
  customerName: string,
  total: number,
  lines: Awaited<ReturnType<typeof pricedLines>>,
) {
  const memberId = memberUserId || workspace.adminId;
  const productName = lines.map((line) => line.product.name).join(', ').slice(0, 180) || 'Shop';
  const sectors = [...new Set(lines.map((line) => shopSector(line.product.sector)))];
  const sectorName = sectors.join(' - ') || 'Shop';
  const id = randomUUID();
  const metadata = {
    productName,
    shopOrderId: id,
    sectorName,
    sector: sectorName,
    productCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    products: lines.map((line) => ({
      productId: line.product.id,
      name: line.product.name,
      quantity: line.quantity,
      price: line.unitPrice,
    })),
    sellingNumber: order.orderNumber,
    customerName,
    customerEmail: order.customerEmail ?? '',
    discount: money(order.discount ?? 0),
    source: order.source ?? 'staff',
    paymentMethod: order.paymentMethod ?? 'pickup',
    ...(memberUserId ? {} : { shopCustomerName: customerName }),
  };
  return writeDeadlineDirect(workspace, { ...order, id }, memberId, total, productName, metadata);
}

async function writeDeadlineDirect(
  workspace: ShopWorkspace,
  order: { id: string; orderNumber: string },
  memberId: string,
  total: number,
  productName: string,
  metadata: Record<string, unknown>,
) {
  const procedureType = await procedureService.getProcedureTypeByCode(PROCEDURE_TYPE_CODES.PRODUCT_SALE);
  if (!procedureType) return null;
  const totalAmount = money(total);
  const recordDate = new Date(`${todayIso()}T00:00:00.000Z`);
  try {
    const record = await prisma.procedureRecord.create({
      data: {
        id: order.id,
        procedureTypeId: procedureType.id,
        clubId: workspace.id,
        memberId,
        operatorId: workspace.userId || workspace.adminId,
        totalAmount,
        paidAmount: 0,
        balanceAmount: totalAmount,
        recordDate,
        dueDate: recordDate,
        notes: `Shop order ${order.orderNumber}`,
        metadata: metadata as Prisma.InputJsonValue,
        status: 'ACTIVE',
      },
    });
    return record.id;
  } catch (error) {
    console.error('Shop order was saved, but the deadline archive was not updated:', error);
    console.error('The selling could not be saved to the deadline archive:', error);
    return null;
  }
}

async function createOneOrder(
  workspace: ShopWorkspace,
  lines: Awaited<ReturnType<typeof pricedLines>>,
  buyer: Awaited<ReturnType<typeof resolveBuyer>>,
  options: { paid: boolean; source: string; paymentMethod: string; discount?: number },
) {
  const subtotal = money(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  const discount = Math.min(subtotal, money(options.discount ?? 0));
  const total = money(subtotal - discount);
  const orderNumber = await nextOrderNumber(workspace);

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const updated = await tx.shopProduct.updateMany({
        where: { id: line.product.id, quantity: { gte: line.quantity } },
        data: { quantity: { decrement: line.quantity } },
      });
      if (updated.count !== 1) throw new Error(`${line.product.name} does not have enough stock.`);
    }
  });

  const procedureRecordId = await writeDeadline(
    workspace,
    {
      id: randomUUID(),
      orderNumber,
      customerEmail: buyer.email,
      discount,
      source: options.source,
      paymentMethod: options.paymentMethod,
    },
    buyer.memberUserId,
    buyer.name,
    total,
    lines,
  );
  if (!procedureRecordId) {
    for (const line of lines) {
      await prisma.shopProduct.update({
        where: { id: line.product.id },
        data: { quantity: { increment: line.quantity } },
      });
    }
    throw new Error('The selling could not be saved to the deadline archive.');
  }

  const sale: SaleRow = {
    id: procedureRecordId,
    orderNumber,
    workspaceId: workspace.id,
    customerId: null,
    memberUserId: buyer.memberUserId,
    customerName: buyer.name,
    customerEmail: buyer.email,
    status: 'PENDING',
    paid: false,
    paidAmount: 0,
    restAmount: total,
    paymentMethod: options.paymentMethod,
    source: options.source,
    sector: [...new Set(lines.map((line) => shopSector(line.product.sector)))].join(' - ') || 'Shop',
    operatorName: '-',
    subtotal,
    discount,
    procedureRecordId,
    receiptNumber: null,
    invoiceNumber: null,
    createdAt: new Date(),
    items: lines.map((line) => ({
      productId: line.product.id,
      name: line.product.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
    })),
    customer: partyOf({}, buyer.name, buyer.email),
  };
  return sale;
}

export async function createStaffOrders(
  workspace: ShopWorkspace,
  input: {
    items: ShopLineInput[];
    paid?: boolean;
    discount?: number;
    buyer?: ShopBuyerInput;
    buyers?: ShopBuyerInput[];
  },
) {
  const many = input.buyers && input.buyers.length > 0;
  const buyers = many ? input.buyers! : [input.buyer ?? {}];
  const stockCheck = await pricedLines(workspace, input.items, false);
  for (const line of stockCheck) {
    if (line.product.quantity < line.quantity * buyers.length) {
      throw new Error(`${line.product.name} does not have enough stock for every customer.`);
    }
  }
  const created = [];
  for (const buyerInput of buyers) {
    const buyer = await resolveBuyer(workspace, buyerInput);
    const lines = await pricedLines(workspace, input.items, !buyer.memberUserId);
    const order = await createOneOrder(workspace, lines, buyer, {
      paid: false,
      source: many ? 'multi' : 'staff',
      paymentMethod: 'pickup',
      discount: input.discount,
    });
    created.push(order);
  }
  const settings = await ensureShopSettings(workspace);
  return created.map((order) =>
    orderDto(order, { slug: settings.slug, name: settings.displayName || workspace.name }),
  );
}

export async function createPublicOrder(
  slug: string,
  input: {
    userType: 'affiliated' | 'non-affiliated';
    customerDetails: {
      taxCode?: string;
      surname?: string;
      name?: string;
      email?: string;
      telephone?: string;
      residenceAddress?: string;
      city?: string;
      province?: string;
      cap?: string;
      dateOfBirth?: string;
    };
    items: ShopLineInput[];
    paymentMethod?: ShopPaymentMethod;
  },
) {
  const settings = await prisma.shopSettings.findUnique({ where: { slug } });
  if (!settings || !settings.shopActive) throw new Error('This shop is currently closed.');
  const org = await loadOrg(settings.workspaceKind, settings.workspaceId);
  if (!org) throw new Error('This shop could not be found.');
  const paymentMethod = input.paymentMethod ?? 'onsite';
  const onlineProvider =
    paymentMethod === 'online' && settings.onlinePaymentEnabled
      ? await shopOnlineProvider(org.id).catch(() => null)
      : null;
  const allowed = shopPaymentMethods(settings, Boolean(onlineProvider));
  if (
    (paymentMethod === 'onsite' && !allowed.onsite) ||
    (paymentMethod === 'bank_transfer' && !allowed.bankTransfer) ||
    (paymentMethod === 'online' && !allowed.online)
  ) {
    throw new Error('This payment method is not available in this shop.');
  }
  const workspace: ShopWorkspace = {
    userId: org.adminId,
    userType: settings.workspaceKind === 'team' ? 'TEAM' : 'CLUB',
    kind: settings.workspaceKind === 'team' ? 'team' : 'club',
    id: org.id,
    name: org.name,
    adminId: org.adminId,
    canManage: true,
  };

  let buyer: Awaited<ReturnType<typeof resolveBuyer>>;
  if (input.userType === 'affiliated') {
    const taxCode = input.customerDetails.taxCode?.trim() ?? '';
    if (!taxCode) throw new Error('Enter your tax code.');
    const member = await findMemberByTaxCode(workspace, taxCode);
    if (!member) throw new Error('No member matches this tax code.');
    buyer = { memberUserId: member.userId, customerId: null, name: member.name, email: member.email };
  } else {
    buyer = await resolveBuyer(workspace, {
      firstName: input.customerDetails.name,
      surname: input.customerDetails.surname,
      email: input.customerDetails.email,
      phone: input.customerDetails.telephone,
      taxCode: input.customerDetails.taxCode,
    });
  }

  const lines = await pricedLines(workspace, input.items, input.userType !== 'affiliated');
  const order = await createOneOrder(workspace, lines, buyer, {
    paid: false,
    source: 'online',
    paymentMethod: paymentMethod === 'onsite' ? 'pickup' : paymentMethod,
  });
  const shopName = settings.displayName || org.name;
  const total = money(order.subtotal - order.discount);

  let onlinePaymentId: string | null = null;
  if (onlineProvider && order.procedureRecordId && total > 0) {
    const description = `${shopName} order ${order.orderNumber}`.slice(0, 255);
    const link = await createMemberOnlinePayment({
      entityId: org.id,
      entityName: shopName,
      memberUserId: buyer.memberUserId || workspace.adminId,
      memberName: buyer.name,
      createdByUserId: workspace.adminId,
      provider: onlineProvider,
      amountEur: total,
      description,
      settlement: [
        {
          procedureType: PROCEDURE_TYPE_CODES.PRODUCT_SALE,
          recordId: order.procedureRecordId,
          amount: total,
          payMode: onlineProvider === 'paypal' ? 'paypal' : 'credit_card',
          operatorId: workspace.adminId,
          paymentDate: todayIso(),
          description,
        },
      ],
    });
    onlinePaymentId = link.id;
  }

  return {
    order: orderDto(order, { slug: settings.slug, name: shopName }),
    onlinePaymentId,
  };
}

async function loadOrg(kind: string, id: string) {
  if (kind === 'team') {
    return prisma.team.findUnique({
      where: { id },
      select: { id: true, name: true, adminId: true },
    });
  }
  return prisma.club.findUnique({
    where: { id },
    select: { id: true, name: true, adminId: true },
  });
}

async function viewerIsMember(kind: string, workspaceId: string, userId: string) {
  if (kind === 'team') {
    const [team, member] = await Promise.all([
      prisma.team.findUnique({ where: { id: workspaceId }, select: { adminId: true } }),
      prisma.teamMember.findFirst({
        where: { teamId: workspaceId, athleteId: userId },
        select: { id: true },
      }),
    ]);
    return team?.adminId === userId || Boolean(member);
  }
  const [club, staff, member] = await Promise.all([
    prisma.club.findUnique({ where: { id: workspaceId }, select: { adminId: true } }),
    prisma.clubStaff.findFirst({
      where: { clubId: workspaceId, userId },
      select: { id: true },
    }),
    prisma.clubMember.findFirst({
      where: { clubId: workspaceId, memberId: userId },
      select: { id: true },
    }),
  ]);
  return club?.adminId === userId || Boolean(staff) || Boolean(member);
}

export async function getPublicShop(slug: string, viewerUserId?: string | null) {
  const settings = await prisma.shopSettings.findUnique({ where: { slug } });
  if (!settings) return null;
  const org = await loadOrg(settings.workspaceKind, settings.workspaceId);
  if (!org) return null;
  const isMember = viewerUserId
    ? await viewerIsMember(settings.workspaceKind, settings.workspaceId, viewerUserId)
    : false;
  const products = await prisma.shopProduct.findMany({
    where: {
      workspaceKind: settings.workspaceKind,
      workspaceId: settings.workspaceId,
      isVisible: true,
      hideFromShop: false,
      quantity: { gt: 0 },
    },
    orderBy: { name: 'asc' },
  });
  const publicOrg = await findPublicOrg(org.id);
  const card = publicOrg ? publicOrgCard(publicOrg) : null;
  return {
    club: {
      id: org.id,
      slug: settings.slug,
      name: settings.displayName?.trim() || org.name,
      description: settings.shopDescription ?? '',
      logoUrl: card?.logoUrl ?? null,
      bannerUrl: card?.bannerUrl ?? null,
      headerMode: shopHeaderMode(settings.headerMode),
    },
    alert: settings.shopAlert ?? '',
    afterSalesInfo: settings.afterSalesInfo ?? '',
    bankTransferDetails: settings.bankTransferEnabled ? settings.bankTransferDetails ?? '' : '',
    paymentMethods: shopPaymentMethods(
      settings,
      settings.onlinePaymentEnabled && Boolean(await shopOnlineProvider(org.id).catch(() => null)),
    ),
    shopActive: settings.shopActive,
    viewer: { isMember },
    products: products.map(productDto),
  };
}

function metaOf(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function textOf(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function partyOf(meta: Record<string, unknown>, fallbackName: string, fallbackEmail: string): SaleParty {
  const stored = meta.customer;
  const raw =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : null;
  const parts = fallbackName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: textOf(raw?.firstName) || (raw ? '' : parts[0] || ''),
    surname: textOf(raw?.surname) || (raw ? '' : parts.slice(1).join(' ')),
    email: textOf(raw?.email) || fallbackEmail,
    phone: textOf(raw?.phone),
    taxCode: textOf(raw?.taxCode),
    address: textOf(raw?.address),
    city: textOf(raw?.city),
    province: textOf(raw?.province),
    postalCode: textOf(raw?.postalCode),
    dateOfBirth: textOf(raw?.dateOfBirth),
    photoUrl: textOf(raw?.photoUrl),
  };
}

async function loadSales(workspace: ShopWorkspace): Promise<SaleRow[]> {
  const procedureType = await procedureService.getProcedureTypeByCode(PROCEDURE_TYPE_CODES.PRODUCT_SALE);
  if (!procedureType) return [];
  const records = await prisma.procedureRecord.findMany({
    where: { procedureTypeId: procedureType.id, clubId: workspace.id },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  if (records.length === 0) return [];
  const memberIds = [...new Set(records.map((record) => record.memberId))];
  const operatorIds = [...new Set(records.map((record) => record.operatorId).filter(Boolean))];
  const peopleIds = [...new Set([...memberIds, ...operatorIds])];
  const [users, receipts] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: peopleIds } },
      select: { id: true, email: true, name: true, firstName: true, surname: true },
    }),
    prisma.procedureReceipt.findMany({
      where: { procedureRecordId: { in: records.map((record) => record.id) } },
      select: { procedureRecordId: true, documentType: true, documentNumber: true },
    }),
  ]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  return records.map((record) => {
    const meta = metaOf(record.metadata);
    const products = Array.isArray(meta.products) ? meta.products : [];
    const items: SaleItem[] = products.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const line = entry as Record<string, unknown>;
      const name = textOf(line.name);
      if (!name) return [];
      return [{
        productId: textOf(line.productId) || null,
        name,
        unitPrice: money(line.price as number),
        quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
      }];
    });
    const discount = money(meta.discount as number);
    const subtotal = money(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) || money(record.totalAmount) + discount);
    const settled = money(record.balanceAmount) <= 0 && money(record.paidAmount) > 0;
    const user = usersById.get(record.memberId);
    const operator = record.operatorId ? usersById.get(record.operatorId) : undefined;
    const guestName = textOf(meta.shopCustomerName) || textOf(meta.customerName);
    const ownMember = user && user.id !== workspace.adminId;
    const fallbackName = guestName || (user ? personName(user) : 'Customer');
    const fallbackEmail = textOf(meta.customerEmail) || user?.email || '';
    const party = partyOf(meta, fallbackName, fallbackEmail);
    const editedName = meta.customer
      ? [party.surname, party.firstName].filter(Boolean).join(' ').trim()
      : '';
    const receipt = receipts.find((row) => row.procedureRecordId === record.id && row.documentType === 'Receipt');
    const invoice = receipts.find((row) => row.procedureRecordId === record.id && row.documentType === 'Invoice');
    return {
      id: record.id,
      orderNumber: textOf(meta.sellingNumber) || record.id.slice(-6),
      workspaceId: workspace.id,
      customerId: null,
      memberUserId: ownMember ? user.id : null,
      customerName: editedName || fallbackName,
      customerEmail: party.email || fallbackEmail,
      status: record.status === 'DELETED' ? 'CANCELLED' : settled ? 'COMPLETED' : 'PENDING',
      paid: settled,
      paidAmount: money(record.paidAmount),
      restAmount: money(record.balanceAmount),
      paymentMethod: textOf(meta.paymentMethod) || 'pickup',
      source: textOf(meta.source) || 'staff',
      sector: textOf(meta.sector) || textOf(meta.sectorName) || 'Shop',
      operatorName: operator ? personName(operator) : '-',
      subtotal,
      discount,
      procedureRecordId: record.id,
      receiptNumber: receipt?.documentNumber ?? null,
      invoiceNumber: invoice?.documentNumber ?? (textOf(meta.invoiceNumber) || null),
      createdAt: record.createdAt,
      items,
      customer: party,
    };
  });
}

export async function listOrders(workspace: ShopWorkspace) {
  const settings = await ensureShopSettings(workspace);
  const rows = await loadSales(workspace);
  return rows.map((row) =>
    orderDto(row, { slug: settings.slug, name: settings.displayName || workspace.name }),
  );
}

export async function updateOrder(
  workspace: ShopWorkspace,
  orderId: string,
  input: {
    status?: string;
    paid?: boolean;
    discount?: number;
    paymentMethod?: string;
    items?: ShopLineInput[];
    customer?: {
      firstName?: string;
      surname?: string;
      email?: string;
      phone?: string;
      taxCode?: string;
      address?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      dateOfBirth?: string;
    };
  },
) {
  const sales = await loadSales(workspace);
  const existing = sales.find((sale) => sale.id === orderId);
  if (!existing) throw new Error('This order could not be found.');

  const locked = existing.status === 'COMPLETED' || existing.status === 'CANCELLED';
  const status = input.status ? statusIn(input.status) : existing.status;
  const discount = locked || input.discount == null ? money(existing.discount) : money(input.discount);
  let items = existing.items;

  if (!locked && input.items && input.items.length > 0) {
    items = await replaceOrderLines(workspace, existing, input.items);
  }

  if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
    if (existing.paid) throw new Error('This selling is already paid. Use the payment archive to reverse it.');
    for (const item of items) {
      if (!item.productId) continue;
      await prisma.shopProduct.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      });
    }
    await prisma.procedureRecord.updateMany({
      where: { id: existing.id, clubId: workspace.id },
      data: { status: 'DELETED' },
    });
  } else if (existing.status !== 'CANCELLED') {
    const customerName = input.customer
      ? [input.customer.surname, input.customer.firstName].filter(Boolean).join(' ').trim()
      : existing.customerName;
    await saveSaleDetails(workspace, existing, {
      items: locked ? existing.items : items,
      discount,
      customerName,
      customerEmail: input.customer?.email?.trim() ?? existing.customerEmail,
      paymentMethod: input.paymentMethod || existing.paymentMethod,
      customer: input.customer,
    });
  }

  const settings = await ensureShopSettings(workspace);
  const updated = (await loadSales(workspace)).find((sale) => sale.id === orderId) ?? existing;
  return orderDto(updated, { slug: settings.slug, name: settings.displayName || workspace.name });
}

async function saveSaleDetails(
  workspace: ShopWorkspace,
  existing: SaleRow,
  patch: {
    items: SaleItem[];
    discount: number;
    customerName: string;
    customerEmail: string;
    paymentMethod: string;
    customer?: {
      firstName?: string;
      surname?: string;
      email?: string;
      phone?: string;
      taxCode?: string;
      address?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      dateOfBirth?: string;
    };
  },
) {
  const record = await prisma.procedureRecord.findFirst({
    where: { id: existing.id, clubId: workspace.id, status: 'ACTIVE' },
  });
  if (!record) return;
  const meta = metaOf(record.metadata);
  const subtotal = money(patch.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const total = money(subtotal - patch.discount);
  const alreadyPaid = money(record.paidAmount);
  const party = patch.customer
    ? {
        firstName: patch.customer.firstName?.trim() || '',
        surname: patch.customer.surname?.trim() || '',
        email: patch.customer.email?.trim() || patch.customerEmail,
        phone: patch.customer.phone?.trim() || '',
        taxCode: patch.customer.taxCode?.trim() || '',
        address: patch.customer.address?.trim() || '',
        city: patch.customer.city?.trim() || '',
        province: patch.customer.province?.trim() || '',
        postalCode: patch.customer.postalCode?.trim() || '',
        dateOfBirth: patch.customer.dateOfBirth?.trim() || '',
      }
    : null;
  const customerName =
    party && [party.surname, party.firstName].filter(Boolean).join(' ').trim()
      ? [party.surname, party.firstName].filter(Boolean).join(' ').trim()
      : patch.customerName;
  await prisma.procedureRecord.update({
    where: { id: record.id },
    data: {
      totalAmount: total,
      balanceAmount: Math.max(0, money(total - alreadyPaid)),
      metadata: {
        ...meta,
        productName: patch.items.map((item) => item.name).join(', ').slice(0, 180) || 'Shop',
        productCount: patch.items.reduce((sum, item) => sum + item.quantity, 0),
        products: patch.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
        discount: patch.discount,
        customerName,
        customerEmail: party?.email || patch.customerEmail,
        paymentMethod: patch.paymentMethod,
        ...(party ? { customer: party } : {}),
        ...(existing.memberUserId ? {} : { shopCustomerName: customerName }),
      } as Prisma.InputJsonValue,
    },
  });
}

async function replaceOrderLines(
  workspace: ShopWorkspace,
  existing: { memberUserId: string | null; items: SaleItem[] },
  items: ShopLineInput[],
) {
  for (const item of existing.items) {
    if (!item.productId) continue;
    await prisma.shopProduct.update({
      where: { id: item.productId },
      data: { quantity: { increment: item.quantity } },
    });
  }
  try {
    const lines = await pricedLines(workspace, items, !existing.memberUserId);
    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const updated = await tx.shopProduct.updateMany({
          where: { id: line.product.id, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity } },
        });
        if (updated.count !== 1) throw new Error(`${line.product.name} does not have enough stock.`);
      }
    });
    return lines.map((line) => ({
      productId: line.product.id,
      name: line.product.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
    }));
  } catch (error) {
    for (const item of existing.items) {
      if (!item.productId) continue;
      await prisma.shopProduct.update({
        where: { id: item.productId },
        data: { quantity: { decrement: item.quantity } },
      });
    }
    throw error;
  }
}

export async function issueOrderDocument(
  workspace: ShopWorkspace,
  orderId: string,
  kind: 'receipt' | 'invoice',
) {
  const order = (await loadSales(workspace)).find((sale) => sale.id === orderId);
  if (!order) throw new Error('This order could not be found.');
  if (!order.paid) throw new Error('Pay this selling in the payment form before a receipt is issued.');
  const number = `${kind === 'invoice' ? 'INV' : 'REC'}-${order.orderNumber}`;
  if (order.procedureRecordId) {
    const existing = await prisma.procedureReceipt.findFirst({
      where: {
        procedureRecordId: order.procedureRecordId,
        documentType: kind === 'invoice' ? 'Invoice' : 'Receipt',
      },
    });
    if (!existing) {
      const payment = await prisma.procedurePayment.findFirst({
        where: { procedureRecordId: order.procedureRecordId },
        orderBy: { createdAt: 'desc' },
      });
      try {
        await prisma.procedureReceipt.create({
          data: {
            procedureRecordId: order.procedureRecordId,
            procedurePaymentId: payment?.id,
            clubId: workspace.id,
            memberId: order.memberUserId || workspace.adminId,
            operatorId: workspace.adminId,
            documentType: kind === 'invoice' ? 'Invoice' : 'Receipt',
            documentNumber: number,
            amount: money(order.subtotal) - money(order.discount),
            paymentAmount: money(order.subtotal) - money(order.discount),
            annotations: `Shop order ${order.orderNumber}`,
            serviceName: 'Shop',
            receiptDate: new Date(`${todayIso()}T00:00:00.000Z`),
          },
        });
      } catch (error) {
        console.error('Shop document number was saved, but the cash-desk receipt was not:', error);
      }
    }
  }

  const data = kind === 'invoice' ? { invoiceNumber: number } : { receiptNumber: number };
  return { documentNumber: number, documentType: kind };
}

export async function listCustomers(workspace: ShopWorkspace) {
  const { members } = await listBuyers(workspace);
  return members.map((member) => {
    const parts = member.name.trim().split(/\s+/);
    return {
      id: member.id,
      firstName: parts[0] || member.name,
      surname: parts.slice(1).join(' '),
      email: member.email,
      phone: '',
      taxCode: member.taxCode,
      photoUrl: member.photoUrl ?? null,
    };
  });
}

export async function createCustomer(
  _workspace: ShopWorkspace,
  _input: {
    firstName: string;
    surname?: string;
    email?: string;
    phone?: string;
    taxCode?: string;
    photoUrl?: string;
  },
) {
  throw new Error('Customers are the club members. Add the person from the club member list.');
}

export async function listBuyers(workspace: ShopWorkspace) {
  const asMember = (id: string, name: string, email = '', photoUrl: string | null = null) => ({
    id,
    name,
    email,
    taxCode: '',
    photoUrl,
    kind: 'member' as const,
  });

  if (workspace.kind === 'club') {
    const options = await fetchProcedureCustomerOptions(workspace.id);
    return {
      members: options.map((member) => asMember(member.id, member.name, '', member.image ?? null)),
      customers: [],
    };
  }

  const rows = await prisma.teamMember.findMany({
    where: { teamId: workspace.id },
    include: {
      athlete: {
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          firstName: true,
          surname: true,
          image: true,
        },
      },
    },
    take: 500,
  });
  const teamMembers = rows.map((row) =>
    asMember(row.athlete.id, personName(row.athlete), row.athlete.email, row.athlete.image),
  );
  if (teamMembers.length > 0) return { members: teamMembers, customers: [] };

  const fallback = await fetchSingleUserOptions();
  return {
    members: fallback.map((member) => asMember(member.id, member.name, '', member.image ?? null)),
    customers: [],
  };
}

export async function shopSummary(workspace: ShopWorkspace) {
  const [products, sales, customers] = await Promise.all([
    prisma.shopProduct.count({
      where: { workspaceKind: workspace.kind, workspaceId: workspace.id },
    }),
    loadSales(workspace),
    workspace.kind === 'club'
      ? prisma.clubMember.count({ where: { clubId: workspace.id } })
      : prisma.teamMember.count({ where: { teamId: workspace.id } }),
  ]);
  const openSales = sales.filter((sale) => sale.status !== 'CANCELLED');
  const revenue = openSales
    .filter((sale) => sale.paid)
    .reduce((sum, sale) => sum + sale.subtotal - sale.discount, 0);
  return { products, orders: openSales.length, customers, revenue: money(revenue) };
}
