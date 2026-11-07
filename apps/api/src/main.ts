// Production entry point: applies the database migrations, then starts the HTTP server.
//   npm run build && npm start
import { createDb } from './db/client';
import { migrate } from './db/migrate';
import { migrations } from './db/migrations';
import { start } from './http/server';

export async function main(): Promise<void> {
  const db = createDb();
  try {
    const applied = await migrate(db, migrations);
    if (applied.length) console.log(`migrations applied: ${applied.join(', ')}`);
  } finally {
    db.close();
  }
  const server = await start();
  const address = server.address();
  console.log(`api listening on ${typeof address === 'object' && address ? address.port : address}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
