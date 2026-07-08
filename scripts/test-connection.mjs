import pg from 'pg';
const { Client } = pg;

const regions = [
  'sa-east-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-central-1'
];
const poolers = ['aws-0', 'aws-1'];

async function test(prefix, region) {
  const host = `${prefix}-${region}.pooler.supabase.com`;
  const client = new Client({
    host: host,
    port: 6543,
    user: 'postgres.fiuqspnmpuvtlhoklfqp',
    password: '@Kalled2089@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log(`SUCCESS connected to ${host}!`);
    await client.end();
    return true;
  } catch (e) {
    if (e.message.includes('not found')) {
      // tenant not found
      return false;
    }
    console.log(`Failed connecting to ${host}:`, e.message);
    return false;
  }
}

async function run() {
  console.log("Searching for correct region & pooler...");
  for (const prefix of poolers) {
    for (const r of regions) {
      if (await test(prefix, r)) {
        console.log(`\nFOUND: ${prefix}-${r}`);
        return;
      }
    }
  }
  console.log("Search finished.");
}
run();
