import { NextRequest, NextResponse } from 'next/server';
import {
  fetchListprice,
  fetchPackageByListprice,
  fetchPricelistOptions,
  fetchSpecialServices,
  getAuthorizedContext,
  sanitizePackageFeature,
  text,
  upsertPackage
} from '@/lib/clubSubscriptionPackages.server';

export const dynamic = 'force-dynamic';

/**
 * Subscription package (services + put_table + package name) and Package features (rich text)
 * of a single list price. Legacy: clubsetting_typology_subscription_package /
 * clubsetting_subscription_package_features.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const listpriceId = text(request.nextUrl.searchParams.get('listpriceId'));
    if (!listpriceId) return NextResponse.json({ error: 'Invalid list price id' }, { status: 400 });

    const listprice = await fetchListprice(context, listpriceId);
    if (!listprice) {
      return NextResponse.json(
        { error: 'Price list not found or you do not have permission to access it.' },
        { status: 404 }
      );
    }

    const [pkg, services, pricelistOptions] = await Promise.all([
      fetchPackageByListprice(context, listpriceId),
      fetchSpecialServices(context),
      fetchPricelistOptions(context)
    ]);

    // Services follow the package's own view_order when set, otherwise the global order_position.
    const sortedServices = [...services].sort((a, b) => {
      const orderA = pkg.viewOrder[a.id] ?? a.orderPosition;
      const orderB = pkg.viewOrder[b.id] ?? b.orderPosition;
      return orderA - orderB;
    });

    return NextResponse.json({
      listprice,
      pricelistOptions,
      package: { ...pkg, packageFeature: sanitizePackageFeature(pkg.packageFeature) },
      services: sortedServices
    });
  } catch (error) {
    console.error('GET subscription-package:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Save the "Subscription package" tab. */
export async function PUT(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;
    const body = await request.json().catch(() => ({}));
    const listpriceId = text(body.listpriceId);
    if (!listpriceId || !(await fetchListprice(context, listpriceId))) {
      return NextResponse.json({ error: 'Price list not found' }, { status: 404 });
    }

    const serviceIds: string[] = Array.isArray(body.serviceIds)
      ? body.serviceIds.map((id: unknown) => text(id)).filter(Boolean)
      : [];
    const viewOrder: string[] = Array.isArray(body.viewOrder)
      ? body.viewOrder.map((id: unknown) => text(id)).filter(Boolean)
      : [];

    await upsertPackage(context, listpriceId, {
      package_name: text(body.packageName).slice(0, 255),
      put_table: body.putTable ? 'Y' : 'N',
      service_ids: serviceIds.join(','),
      view_order: viewOrder.map((id, index) => `${id}:${index + 1}`).join(',')
    });

    return NextResponse.json({ success: true, message: 'Updated successfully.' });
  } catch (error) {
    console.error('PUT subscription-package:', error);
    return NextResponse.json({ success: false, error: 'Failed to update!' }, { status: 500 });
  }
}

/** Save the "Package features" tab. */
export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;
    const body = await request.json().catch(() => ({}));
    const listpriceId = text(body.listpriceId);
    if (!listpriceId || !(await fetchListprice(context, listpriceId))) {
      return NextResponse.json({ error: 'Price list not found' }, { status: 404 });
    }

    await upsertPackage(context, listpriceId, {
      package_feature: sanitizePackageFeature(body.packageFeature)
    });

    return NextResponse.json({ success: true, message: 'Package features saved successfully.' });
  } catch (error) {
    console.error('PATCH subscription-package:', error);
    return NextResponse.json({ success: false, error: 'Failed to save package features!' }, { status: 500 });
  }
}
