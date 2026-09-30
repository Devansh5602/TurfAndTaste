/**
 * Authoritative Turf & Taste Physical Inventory Model
 * 
 * Location: Patan, Gujarat, India (Asia/Kolkata)
 * 
 * Hierarchy:
 * Property -> Section -> Physical Facility -> Supported Service -> Add-On
 * 
 * Physical Resources:
 * - 2 Box Cricket Turfs (Turf 1, Turf 2)
 * - 2 Pickleball Courts (Court 1, Court 2)
 * - 1 Skating Rink (Rink 1)
 * - 1 Cricket Green Net Area (Green Net 1)
 * 
 * Critical Invariant:
 * The Ball-Shooting Machine is an optional paid ADD-ON on the single Cricket Green Net physical facility.
 * It is NOT a standalone court. Any booking using the shooting machine occupies the same physical resource
 * (fac_green_net_1) as standard net practice, creating a direct physical resource conflict.
 */

export const CANONICAL_PROPERTY = {
  id: 'prop_patan',
  name: 'Turf & Taste',
  city: 'Patan',
  state: 'Gujarat',
  country: 'India',
  timezone: 'Asia/Kolkata'
};

export const CANONICAL_SECTIONS = [
  {
    id: 'sec_sports',
    propertyId: 'prop_patan',
    code: 'SPORTS',
    displayName: 'Sports & Recreational Arena',
    sectionType: 'SPORTS',
    displayOrder: 1
  },
  {
    id: 'sec_dining',
    propertyId: 'prop_patan',
    code: 'DINING',
    displayName: 'Turf & Taste Campus Dining',
    sectionType: 'DINING',
    displayOrder: 2
  }
];

export const CANONICAL_FACILITIES = [
  {
    id: 'fac_box_cricket_1',
    sectionId: 'sec_sports',
    code: 'box-cricket-turf-1',
    defaultName: 'Box Cricket Turf 1',
    customName: 'Box Cricket Turf 1',
    capacity: 16,
    isActive: true,
    isBookable: true
  },
  {
    id: 'fac_box_cricket_2',
    sectionId: 'sec_sports',
    code: 'box-cricket-turf-2',
    defaultName: 'Box Cricket Turf 2',
    customName: 'Box Cricket Turf 2',
    capacity: 16,
    isActive: true,
    isBookable: true
  },
  {
    id: 'fac_pickleball_1',
    sectionId: 'sec_sports',
    code: 'pickleball-court-1',
    defaultName: 'Pickleball Court 1',
    customName: 'Pickleball Court 1',
    capacity: 4,
    isActive: true,
    isBookable: true
  },
  {
    id: 'fac_pickleball_2',
    sectionId: 'sec_sports',
    code: 'pickleball-court-2',
    defaultName: 'Pickleball Court 2',
    customName: 'Pickleball Court 2',
    capacity: 4,
    isActive: true,
    isBookable: true
  },
  {
    id: 'fac_skating_1',
    sectionId: 'sec_sports',
    code: 'skating-rink-1',
    defaultName: 'Skating Rink 1',
    customName: 'Skating Rink',
    capacity: 25,
    isActive: true,
    isBookable: true
  },
  {
    id: 'fac_green_net_1',
    sectionId: 'sec_sports',
    code: 'cricket-green-net-1',
    defaultName: 'Cricket Green Net 1',
    customName: 'Cricket Practice Net',
    capacity: 8,
    isActive: true,
    isBookable: true
  }
];

export const CANONICAL_SERVICES = [
  {
    id: 'srv_box_cricket',
    sectionId: 'sec_sports',
    code: 'box-cricket',
    name: 'Box Cricket',
    supportedFacilityIds: ['fac_box_cricket_1', 'fac_box_cricket_2']
  },
  {
    id: 'srv_pickleball',
    sectionId: 'sec_sports',
    code: 'pickleball',
    name: 'Pickleball',
    supportedFacilityIds: ['fac_pickleball_1', 'fac_pickleball_2']
  },
  {
    id: 'srv_skating',
    sectionId: 'sec_sports',
    code: 'skating',
    name: 'Skating',
    supportedFacilityIds: ['fac_skating_1']
  },
  {
    id: 'srv_green_net',
    sectionId: 'sec_sports',
    code: 'cricket-green-net',
    name: 'Cricket Green Net Practice',
    supportedFacilityIds: ['fac_green_net_1']
  }
];

export const CANONICAL_ADD_ONS = [
  {
    id: 'addon_shooting_machine',
    sectionId: 'sec_sports',
    code: 'shooting-machine',
    name: 'Ball-Shooting Machine',
    description: 'High-precision automated ball-throwing machine for cricket practice.',
    applicableFacilityIds: ['fac_green_net_1'],
    isActive: true
  }
];

/**
 * Maps legacy sport string or facility profile ID to canonical physical facility ID(s).
 */
export function mapLegacyFacilityToPhysical(legacyId) {
  const norm = String(legacyId || '').toLowerCase().trim();
  switch (norm) {
    case 'box-cricket':
    case 'box cricket':
      // By default returns both available physical turfs
      return ['fac_box_cricket_1', 'fac_box_cricket_2'];
    case 'pickleball':
      return ['fac_pickleball_1', 'fac_pickleball_2'];
    case 'skating':
      return ['fac_skating_1'];
    case 'cricket-nets':
    case 'cricket practice nets':
    case 'ball-machine': // Reclassified legacy ID
    case 'ball-shooting machine lane':
      return ['fac_green_net_1'];
    default:
      return [];
  }
}

/**
 * Determines whether two booking requests use the same underlying physical resource.
 */
export function isSamePhysicalResource(facilityIdA, facilityIdB) {
  if (!facilityIdA || !facilityIdB) return false;
  return facilityIdA === facilityIdB;
}
