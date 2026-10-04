import { createOwnerPasswordHash } from '../apps/api/src/auth/owner-auth.js';

const password = process.env.MIRAICHI_OWNER_PASSWORD ?? '';
if (password.length < 12) {
  throw new Error('Set MIRAICHI_OWNER_PASSWORD to at least 12 characters before running this command.');
}

const hash = await createOwnerPasswordHash(password);
process.stdout.write(`${hash}\n`);
