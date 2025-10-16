import { loadOdooConfig } from '../src/config.js';
import { OdooClient } from '../src/odooClient.js';

async function main() {
  const config = loadOdooConfig();
  const client = new OdooClient(config);

  console.log('Authenticating with Odoo...');
  const uid = await client.authenticate();
  console.log(`Authentication succeeded. UID: ${uid}`);

  console.log('Fetching recent timesheets (limit 5)...');
  const timesheets = await client.findTimesheets({}, 5);
  console.log(`Retrieved ${timesheets.length} record(s).`);

  for (const entry of timesheets) {
    console.log(
      `- [${entry.id}] ${entry.date} ${entry.name} (hours=${entry.unit_amount}, employee=${Array.isArray(entry.employee_id) ? entry.employee_id[1] : 'N/A'})`
    );
  }
}

main().catch(error => {
  console.error('Connection test failed:', error);
  process.exit(1);
});
