// Integration tests use fresh in-memory databases (src/test/db.ts): no secrets, no network.
process.env.GUILDHALL_DATA_DIR = "memory://";
