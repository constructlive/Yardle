import { randomUUID } from "node:crypto";
import { closePool, query } from "../src/lib/db";
import { loadLocalEnv } from "./env";

const defaultEstate = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Yardle Industrial Estate",
  address: "Unit Road, Walsall, WS1 1AA",
  contactEmail: "billing@yardle.local",
  contactPhone: "",
  logoUrl: null,
  defaultKwhRatePence: 32,
  defaultStandingChargePence: 500,
  defaultLevyPence: 0,
  currency: "GBP",
  smsSenderName: "Yardle"
};

function getDefaultSettings() {
  return [
    ["app.name", "Yardle"],
    ["app.tagline", "Smart Estate Management"],
    ["sms.provider", process.env.SMS_PROVIDER || "mock"],
    ["billing.currency", "GBP"]
  ] as const;
}

async function seedEstate() {
  const existing = await query<{ id: string }>("select id from estates order by created_at limit 1");
  if (existing.rows[0]) {
    return { created: false, id: existing.rows[0].id };
  }

  await query(
    `insert into estates (id, name, address, contact_email, contact_phone, logo_url, default_kwh_rate_pence, default_standing_charge_pence, default_levy_pence, currency, sms_sender_name, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, utc_timestamp())`,
    [
      defaultEstate.id,
      defaultEstate.name,
      defaultEstate.address,
      defaultEstate.contactEmail,
      defaultEstate.contactPhone,
      defaultEstate.logoUrl,
      defaultEstate.defaultKwhRatePence,
      defaultEstate.defaultStandingChargePence,
      defaultEstate.defaultLevyPence,
      defaultEstate.currency,
      defaultEstate.smsSenderName
    ]
  );

  return { created: true, id: defaultEstate.id };
}

async function seedSettings() {
  let created = 0;
  let skipped = 0;

  for (const [key, value] of getDefaultSettings()) {
    const result = await query(
      `insert into settings (id, setting_key, setting_value, created_at, updated_at)
       values (?, ?, ?, utc_timestamp(), utc_timestamp())
       on duplicate key update setting_key = setting_key`,
      [randomUUID(), key, JSON.stringify(value)]
    );

    if (result.affectedRows === 1) {
      created += 1;
    } else {
      skipped += 1;
    }
  }

  return { created, skipped };
}

async function main() {
  loadLocalEnv();

  try {
    const estate = await seedEstate();
    const settings = await seedSettings();

    console.log("Database seed complete.");
    console.log(`${estate.created ? "Created" : "Skipped existing"} estate: ${estate.id}`);
    console.log(`Settings created: ${settings.created}`);
    console.log(`Settings skipped: ${settings.skipped}`);
    console.log("Demo tenants were not seeded. Use a dedicated demo import/seed only when required.");
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error("Failed to seed database:", error);
  process.exit(1);
});