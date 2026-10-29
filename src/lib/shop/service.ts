import { Prisma, ShopOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ProcedureService } from '@/lib/procedures/ProcedureService';
import { ensureDefaultInstallment } from '@/lib/procedures/installmentService';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type { ShopWorkspace } from './auth';
import { personName } from './auth';

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

function statusOut(status: ShopOrderStatus): 'pending' | 'completed' | 'cancelled' {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';
  return 'pending';
}

function statusIn(status: string): ShopOrderStatus {
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type OrderWithItems = Prisma.ShopOrderGetPayload<{ include: { items: true; customer: true } }>;

export function orderDto(
  row: OrderWithItems,
  shop?: { slug: string; name: string } | null,
) {
  const subtotal = money(row.subtotal);
  const discount = money(row.discount);
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
    onlinePaymentEnabled: false,
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
  const count = await prisma.shopOrder.count({
    where: { workspaceKind: workspace.kind, workspaceId: workspace.id },
  });
  return String(2450 + count + 1);
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

export async function findMemberByTaxCode(workspace: ShopWorkspace, taxCode: string) {
  const needle = taxCode.trim().toLowerCase();
  if (!needle) return null;

  if (workspace.kind === 'club') {
    const members = await prisma.clubMember.findMany({
      where: { clubId: workspace.id },
      include: {
        member: {
          select: { id: true, email: true, username: true, name: true, firstName: true, surname: true },
        },
        profile: { select: { profileJson: true } },
      },
      take: 2000,
    });
    for (const row of members) {
      const codes = extractTaxCodes(row.profile?.profileJson).map((code) => code.toLowerCase());
      const aliases = [row.member.email, row.member.username].map((value) => value.toLowerCase());
      if (codes.includes(needle) || aliases.includes(needle)) {
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
        select: { id: true, email: true, username: true, name: true, firstName: true, surname: true },
      },
    },
    take: 2000,
  });
  for (const row of members) {
    const aliases = [row.athlete.email, row.athlete.username].map((value) => value.toLowerCase());
    if (aliases.includes(needle)) {
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

async function resolveBuyer(workspace: ShopWorkspace, input: ShopBuyerInput) {
  if (input.memberUserId) {
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

  if (input.customerId) {
    const customer = await prisma.shopCustomer.findFirst({
      where: { id: input.customerId, workspaceKind: workspace.kind, workspaceId: workspace.id },
    });
    if (!customer) throw new Error('The selected customer could not be found.');
    const name = [customer.firstName, customer.surname].filter(Boolean).join(' ').trim();
    return {
      memberUserId: customer.memberUserId,
      customerId: customer.id,
      name: name || 'Customer',
      email: customer.email,
    };
  }

  const name = await customerNameOf(input);
  if (name === 'Customer' && !input.email && !input.taxCode) {
    throw new Error('Choose a customer or enter their name.');
  }
  const created = await prisma.shopCustomer.create({
    data: {
      workspaceKind: workspace.kind,
      workspaceId: workspace.id,
      firstName: (input.firstName ?? name).trim() || 'Customer',
      surname: (input.surname ?? '').trim(),
      email: (input.email ?? '').trim(),
      phone: (input.phone ?? '').trim(),
      taxCode: (input.taxCode ?? '').trim(),
    },
  });
  return {
    memberUserId: null,
    customerId: created.id,
    name: [created.firstName, created.surname].filter(Boolean).join(' ').trim(),
    email: created.email,
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
  order: { id: string; orderNumber: string; paid: boolean },
  memberUserId: string | null,
  customerName: string,
  total: number,
  productName: string,
) {
  const memberId = memberUserId || workspace.adminId;
  const metadata = {
    productName,
    shopOrderId: order.id,
    sectorName: 'Shop',
    ...(memberUserId ? {} : { shopCustomerName: customerName }),
  };
  return writeDeadlineDirect(workspace, order, memberId, total, productName, metadata);
}

async function writeDeadlineDirect(
  workspace: ShopWorkspace,
  order: { id: string; orderNumber: string; paid: boolean },
  memberId: string,
  total: number,
  productName: string,
  metadata: Record<string, unknown>,
) {
  const procedureType = await procedureService.getProcedureTypeByCode(PROCEDURE_TYPE_CODES.PRODUCT_SALE);
  if (!procedureType) return null;
  const totalAmount = money(total);
  const paidAmount = order.paid ? totalAmount : 0;
  const balanceAmount = money(totalAmount - paidAmount);
  const recordDate = new Date(`${todayIso()}T00:00:00.000Z`);
  try {
    const record = await prisma.procedureRecord.create({
      data: {
        procedureTypeId: procedureType.id,
        clubId: workspace.id,
        memberId,
        operatorId: workspace.adminId,
        totalAmount,
        paidAmount,
        balanceAmount,
        recordDate,
        dueDate: recordDate,
        notes: `Shop order ${order.orderNumber}`,
        metadata: metadata as Prisma.InputJsonValue,
        status: 'ACTIVE',
      },
    });
    if (paidAmount > 0) {
      await prisma.procedurePayment.create({
        data: {
          procedureRecordId: record.id,
          amount: paidAmount,
          balanceAfter: balanceAmount,
          paymentDate: recordDate,
          operatorId: workspace.adminId,
          payMode: 'cash',
          notes: `Shop order ${order.orderNumber}`,
        },
      });
    }
    await ensureDefaultInstallment(
      record.id,
      totalAmount,
      paidAmount,
      todayIso(),
      todayIso(),
      productName,
    );
    return record.id;
  } catch (error) {
    console.error('Shop order was saved, but the deadline archive was not updated:', error);
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

  const order = await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const updated = await tx.shopProduct.updateMany({
        where: { id: line.product.id, quantity: { gte: line.quantity } },
        data: { quantity: { decrement: line.quantity } },
      });
      if (updated.count !== 1) throw new Error(`${line.product.name} does not have enough stock.`);
    }
    return tx.shopOrder.create({
      data: {
        orderNumber,
        workspaceKind: workspace.kind,
        workspaceId: workspace.id,
        customerId: buyer.customerId,
        memberUserId: buyer.memberUserId,
        customerName: buyer.name,
        customerEmail: buyer.email,
        status: 'PENDING',
        paid: options.paid,
        paymentMethod: options.paymentMethod,
        source: options.source,
        subtotal,
        discount,
        items: {
          create: lines.map((line) => ({
            productId: line.product.id,
            name: line.product.name,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
          })),
        },
      },
      include: { items: true, customer: true },
    });
  });

  const productName = lines.map((line) => line.product.name).join(', ').slice(0, 180) || 'Shop';
  const procedureRecordId = await writeDeadline(
    workspace,
    order,
    buyer.memberUserId,
    buyer.name,
    total,
    productName,
  );
    if (procedureRecordId) {
      await prisma.shopOrder.update({
        where: { id: order.id },
        data: { procedureRecordId },
      });
      order.procedureRecordId = procedureRecordId;
    }
  return order;
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
      paid: buyerInput.paid ?? input.paid ?? false,
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
  },
) {
  const settings = await prisma.shopSettings.findUnique({ where: { slug } });
  if (!settings || !settings.shopActive) throw new Error('This shop is currently closed.');
  const org = await loadOrg(settings.workspaceKind, settings.workspaceId);
  if (!org) throw new Error('This shop could not be found.');
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
    const member = await findMemberByTaxCode(workspace, input.customerDetails.taxCode ?? '');
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
    if (input.customerDetails.residenceAddress || input.customerDetails.city) {
      await prisma.shopCustomer.update({
        where: { id: buyer.customerId! },
        data: {
          address: input.customerDetails.residenceAddress ?? '',
          city: input.customerDetails.city ?? '',
          province: input.customerDetails.province ?? '',
          postalCode: input.customerDetails.cap ?? '',
          dateOfBirth: input.customerDetails.dateOfBirth ?? '',
        },
      });
    }
  }

  const lines = await pricedLines(workspace, input.items, input.userType !== 'affiliated');
  const order = await createOneOrder(workspace, lines, buyer, {
    paid: false,
    source: 'online',
    paymentMethod: 'pickup',
  });
  return orderDto(order, { slug: settings.slug, name: settings.displayName || org.name });
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
  return {
    club: {
      id: org.id,
      slug: settings.slug,
      name: settings.displayName?.trim() || org.name,
      description: settings.shopDescription ?? '',
    },
    shopActive: settings.shopActive,
    viewer: { isMember },
    products: products.map(productDto),
  };
}

export async function listOrders(workspace: ShopWorkspace) {
  const settings = await ensureShopSettings(workspace);
  const rows = await prisma.shopOrder.findMany({
    where: { workspaceKind: workspace.kind, workspaceId: workspace.id },
    include: { items: true, customer: true },
    orderBy: { createdAt: 'desc' },
  });
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
  const existing = await prisma.shopOrder.findFirst({
    where: { id: orderId, workspaceKind: workspace.kind, workspaceId: workspace.id },
    include: { items: true, customer: true },
  });
  if (!existing) throw new Error('This order could not be found.');

  const locked = existing.status === 'COMPLETED' || existing.status === 'CANCELLED';
  const paid = input.paid ?? existing.paid;
  const status = input.status ? statusIn(input.status) : existing.status;
  const discount = locked || input.discount == null ? money(existing.discount) : money(input.discount);
  let subtotal = money(existing.subtotal);

  if (!locked && input.items && input.items.length > 0) {
    subtotal = await replaceOrderLines(workspace, existing, input.items);
  }

  let customerId = existing.customerId;
  if (input.customer && !locked) {
    const customerData = {
      firstName: (input.customer.firstName ?? existing.customer?.firstName ?? '').trim() || 'Customer',
      surname: (input.customer.surname ?? '').trim(),
      email: (input.customer.email ?? '').trim(),
      phone: (input.customer.phone ?? '').trim(),
      taxCode: (input.customer.taxCode ?? '').trim(),
      address: (input.customer.address ?? '').trim(),
      city: (input.customer.city ?? '').trim(),
      province: (input.customer.province ?? '').trim(),
      postalCode: (input.customer.postalCode ?? '').trim(),
      dateOfBirth: (input.customer.dateOfBirth ?? '').trim(),
    };
    if (existing.customerId) {
      await prisma.shopCustomer.update({ where: { id: existing.customerId }, data: customerData });
    } else {
      const created = await prisma.shopCustomer.create({
        data: {
          ...customerData,
          workspaceKind: workspace.kind,
          workspaceId: workspace.id,
          memberUserId: existing.memberUserId,
        },
      });
      customerId = created.id;
    }
  } else if (input.customer?.email != null && existing.customerId) {
    await prisma.shopCustomer.update({
      where: { id: existing.customerId },
      data: { email: input.customer.email.trim() },
    });
  }

  const customerName = input.customer
    ? [input.customer.firstName, input.customer.surname].filter(Boolean).join(' ').trim()
    : '';

  const updated = await prisma.shopOrder.update({
    where: { id: existing.id },
    data: {
      status,
      paid,
      discount,
      subtotal,
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      ...(customerId && customerId !== existing.customerId ? { customerId } : {}),
      ...(customerName && !locked ? { customerName } : {}),
      ...(input.customer?.email != null ? { customerEmail: input.customer.email.trim() } : {}),
    },
    include: { items: true, customer: true },
  });

  const total = money(subtotal - discount);
  const becomingPaid = Boolean(paid && !existing.paid);
  if (existing.procedureRecordId && !locked && input.items) {
    await prisma.procedureRecord.updateMany({
      where: { id: existing.procedureRecordId, clubId: workspace.id, status: 'ACTIVE' },
      data: {
        totalAmount: total,
        paidAmount: becomingPaid ? 0 : paid ? total : 0,
        balanceAmount: becomingPaid || !paid ? total : 0,
      },
    });
  }

  if (existing.procedureRecordId && paid !== existing.paid && paid) {
    const open = await prisma.procedureRecord.findFirst({
      where: { id: existing.procedureRecordId, status: 'ACTIVE' },
    });
    const due = open ? money(open.balanceAmount) : total;
    if (due > 0) {
      try {
        await procedureService.addPayment(
          {
            userId: workspace.adminId,
            club: { id: workspace.id, name: workspace.name },
            workspaceKind: workspace.kind,
          },
          PROCEDURE_TYPE_CODES.PRODUCT_SALE,
          existing.procedureRecordId,
          {
            amount: due,
            paymentDate: todayIso(),
            payMode: input.paymentMethod || 'cash',
            notes: `Shop order ${existing.orderNumber} marked paid`,
            operatorId: workspace.adminId,
            skipOperatorPassword: true,
          },
        );
      } catch (error) {
        console.error('Shop payment was not written to the archive:', error);
      }
    }
  }

  if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
    for (const item of updated.items) {
      if (!item.productId) continue;
      await prisma.shopProduct.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      });
    }
    if (existing.procedureRecordId && !paid) {
      await prisma.procedureRecord.updateMany({
        where: { id: existing.procedureRecordId, clubId: workspace.id },
        data: { status: 'DELETED' },
      });
    }
  }

  const settings = await ensureShopSettings(workspace);
  return orderDto(updated, { slug: settings.slug, name: settings.displayName || workspace.name });
}

async function replaceOrderLines(
  workspace: ShopWorkspace,
  existing: { id: string; memberUserId: string | null; items: { productId: string | null; quantity: number }[] },
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
    const subtotal = money(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const updated = await tx.shopProduct.updateMany({
          where: { id: line.product.id, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity } },
        });
        if (updated.count !== 1) throw new Error(`${line.product.name} does not have enough stock.`);
      }
      await tx.shopOrderItem.deleteMany({ where: { orderId: existing.id } });
      await tx.shopOrderItem.createMany({
        data: lines.map((line) => ({
          orderId: existing.id,
          productId: line.product.id,
          name: line.product.name,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
        })),
      });
    });
    return subtotal;
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
  const order = await prisma.shopOrder.findFirst({
    where: { id: orderId, workspaceKind: workspace.kind, workspaceId: workspace.id },
  });
  if (!order) throw new Error('This order could not be found.');
  if (order.status !== 'COMPLETED') throw new Error('Complete the order before issuing a document.');
  if (!order.paid) throw new Error('Mark the order as paid before issuing a document.');

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
  await prisma.shopOrder.update({ where: { id: order.id }, data });
  return { documentNumber: number, documentType: kind };
}

export async function listCustomers(workspace: ShopWorkspace) {
  return prisma.shopCustomer.findMany({
    where: { workspaceKind: workspace.kind, workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createCustomer(
  workspace: ShopWorkspace,
  input: {
    firstName: string;
    surname?: string;
    email?: string;
    phone?: string;
    taxCode?: string;
    photoUrl?: string;
  },
) {
  const firstName = input.firstName.trim();
  if (!firstName) throw new Error('Enter the customer name.');
  return prisma.shopCustomer.create({
    data: {
      workspaceKind: workspace.kind,
      workspaceId: workspace.id,
      firstName,
      surname: (input.surname ?? '').trim(),
      email: (input.email ?? '').trim(),
      phone: (input.phone ?? '').trim(),
      taxCode: (input.taxCode ?? '').trim(),
      photoUrl: input.photoUrl?.trim() || null,
    },
  });
}

export async function listBuyers(workspace: ShopWorkspace) {
  const customers = await listCustomers(workspace);
  const memberSelect = {
    id: true,
    email: true,
    username: true,
    name: true,
    firstName: true,
    surname: true,
    image: true,
  } as const;

  const members =
    workspace.kind === 'club'
      ? await prisma.clubMember.findMany({
          where: { clubId: workspace.id },
          include: { member: { select: memberSelect }, profile: { select: { profileJson: true } } },
          take: 500,
        })
      : await prisma.teamMember.findMany({
          where: { teamId: workspace.id },
          include: { athlete: { select: memberSelect } },
          take: 500,
        });

  return {
    members: members.map((row) => {
      const user = 'member' in row ? row.member : row.athlete;
      const codes = 'profile' in row ? extractTaxCodes(row.profile?.profileJson) : [];
      return {
        id: user.id,
        name: personName(user),
        email: user.email,
        taxCode: codes[0] ?? '',
        photoUrl: user.image,
        kind: 'member' as const,
      };
    }),
    customers: customers.map((customer) => ({
      id: customer.id,
      memberUserId: customer.memberUserId,
      name: [customer.firstName, customer.surname].filter(Boolean).join(' ').trim(),
      email: customer.email,
      taxCode: customer.taxCode,
      photoUrl: customer.photoUrl,
      kind: 'customer' as const,
    })),
  };
}

export async function shopSummary(workspace: ShopWorkspace) {
  const where = { workspaceKind: workspace.kind, workspaceId: workspace.id };
  const [products, orders, customers, paid] = await Promise.all([
    prisma.shopProduct.count({ where }),
    prisma.shopOrder.count({ where: { ...where, status: { not: 'CANCELLED' } } }),
    prisma.shopCustomer.count({ where }),
    prisma.shopOrder.findMany({
      where: { ...where, paid: true, status: { not: 'CANCELLED' } },
      select: { subtotal: true, discount: true },
    }),
  ]);
  const revenue = paid.reduce((sum, row) => sum + money(row.subtotal) - money(row.discount), 0);
  return { products, orders, customers, revenue: money(revenue) };
}
