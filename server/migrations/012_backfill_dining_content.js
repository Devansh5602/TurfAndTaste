/**
 * Seed/backfill managed food stalls, parlour content, categories, and menu items
 * from the established static dining records in facilitiesData.js.
 *
 * Preserves the shared merchant model ('food' vs 'parlour'), integer paise pricing,
 * rich copy, and existing administrator-authored/edited records.
 */
export const id = '012_backfill_dining_content';

const sqlText = (value) => `'${String(value ?? '').replace(/'/g, "''")}'`;
const sqlTextOrNull = (value) => (value == null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);
const sqlJson = (value) => sqlText(JSON.stringify(value));
const sqlBool = (value, isPostgres) => (isPostgres ? (value ? 'TRUE' : 'FALSE') : (value ? '1' : '0'));

export async function up({ isPostgres, exec }) {
  const { facilitiesData } = await import('../../src/data/facilitiesData.js');

  const diningFacilities = facilitiesData.filter((f) => f.category === 'dining');

  for (const [stallOrder, facility] of diningFacilities.entries()) {
    const isParlour = facility.id === 'snack-parlours' || facility.slug === 'snack-parlours';
    const stallType = isParlour ? 'parlour' : 'food';

    const metadata = {
      tag: facility.tag,
      badge: facility.badge,
      specs: facility.specs,
      highlights: facility.highlights,
      suitableFor: facility.suitableFor,
      legacyPricing: facility.pricing,
      rules: facility.rules,
      seededFrom: 'src/data/facilitiesData.js',
    };

    const operatingHours = isParlour
      ? [{ day: 'all', opensAtMinutes: 360, closesAtMinutes: 1410, label: '6:00 AM – 11:30 PM' }]
      : [{ day: 'all', opensAtMinutes: 420, closesAtMinutes: 1410, label: '7:00 AM – 11:30 PM' }];

    const contact = isParlour
      ? { location: 'Concourse side near Box Cricket & Skating entry points' }
      : { location: 'Open-Air Terrace & Indoor AC Lounge', phone: '+91 98250 00000', email: 'contact@turfandtaste.com' };

    // 1. Insert or preserve food stall / parlour record
    await exec(`
      INSERT INTO food_stalls (
        id, slug, name, stall_type, status, short_description, description,
        logo_image_url, cover_image_url, operating_hours_json, contact_json,
        metadata_json, display_order
      ) VALUES (
        ${sqlText(facility.id)}, ${sqlText(facility.slug)}, ${sqlText(facility.name)},
        ${sqlText(stallType)}, 'active', ${sqlText(facility.shortDesc)},
        ${sqlText(facility.fullDesc)}, NULL, ${sqlText(facility.image)},
        ${sqlJson(operatingHours)}, ${sqlJson(contact)}, ${sqlJson(metadata)},
        ${stallOrder}
      )
      -- Never overwrite a record which may already be administrator-managed,
      -- even if a particular optional field is blank. This also handles an
      -- existing slug with a different identifier without creating a duplicate.
      ON CONFLICT DO NOTHING;
    `);

    // 2. Define categories and items for this dining venue
    const categories = isParlour
      ? [
          {
            id: 'parlour-hydration-beverages',
            stallId: facility.id,
            slug: 'hydration-energy-drinks',
            name: 'Hydration & Energy Drinks',
            description: 'Instant electrolyte quenchers, tender coconut water, and chilled energy drinks.',
            isActive: true,
            displayOrder: 0,
            items: [
              {
                id: 'parlour-tender-coconut',
                name: 'Fresh Tender Coconut Water',
                description: 'Naturally chilled pure electrolyte water served fresh in the nut.',
                pricePaise: 6000,
                dietaryType: 'vegan',
                isFeatured: true,
                isAvailable: true,
                isActive: true,
                displayOrder: 0,
              },
              {
                id: 'parlour-electrolyte-lemonade',
                name: 'Electrolyte Mint Lemonade',
                description: 'Freshly squeezed lime with pink salt, fresh mint, and mineral hydration.',
                pricePaise: 5000,
                dietaryType: 'vegan',
                isFeatured: false,
                isAvailable: true,
                isActive: true,
                displayOrder: 1,
              },
              {
                id: 'parlour-chilled-cold-coffee',
                name: 'Chilled Bottled Cold Coffee',
                description: 'Thick blended cold coffee bottle for rapid on-the-go tournament energy.',
                pricePaise: 7000,
                dietaryType: 'veg',
                isFeatured: false,
                isAvailable: true,
                isActive: true,
                displayOrder: 2,
              },
            ],
          },
          {
            id: 'parlour-concourse-bites',
            stallId: facility.id,
            slug: 'concourse-bites-snacks',
            name: 'Quick Concourse Bites',
            description: 'Crisp grilled sandwiches, rolls, loaded nachos, and fresh fruit bowls on the fly.',
            isActive: true,
            displayOrder: 1,
            items: [
              {
                id: 'parlour-grilled-cheese-sandwich',
                name: 'Crispy Grilled Cheese Toast',
                description: 'Double-layer spiced potato and melted cheddar toast with mint chutney.',
                pricePaise: 9000,
                dietaryType: 'veg',
                isFeatured: true,
                isAvailable: true,
                isActive: true,
                displayOrder: 0,
              },
              {
                id: 'parlour-veg-kathi-roll',
                name: 'Spiced Veg Kathi Roll',
                description: 'Flaky flatbread rolled with seasoned crunchy vegetables and tangy sauce.',
                pricePaise: 8000,
                dietaryType: 'veg',
                isFeatured: false,
                isAvailable: true,
                isActive: true,
                displayOrder: 1,
              },
              {
                id: 'parlour-loaded-nachos',
                name: 'Concourse Loaded Nachos',
                description: 'Crisp corn tortilla chips smothered in warm cheese sauce with jalapeños.',
                pricePaise: 12000,
                dietaryType: 'veg',
                isFeatured: false,
                isAvailable: true,
                isActive: true,
                displayOrder: 2,
              },
              {
                id: 'parlour-seasonal-fruit-chaat',
                name: 'Fresh Seasonal Fruit Chaat',
                description: 'Chilled seasonal fruit bowl tossed with lemon juice and roasted cumin chaat masala.',
                pricePaise: 6000,
                dietaryType: 'vegan',
                isFeatured: false,
                isAvailable: true,
                isActive: true,
                displayOrder: 3,
              },
            ],
          },
          {
            id: 'parlour-player-combos',
            stallId: facility.id,
            slug: 'player-combos',
            name: 'Player Combos',
            description: 'High-value match refreshment and hydration pairings.',
            isActive: true,
            displayOrder: 2,
            items: [
              {
                id: 'parlour-hydration-combo',
                name: 'Player Hydration Combo (Drink + Snack)',
                description: 'Choice of fresh electrolyte drink or coconut water paired with a hot crispy toast.',
                pricePaise: 9900,
                dietaryType: 'veg',
                isFeatured: true,
                isAvailable: true,
                isActive: true,
                displayOrder: 0,
              },
            ],
          },
        ]
      : [
          {
            id: 'cafe-coffee-beverages',
            stallId: facility.id,
            slug: 'artisan-coffee-beverages',
            name: 'Artisan Coffee & Beverages',
            description: 'Speciality espresso, matcha, cold brews, and refreshing coolers.',
            isActive: true,
            displayOrder: 0,
            items: [
              {
                id: 'cafe-espresso',
                name: 'Artisan Espresso',
                description: 'Rich single-origin roasted espresso shot with velvety crema.',
                pricePaise: 12000,
                dietaryType: 'veg',
                isFeatured: true,
                isAvailable: true,
                isActive: true,
                displayOrder: 0,
              },
              {
                id: 'cafe-matcha-latte',
                name: 'Iced Matcha Latte',
                description: 'Ceremonial grade green tea matcha with chilled oat milk and natural sweetener.',
                pricePaise: 18000,
                dietaryType: 'vegan',
                isFeatured: false,
                isAvailable: true,
                isActive: true,
                displayOrder: 1,
              },
              {
                id: 'cafe-cold-brew',
                name: 'Signature Cold Brew',
                description: '16-hour slow-steeped smooth iced coffee served over crystal clear ice.',
                pricePaise: 15000,
                dietaryType: 'vegan',
                isFeatured: false,
                isAvailable: true,
                isActive: true,
                displayOrder: 2,
              },
            ],
          },
          {
            id: 'cafe-protein-bowls',
            stallId: facility.id,
            slug: 'protein-bowls-healthy',
            name: 'Protein Bowls & Nutrition',
            description: 'Nutrient-dense post-workout recovery power bowls and protein shakes.',
            isActive: true,
            displayOrder: 1,
            items: [
              {
                id: 'cafe-recovery-smoothie',
                name: 'Post-Workout Recovery Smoothie',
                description: 'Cold-pressed berry blend with plant protein, chia seeds, and almond butter.',
                pricePaise: 22000,
                dietaryType: 'vegan',
                isFeatured: true,
                isAvailable: true,
                isActive: true,
                displayOrder: 0,
              },
              {
                id: 'cafe-quinoa-power-bowl',
                name: 'Mediterranean Quinoa Power Bowl',
                description: 'Fluffy quinoa, roasted chickpeas, Hass avocado, baby spinach, and lemon tahini dressing.',
                pricePaise: 24000,
                dietaryType: 'vegan',
                isFeatured: false,
                isAvailable: true,
                isActive: true,
                displayOrder: 1,
              },
            ],
          },
          {
            id: 'cafe-pizzas-burgers',
            stallId: facility.id,
            slug: 'pizzas-burgers-wraps',
            name: 'Pizzas, Burgers & Wraps',
            description: 'Wood-fired artisan pizzas, hand-crafted gourmet burgers, and toasted wraps.',
            isActive: true,
            displayOrder: 2,
            items: [
              {
                id: 'cafe-margherita-pizza',
                name: 'Wood-Fired Margherita Pizza',
                description: 'San Marzano tomato sauce, fresh buffalo mozzarella, and sweet basil on fermented sourdough crust.',
                pricePaise: 32000,
                dietaryType: 'veg',
                isFeatured: true,
                isAvailable: true,
                isActive: true,
                displayOrder: 0,
              },
              {
                id: 'cafe-paneer-tikka-wrap',
                name: 'Charcoal Paneer Tikka Wrap',
                description: 'Tandoor-charred cottage cheese cubes, crisp bell peppers, and mint yoghurt in whole wheat flatbread.',
                pricePaise: 21000,
                dietaryType: 'veg',
                isFeatured: false,
                isAvailable: true,
                isActive: true,
                displayOrder: 1,
              },
            ],
          },
        ];

    // 3. Insert categories and items idempotently (never overwrite administrator edits)
    for (const category of categories) {
      await exec(`
        INSERT INTO food_menu_categories (
          id, stall_id, slug, name, description, is_active, display_order
        ) SELECT
          ${sqlText(category.id)}, ${sqlText(category.stallId)}, ${sqlText(category.slug)},
          ${sqlText(category.name)}, ${sqlTextOrNull(category.description)},
          ${sqlBool(category.isActive, isPostgres)}, ${category.displayOrder}
        WHERE EXISTS (
          SELECT 1 FROM food_stalls
          WHERE id = ${sqlText(category.stallId)}
            AND metadata_json LIKE '%"seededFrom":"src/data/facilitiesData.js"%'
        )
        ON CONFLICT DO NOTHING;
      `);

      for (const item of category.items) {
        await exec(`
          INSERT INTO food_menu_items (
            id, stall_id, category_id, name, description, price_paise,
            image_url, dietary_type, is_available, is_featured, is_active,
            display_order, metadata_json
          ) SELECT
            ${sqlText(item.id)}, ${sqlText(category.stallId)}, ${sqlText(category.id)},
            ${sqlText(item.name)}, ${sqlTextOrNull(item.description)}, ${item.pricePaise},
            NULL, ${sqlText(item.dietaryType)},
            ${sqlBool(item.isAvailable, isPostgres)}, ${sqlBool(item.isFeatured, isPostgres)},
            ${sqlBool(item.isActive, isPostgres)}, ${item.displayOrder},
            ${sqlJson({ seededFrom: 'src/data/facilitiesData.js' })}
          WHERE EXISTS (
            SELECT 1 FROM food_menu_categories
            WHERE id = ${sqlText(category.id)}
              AND stall_id = ${sqlText(category.stallId)}
          )
          ON CONFLICT (id) DO NOTHING;
        `);
      }
    }
  }
}
