// Starts every end-to-end run from an empty built-in database, the way a fresh copy of the repo starts. Only ever
// removes a folder whose name says it belongs to the e2e tests.
import { rmSync } from 'node:fs';

const dir = process.env.GUILDHALL_DATA_DIR ?? '';
if (!/e2e/.test(dir)) {
  console.error(`clean-e2e-data: refusing to remove "${dir}" (not an e2e folder)`);
  process.exit(1);
}
rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
