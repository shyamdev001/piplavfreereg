import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { UserRole, UserStatus } from '../types/enums';

/**
 * Creates the admin account from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Unlike `seed`, this never deletes anything and adds no sample data, so it is
 * safe to run against a fresh production database.
 */
async function createAdmin() {
  await connectDatabase();

  const existing = await User.findOne({ email: env.seedAdminEmail.toLowerCase() });
  if (existing) {
    console.log(`[create-admin] ${existing.email} already exists - nothing changed.`);
  } else {
    const admin = await User.create({
      name: 'Piplav Admin',
      email: env.seedAdminEmail,
      phone: '9000000000',
      passwordHash: await bcrypt.hash(env.seedAdminPassword, 12),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    console.log(`[create-admin] created admin ${admin.email} (password: SEED_ADMIN_PASSWORD from .env)`);
  }

  await disconnectDatabase();
}

createAdmin().catch((err) => {
  console.error('[create-admin] failed:', err);
  process.exit(1);
});
