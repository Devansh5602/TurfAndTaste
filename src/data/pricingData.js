export const pricingTiers = [
  {
    facilityId: 'box-cricket',
    facilityName: 'Box Cricket Arena',
    badge: 'Most Popular',
    popular: true,
    dayRate: '₹___',
    nightRate: '₹___',
    dayHours: '6:00 AM – 4:00 PM',
    nightHours: '4:00 PM – 11:30 PM (Floodlights)',
    bookingDeposit: '₹___',
    includedItems: [
      'Full arena access with enclosed boundary netting',
      'Tournament-spec synthetic astro-turf surface',
      'Standard cricket gear (bats, wickets, balls)',
      'Digital scoreboard and dugout seating',
      'Complimentary drinking water & gear sanitation'
    ],
    groupRecommendation: 'Ideal for 10-16 players'
  },
  {
    facilityId: 'pickleball',
    facilityName: 'Pickleball Courts',
    badge: 'Trending Sport',
    popular: false,
    dayRate: '₹___',
    nightRate: '₹___',
    dayHours: '6:00 AM – 4:00 PM',
    nightHours: '4:00 PM – 11:30 PM (LED Floodlit)',
    bookingDeposit: '₹___',
    includedItems: [
      'Regulation USAPA 44x20 ft cushioned acrylic court',
      'Tournament net system with micro-adjusters',
      '2 to 4 player entry per court booking',
      'Outdoor court ball set included',
      'Paddle rental available on-site'
    ],
    groupRecommendation: 'Ideal for 2 to 4 players (Singles or Doubles)'
  },
  {
    facilityId: 'skating',
    facilityName: 'Skating Rink',
    badge: 'All Skill Levels',
    popular: false,
    dayRate: '₹___',
    nightRate: '₹___',
    dayHours: '7:00 AM – 4:00 PM',
    nightHours: '4:00 PM – 11:00 PM (Ambient Glow)',
    bookingDeposit: '₹___',
    includedItems: [
      '60-minute open rink session pass',
      'Complimentary standard skate rental (Inline/Quad)',
      'Protective helmet and safety pads set',
      'Access to beginner perimeter training bars',
      'Resident track steward supervision'
    ],
    groupRecommendation: 'Great for individuals, kids & family groups'
  },
  {
    facilityId: 'cricket-nets',
    facilityName: 'Cricket Practice Nets',
    badge: 'Performance Training',
    popular: false,
    dayRate: '₹___',
    nightRate: '₹___',
    dayHours: '6:00 AM – 4:00 PM',
    nightHours: '4:00 PM – 11:00 PM',
    bookingDeposit: '₹___',
    includedItems: [
      'Single lane 72-ft turf practice pitch',
      'High-safety divider netting enclosure',
      'Spring-loaded target stumps set',
      'Permits 1 batsman + up to 2 bowlers',
      'Bowling run-up marker cones'
    ],
    groupRecommendation: 'Ideal for serious batsmen & bowler pairs'
  },
  {
    facilityId: 'ball-machine',
    facilityName: 'Ball-Shooting Machine Lane',
    badge: 'High-Tech Drill',
    popular: true,
    dayRate: '₹___',
    nightRate: '₹___',
    dayHours: '7:00 AM – 4:00 PM',
    nightHours: '4:00 PM – 10:30 PM',
    bookingDeposit: '₹___',
    includedItems: [
      'Automated programmable bowling machine',
      'Calibrated speeds from 60 km/h up to 150+ km/h',
      'Swing, seam, spin, yorker, & bouncer variations',
      'Certified Turf & Taste operator to feed & calibrate',
      '100+ delivery balls per hour session'
    ],
    groupRecommendation: 'High-repetition solo batting stroke training'
  },
  {
    facilityId: 'cafe-combos',
    facilityName: 'Café & Party Deck Packages',
    badge: 'Celebrations',
    popular: false,
    dayRate: '₹___',
    nightRate: '₹___',
    dayHours: 'Starting per person',
    nightHours: 'Starting per person',
    bookingDeposit: '₹___',
    includedItems: [
      'Reserved lounge seating booths or garden turf deck',
      'Customized 3-course athlete menu / party menu',
      'Welcome energy smoothies or artisan mocktails',
      'Live stadium match broadcast on 4K screens',
      'Dedicated café host and service staff'
    ],
    groupRecommendation: 'Birthday parties, corporate teams, and match screenings'
  }
];

export const durationMultipliers = [
  { label: '1 Hour', value: 1, discount: 'Standard' },
  { label: '2 Hours', value: 2, discount: 'Best Value' },
  { label: '3 Hours', value: 3, discount: 'Tournament Block' },
  { label: 'Half Day (5 Hours)', value: 5, discount: 'Special Rate' }
];

export const paymentOptionsInfo = [
  {
    id: 'deposit',
    title: 'Option 1: Booking Amount (Token Deposit)',
    subtitle: 'Lock in your preferred date and slot with a small token deposit.',
    description: 'Guarantees your slot reservation immediately. The remaining amount is comfortably settled at our arena reception desk via UPI, cash, or card when your squad arrives for the game.',
    badge: 'Flexible & Popular',
    recommended: true
  },
  {
    id: 'full',
    title: 'Option 2: 100% Full Payment',
    subtitle: 'Pay the complete booking fee upfront for express seamless entry.',
    description: 'Zero wait times on game day. Walk straight onto the pitch or court without any billing stop at reception. Digital receipt and instant check-in pass sent directly to your phone.',
    badge: 'Express Check-in',
    recommended: false
  }
];
