// Public food records intentionally replace only the dining subset of the
// legacy facility presentation. This preserves the mature sports discovery
// path and lets a successful empty/active-only food response remain
// authoritative without losing the offline static fallback.
export const mergePublicFoodIntoFacilities = (facilities, stalls) => {
  if (!Array.isArray(stalls)) return facilities;

  const staticById = new Map(facilities.filter((item) => item.category === 'dining').flatMap((item) => [[item.id, item], [item.slug, item]]));
  const nonDining = facilities.filter((item) => item.category !== 'dining');
  const publicDining = stalls.map((stall) => {
    const fallback = staticById.get(stall.id) || staticById.get(stall.slug) || {};
    const metadata = stall.metadata || {};
    return {
      ...fallback,
      id: stall.id,
      slug: stall.slug,
      name: stall.name,
      category: 'dining',
      image: stall.coverImageUrl || fallback.image,
      shortDesc: stall.shortDescription || fallback.shortDesc || 'Walk-in food and refreshments at Turf & Taste.',
      fullDesc: stall.description || fallback.fullDesc || stall.shortDescription || '',
      tag: metadata.tag || fallback.tag || (stall.stallType === 'parlour' ? 'Quick Fuel' : 'Food & Refreshments'),
      badge: metadata.badge || fallback.badge,
      specs: metadata.specs || fallback.specs || {},
      highlights: metadata.highlights || fallback.highlights || [],
      suitableFor: metadata.suitableFor || fallback.suitableFor || [],
      rules: metadata.rules || fallback.rules || [],
      pricing: metadata.legacyPricing || fallback.pricing || { standardRate: 'Counter menu prices' },
      bookingEnabled: false,
    };
  });
  return [...nonDining, ...publicDining];
};
