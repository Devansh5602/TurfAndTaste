/**
 * Campus Dining Order Command (Server-Authoritative)
 * 
 * Rules:
 * 1. Server-Authoritative Pricing: Menu prices are loaded directly from food_menu_items in paise.
 *    Client-submitted prices are strictly ignored and never trusted.
 * 2. Item Availability: Inactive or unavailable menu items are rejected.
 * 3. Table Proof & Validation: Table must exist and be active in dining_tables.
 * 4. State Machine & Authorization:
 *    PLACED -> ACCEPTED -> PREPARING -> READY -> SERVED -> COMPLETED
 *    Stall/Staff operations require dining.order.manage permission.
 *    Customer can only cancel an order while in PLACED state.
 *    CANCELLED and COMPLETED are terminal.
 */

import { canTransitionDiningOrder, DINING_ORDER_STATUSES } from './diningEngine.js';

export async function createDiningOrder(db, input, context = {}) {
  const {
    actor = { type: 'CUSTOMER', name: 'Guest' },
    tableNumber,
    tableQrToken = null,
    items = [],
    notes = null
  } = input;

  // 1. Table Verification
  const rawTableInput = String(tableNumber || input.tableId || input.table || '').trim();
  if (!rawTableInput) {
    throw new Error('A valid table number is required to place a dining order.');
  }

  const normNumber = rawTableInput.toUpperCase();
  const tPrefixed = normNumber.startsWith('T') ? normNumber : `T${normNumber}`;

  const table = await db.get(
    'SELECT id, table_number, is_active, qr_code_token FROM dining_tables WHERE id = ? OR table_number = ? OR table_number = ?',
    [rawTableInput, normNumber, tPrefixed]
  );

  if (!table) {
    throw new Error(`Table "${rawTableInput}" is not a valid active Turf & Taste dining table.`);
  }

  const isTableActive = db.isPostgres && db.isPostgres() ? Boolean(table.is_active) : Number(table.is_active) === 1;
  if (!isTableActive) {
    throw new Error(`Table "${rawTableInput}" is currently inactive or closed for service.`);
  }


  // If tableQrToken is provided, verify match if qr_code_token is set
  if (table.qr_code_token && tableQrToken && table.qr_code_token !== tableQrToken) {
    throw new Error('Table verification token does not match the active table QR.');
  }

  // 2. Validate Items Array
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Dining order must contain at least one menu item.');
  }

  // 3. Load Server-Authoritative Menu Items & Prices from Database
  let subtotalPaise = 0;
  const processedItems = [];
  let stallId = null;

  for (const item of items) {
    const menuItemId = item.menuItemId || item.id;
    const quantity = parseInt(item.quantity, 10);

    if (Number.isNaN(quantity) || quantity <= 0) {
      throw new Error(`Invalid item quantity for item "${menuItemId}": ${item.quantity}`);
    }

    const menuItem = await db.get(
      'SELECT id, stall_id, name, price_paise, is_available, is_active FROM food_menu_items WHERE id = ?',
      [menuItemId]
    );

    if (!menuItem) {
      throw new Error(`Menu item "${menuItemId}" not found in current menus.`);
    }

    const isAvailable = db.isPostgres && db.isPostgres() ? Boolean(menuItem.is_available) : Number(menuItem.is_available) === 1;
    const isActive = db.isPostgres && db.isPostgres() ? Boolean(menuItem.is_active) : Number(menuItem.is_active) === 1;

    if (!isActive || !isAvailable) {
      throw new Error(`Item "${menuItem.name}" is currently unavailable or out of stock.`);
    }

    // Set stall from first item if not set
    if (!stallId && menuItem.stall_id) {
      stallId = menuItem.stall_id;
    }

    // Server-authoritative unit price in paise (client input is strictly ignored!)
    const unitPricePaise = parseInt(menuItem.price_paise, 10);
    const itemTotalPaise = unitPricePaise * quantity;
    subtotalPaise += itemTotalPaise;

    processedItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      quantity,
      unitPricePaise,
      totalPricePaise: itemTotalPaise,
      notes: item.notes || null
    });
  }

  // 4. Compute Tax & Total
  const taxPaise = Math.round((subtotalPaise * 5) / 100); // 5% GST
  const totalAmountPaise = subtotalPaise + taxPaise;

  // 5. Generate Order Number & Persist
  const orderId = `dord_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
  const orderSource = actor.type === 'STAFF' ? 'STAFF' : 'CUSTOMER';
  const customerName = (actor.name || input.customerName || 'Dine-in Customer').trim();
  const customerPhone = String(actor.phone || input.customerPhone || '').replace(/\D/g, '');

  await db.run(
    `INSERT INTO dining_orders (
      id, stall_id, table_id, table_number, order_number, order_source,
      customer_name, customer_phone, order_status, subtotal_paise,
      tax_paise, total_amount_paise, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PLACED', ?, ?, ?, 'PENDING', ?)`,
    [
      orderId,
      stallId,
      table.id,
      table.table_number,
      orderNumber,
      orderSource,
      customerName,
      customerPhone,
      subtotalPaise,
      taxPaise,
      totalAmountPaise,
      notes

    ]
  );

  for (const item of processedItems) {
    await db.run(
      `INSERT INTO dining_order_items (
        id, order_id, menu_item_id, item_name, quantity, unit_price_paise, total_price_paise, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `doi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        orderId,
        item.menuItemId,
        item.name,
        item.quantity,
        item.unitPricePaise,
        item.totalPricePaise,
        item.notes
      ]
    );
  }

  return {
    success: true,
    orderId,
    orderNumber,
    tableNumber: table.table_number,
    orderStatus: DINING_ORDER_STATUSES.PLACED,
    items: processedItems,
    subtotalPaise,
    taxPaise,
    totalAmountPaise,
    customerName
  };

}

/**
 * Updates a dining order status with authorization and state transition validation.
 */
export async function updateDiningOrderStatus(db, orderId, targetStatus, actorOrContext = {}) {
  const actor = actorOrContext.actor || actorOrContext;
  const order = await db.get('SELECT id, order_status, customer_name, customer_phone FROM dining_orders WHERE id = ?', [orderId]);
  if (!order) {
    throw new Error(`Dining order "${orderId}" not found.`);
  }

  // Validate state transition
  const check = canTransitionDiningOrder(order.order_status, targetStatus);
  if (!check.valid) {
    throw new Error(check.error);
  }

  // Authorization check
  const isStaff = actor.role === 'super_admin' || actor.role === 'staff' || actor.role === 'stall_staff' || (actor.permissions && actor.permissions.includes('dining.order.manage'));
  const isCustomer = actor.type === 'CUSTOMER';


  if (isCustomer) {
    // Customer can ONLY cancel an order while it is still in PLACED status
    if (targetStatus !== DINING_ORDER_STATUSES.CANCELLED || order.order_status !== DINING_ORDER_STATUSES.PLACED) {
      throw new Error('Customers can only cancel unaccepted orders in PLACED status.');
    }
  } else if (!isStaff) {
    throw new Error('Forbidden: Updating dining order status requires staff authorization (dining.order.manage).');
  }

  await db.run(
    'UPDATE dining_orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [targetStatus, orderId]
  );

  return {
    success: true,
    orderId,
    previousStatus: order.order_status,
    newStatus: targetStatus,
    isTerminal: targetStatus === DINING_ORDER_STATUSES.COMPLETED || targetStatus === DINING_ORDER_STATUSES.CANCELLED
  };
}
