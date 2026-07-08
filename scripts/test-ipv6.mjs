import pg from 'pg';
import dns from 'dns';

const { Client } = pg;

async function run() {
  console.log("Resolving db.fiuqspnmpuvtlhoklfqp.supabase.co via resolve6...");
  try {
    const addresses = await dns.promises.resolve6('db.fiuqspnmpuvtlhoklfqp.supabase.co');
    console.log("Resolved IPv6 addresses:", addresses);
    if (addresses.length === 0) {
      console.log("No IPv6 addresses found.");
      return;
    }
    
    const ipv6 = addresses[0];
    console.log(`Connecting to pg at [${ipv6}]...`);
    const client = new Client({
      host: ipv6,
      port: 5432,
      user: 'postgres',
      password: '@Kalled2089@',
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log("Successfully connected via IPv6!");
    await client.end();
  } catch (e) {
    console.error("Failed:", e);
  }
}
run();
