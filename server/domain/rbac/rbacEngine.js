/**
 * Role-Based Access Control (RBAC) Engine
 * 
 * Rules:
 * 1. Permission-oriented: access decisions are based on explicit granular permissions.
 * 2. Default-Deny: unassigned actions are rejected.
 * 3. Dynamic Roles: supports default system roles plus custom roles created in CMS.
 */

export const STANDARD_PERMISSIONS = [
  // Facilities
  { key: 'facility.read', module: 'facilities', description: 'View facilities and schedules' },
  { key: 'facility.create', module: 'facilities', description: 'Create new facilities' },
  { key: 'facility.update', module: 'facilities', description: 'Update facility details and amenities' },
  { key: 'facility.block', module: 'facilities', description: 'Create and remove facility maintenance blocks' },

  // Bookings & Operations
  { key: 'booking.read', module: 'bookings', description: 'View booking records and calendars' },
  { key: 'booking.create', module: 'bookings', description: 'Create customer reservations' },
  { key: 'booking.walkin', module: 'bookings', description: 'Create immediate staff walk-in bookings' },
  { key: 'booking.checkin', module: 'bookings', description: 'Perform QR check-in and start sessions' },
  { key: 'booking.extend', module: 'bookings', description: 'Approve and record session extensions' },
  { key: 'booking.cancel', module: 'bookings', description: 'Cancel existing bookings' },

  // Pricing
  { key: 'pricing.read', module: 'pricing', description: 'View pricing tiers and rule definitions' },
  { key: 'pricing.manage', module: 'pricing', description: 'Update pricing rules, packages, and deposit rates' },

  // Payments
  { key: 'payment.read', module: 'payments', description: 'View payment transactions and reconciliation' },
  { key: 'payment.record', module: 'payments', description: 'Record counter and manual cash/UPI payments' },

  // Customers & Privacy
  { key: 'customer.read', module: 'customers', description: 'View customer directory and history' },

  // Events & Notices
  { key: 'event.manage', module: 'events', description: 'Create and publish events/tournaments' },
  { key: 'notice.manage', module: 'notices', description: 'Publish property notices and customer banners' },

  // Reviews
  { key: 'review.moderate', module: 'reviews', description: 'Approve, moderate, or remove customer reviews' },

  // Dining
  { key: 'dining.stall.manage', module: 'dining', description: 'Configure dining stalls and operating hours' },
  { key: 'dining.menu.manage', module: 'dining', description: 'Manage menu items, categories, and availability' },
  { key: 'dining.order.read', module: 'dining', description: 'View incoming and historical dining orders' },
  { key: 'dining.order.manage', module: 'dining', description: 'Accept, update status, and complete dining orders' },

  // Administration
  { key: 'role.manage', module: 'roles', description: 'Create roles and assign permissions' },
  { key: 'maintenance.manage', module: 'maintenance', description: 'Configure maintenance schedules and system settings' }
];

export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  STAFF: 'staff',
  STALL_STAFF: 'stall_staff',
  CUSTOMER: 'customer'
};

export const DEFAULT_ROLE_PERMISSIONS = {
  [SYSTEM_ROLES.SUPER_ADMIN]: STANDARD_PERMISSIONS.map(p => p.key),
  [SYSTEM_ROLES.STAFF]: [
    'facility.read',
    'facility.block',
    'booking.read',
    'booking.create',
    'booking.walkin',
    'booking.checkin',
    'booking.extend',
    'booking.cancel',
    'payment.read',
    'payment.record',
    'customer.read',
    'dining.order.read',
    'dining.order.manage'
  ],
  [SYSTEM_ROLES.STALL_STAFF]: [
    'dining.stall.manage',
    'dining.menu.manage',
    'dining.order.read',
    'dining.order.manage'
  ],
  [SYSTEM_ROLES.CUSTOMER]: [
    'booking.read',
    'booking.create',
    'dining.order.read'
  ]
};

/**
 * Checks if a user's permission set satisfies a required permission.
 */
export function hasPermission(userPermissions = [], requiredPermission) {
  if (!Array.isArray(userPermissions) || !requiredPermission) return false;
  // Super admin wildcard match
  if (userPermissions.includes('*') || userPermissions.includes('super_admin')) {
    return true;
  }
  return userPermissions.includes(requiredPermission);
}

/**
 * Express middleware helper for server-side permission gating.
 */
export function requirePermission(permissionKey) {
  return (req, res, next) => {
    // If admin has role super_admin or legacy super_admin
    const userRole = req.admin?.role;
    const permissions = req.admin?.permissions || (userRole ? DEFAULT_ROLE_PERMISSIONS[userRole] || [] : []);

    if (userRole === 'super_admin' || hasPermission(permissions, permissionKey)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Forbidden: Missing required permission "${permissionKey}".`
    });
  };
}
