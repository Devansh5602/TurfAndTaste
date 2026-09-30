/**
 * Campus Dining & Table Ordering Engine
 * 
 * Rules:
 * 1. Customer Ordering IN SCOPE: Customers order food from the mobile app using table number.
 * 2. Money in Paise: All menu item prices, item line totals, taxes, and order totals are non-negative integers in paise.
 * 3. State Machine:
 *    PLACED -> ACCEPTED -> PREPARING -> READY -> SERVED -> COMPLETED
 *    (Cancellation allowed from PLACED or ACCEPTED; CANCELLED and COMPLETED are terminal)
 */

export const DINING_ORDER_STATUSES = {
  PLACED: 'PLACED',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export const ORDER_SOURCES = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF'
};

const ALLOWED_ORDER_TRANSITIONS = {
  [DINING_ORDER_STATUSES.PLACED]: [
    DINING_ORDER_STATUSES.ACCEPTED,
    DINING_ORDER_STATUSES.CANCELLED
  ],
  [DINING_ORDER_STATUSES.ACCEPTED]: [
    DINING_ORDER_STATUSES.PREPARING,
    DINING_ORDER_STATUSES.CANCELLED
  ],
  [DINING_ORDER_STATUSES.PREPARING]: [
    DINING_ORDER_STATUSES.READY
  ],
  [DINING_ORDER_STATUSES.READY]: [
    DINING_ORDER_STATUSES.SERVED
  ],
  [DINING_ORDER_STATUSES.SERVED]: [
    DINING_ORDER_STATUSES.COMPLETED
  ],
  [DINING_ORDER_STATUSES.COMPLETED]: [], // Terminal
  [DINING_ORDER_STATUSES.CANCELLED]: []  // Terminal
};

/**
 * Validates table-number format.
 */
export function validateTableNumber(tableNumber) {
  const norm = String(tableNumber || '').trim().toUpperCase();
  if (!norm || norm.length > 20) {
    return { valid: false, error: 'A valid table number identifier (1-20 characters) is required.' };
  }
  // Allow formats like "T1", "12", "TABLE-4", "LOUNGE-2"
  if (!/^[A-Z0-9_-]+$/.test(norm)) {
    return { valid: false, error: 'Table identifier may only contain letters, numbers, hyphens, and underscores.' };
  }
  return { valid: true, tableNumber: norm };
}

/**
 * Validates a dining order state transition.
 */
export function canTransitionDiningOrder(fromStatus, toStatus) {
  const normFrom = String(fromStatus || '').toUpperCase();
  const normTo = String(toStatus || '').toUpperCase();

  if (!DINING_ORDER_STATUSES[normFrom] || !DINING_ORDER_STATUSES[normTo]) {
    return { valid: false, error: `Invalid dining order status in transition: ${fromStatus} -> ${toStatus}` };
  }

  if (normFrom === DINING_ORDER_STATUSES.CANCELLED) {
    return { valid: false, error: 'Cancelled dining order cannot be modified or reopened.' };
  }

  const allowed = ALLOWED_ORDER_TRANSITIONS[normFrom] || [];
  if (!allowed.includes(normTo)) {
    return {
      valid: false,
      error: `Illegal dining order transition from "${normFrom}" to "${normTo}".`
    };
  }

  return { valid: true, fromStatus: normFrom, toStatus: normTo };
}

/**
 * Computes line-item and total amounts for a dining order in paise.
 */
export function calculateDiningOrderTotals(items = [], options = {}) {
  const { taxRatePercent = 5 } = options; // 5% GST on dining standard

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Dining order must contain at least one item.');
  }

  let subtotalPaise = 0;
  const processedItems = items.map(item => {
    const qty = parseInt(item.quantity, 10);
    const unitPrice = parseInt(item.unitPricePaise, 10);

    if (Number.isNaN(qty) || qty <= 0) {
      throw new Error(`Invalid item quantity for "${item.name || item.id}": ${item.quantity}`);
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      throw new Error(`Invalid item price in paise for "${item.name || item.id}": ${item.unitPricePaise}`);
    }

    const itemTotalPaise = qty * unitPrice;
    subtotalPaise += itemTotalPaise;

    return {
      menuItemId: item.menuItemId || item.id,
      name: item.name,
      quantity: qty,
      unitPricePaise: unitPrice,
      totalPricePaise: itemTotalPaise,
      notes: item.notes || null
    };
  });

  const taxPaise = Math.round((subtotalPaise * taxRatePercent) / 100);
  const totalPaise = subtotalPaise + taxPaise;

  return {
    items: processedItems,
    subtotalPaise,
    taxPaise,
    totalPaise
  };
}
