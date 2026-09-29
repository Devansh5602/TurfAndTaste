export const prototypeFacilities = [
  { id: 'box-cricket', name: 'Box Cricket', venueName: 'Skyline Box Cricket & Training Arena', service: 'Box Cricket', image: '/images/box_cricket.jpg', label: 'Tournament grade', rating: '4.9', reviewCount: '240', location: 'Near Sky City Hub, South Bopal Crossroad', area: 'Bopal, Ahmedabad', distance: '1.2 km away', tariff: '₹700', availability: 'Next: Today 18:30', status: 'Slots Open', description: 'A covered, match-ready arena with evening-friendly lighting.' },
  { id: 'skating-rink', name: 'Skating Rink', venueName: 'The Oval Skating Rink & Courts', service: 'Skating Rink', image: '/images/skating_rink.jpg', label: 'Open rink', rating: '4.8', reviewCount: '115', location: 'Club Road, Near Sunflower School, South Bopal', area: 'South Bopal', distance: '2.5 km away', tariff: '₹600', availability: 'Next: Today 19:00', status: 'Dual Arena', description: 'A smooth, social rink for casual sessions and coached practice.' },
  { id: 'pickle-ball', name: 'Pickle Ball', venueName: 'The Oval Skating Rink & Courts', service: 'Pickle Ball', image: '/images/pickleball.jpg', label: 'Court play', rating: '4.8', reviewCount: '115', location: 'Club Road, Near Sunflower School, South Bopal', area: 'South Bopal', distance: '2.5 km away', tariff: '₹600', availability: 'Next: Today 19:00', status: 'Dual Arena', description: 'A bright, regulation-ready court for quick competitive games.' },
  { id: 'green-net', name: 'Cricket Green Net Practice', venueName: '[Facility Name]', service: 'Cricket Green Net Practice', image: '/images/cricket_nets.jpg', label: 'Practice zone', rating: '4.7', reviewCount: '88', location: 'Ambli-Bopal Road', area: 'Ambli-Bopal Road', distance: '3.1 km away', tariff: '[Configured Tariff]', availability: '[Next available slot]', status: 'Active & Bookable', description: 'Focused net practice for batting, bowling and team drills.' },
  { id: 'shooting-machine', name: 'Cricket Green Net Practice with Shooting Machine', venueName: 'Masterstroke Pro Nets (Shooting Machine)', service: 'Cricket Green Net Practice with Shooting Machine', image: '/images/ball_machine.jpg', label: 'Machine practice', rating: '4.9', reviewCount: '88', location: 'Ambli-Bopal Avenue, Opp. Green Acres', area: 'Ambli-Bopal Road', distance: '3.1 km away', tariff: '₹900', availability: 'Next: Today 18:30', status: 'Pro Edition', description: 'Controlled repetition with a configurable shooting machine.' },
];

export const prototypeOutlets = [
  { id: 'clubhouse-cafe', name: 'Clubhouse Café', kind: 'Café', image: '/images/cafe.jpg', description: 'Fresh bites, comfort drinks and quick refuels between sessions.', hours: 'Open today · 8:00 AM – 10:00 PM', menu: [{ category: 'Refresh', items: [{ name: 'Masala Chai', price: '₹35', veg: true }, { name: 'Fresh Lime Soda', price: '₹55', veg: true }] }, { category: 'Bites', items: [{ name: 'Veggie Sandwich', price: '₹110', veg: true }, { name: 'Paneer Wrap', price: '₹145', veg: true }] }] },
  { id: 'matchday-parlour', name: 'Matchday Parlour', kind: 'Parlour', image: '/images/snack_parlour.jpg', description: 'Convenience essentials for every visit to the grounds.', hours: 'Open today · 7:00 AM – 11:00 PM', menu: [{ category: 'Essentials', items: [{ name: 'Mineral Water', price: '₹20', veg: true }, { name: 'Energy Drink', price: '₹95', veg: true }] }, { category: 'Snacks', items: [{ name: 'Trail Mix', price: '₹70', veg: true }, { name: 'Protein Bar', price: '₹85', veg: true }] }] },
];

export const prototypeEvents = [
  { id: 'monsoon-league', title: 'Monsoon Box Cricket League', date: 'SAT · 12 JUL', time: '4:00 PM onwards', image: '/images/hero_arena.jpg', tag: 'Featured', description: 'A local league evening for teams, families and the wider Turf & Taste community.' },
  { id: 'pickle-social', title: 'Pickle Ball Social', date: 'SUN · 20 JUL', time: '7:00 AM onwards', image: '/images/pickleball.jpg', tag: 'Community', description: 'A relaxed social play session for people new to the game and regulars alike.' },
];

export const infoPages = {
  notices: { title: 'Updates & Notices', body: 'Check the latest facility advisories, special-hours notices and on-ground updates here.' },
  contact: { title: 'Contact & Inquiry', body: 'For venue questions, team bookings or help with a visit, reach the Turf & Taste team during operating hours.' },
  rules: { title: 'Ground Rules & Guidelines', body: 'Arrive on time, use appropriate footwear, treat equipment and fellow players with care, and follow the venue team’s instructions.' },
  about: { title: 'About Turf & Taste', body: 'Turf & Taste brings sport, community and simple food discovery together at one local clubhouse.' },
  terms: { title: 'Terms', body: 'This prototype preserves the curated information-screen treatment without presenting legal or compliance claims.' },
  privacy: { title: 'Privacy', body: 'This prototype uses local, non-production demonstration state only. It does not create a real customer account.' },
};
