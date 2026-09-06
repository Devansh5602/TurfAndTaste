/**
 * Turf & Taste - Database Schemas & Data Contracts
 * 
 * Ready for PostgreSQL, Supabase, MySQL, or MongoDB in Phase 2.
 */

/**
 * User Entity (Roles: 'customer', 'staff', 'admin')
 * @typedef {Object} User
 * @property {string} id - UUID primary key
 * @property {string} name - Full customer/staff name
 * @property {string} email - Unique email address
 * @property {string} phone - Mobile contact (+91)
 * @property {'customer' | 'staff' | 'admin'} role - Access control role
 * @property {string} created_at - Timestamp
 */

/**
 * Facility Entity
 * @typedef {Object} Facility
 * @property {string} id - Slug identifier ('box-cricket', 'pickleball', etc.)
 * @property {string} name - Public title
 * @property {string} category - 'sports' | 'practice' | 'dining'
 * @property {string} description - Comprehensive facility detail
 * @property {string} image - Image asset URL
 * @property {'active' | 'maintenance' | 'coming_soon'} status
 */

/**
 * Facility Slot Entity
 * @typedef {Object} FacilitySlot
 * @property {string} id - Primary key
 * @property {string} facility_id - Foreign key referencing facilities(id)
 * @property {string} slot_date - YYYY-MM-DD
 * @property {string} start_time - HH:MM:SS
 * @property {string} end_time - HH:MM:SS
 * @property {number} price - Calculated hourly price
 * @property {number} booking_amount - Minimum token deposit required
 * @property {'available' | 'reserved' | 'booked' | 'maintenance'} status
 */

/**
 * Booking Entity
 * @typedef {Object} Booking
 * @property {string} id - TT-XXXXXX reference ID
 * @property {string} user_id - Customer ID
 * @property {string} facility_id - Facility ID
 * @property {string} slot_id - Reserved slot ID
 * @property {string} booking_date - Game date
 * @property {string} start_time - Start time
 * @property {string} end_time - End time
 * @property {number} total_amount - Full amount
 * @property {number} paid_amount - Amount paid upfront
 * @property {'deposit' | 'full'} payment_type
 * @property {'pending' | 'partial_paid' | 'completed' | 'refunded'} payment_status
 * @property {'confirmed' | 'cancelled' | 'attended' | 'no_show'} booking_status
 * @property {string} created_at
 */

/**
 * Inquiry Entity
 * @typedef {Object} Inquiry
 * @property {string} id - UUID
 * @property {string} name - Customer name
 * @property {string} phone - Contact phone
 * @property {string} email - Contact email
 * @property {'group' | 'corporate' | 'birthday' | 'academy' | 'cafe' | 'general'} inquiry_type
 * @property {string} facility - Target facility
 * @property {string} preferred_date - Date requested
 * @property {string} preferred_time - Time window
 * @property {number} group_size - Approximate guests
 * @property {string} message - Special requests
 * @property {'new' | 'in_review' | 'contacted' | 'converted' | 'closed'} status
 * @property {string} created_at
 */

export const USER_ROLES = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
  ADMIN: 'admin'
};
