import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { UserRole, UserStatus } from '../types/enums';

/**
 * Creates the admin account from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Unlike `seed`, this never deletes anything and adds no sample data, so it is
 * safe to run against a fresh production database. Pass --reset-password to
 * set an existing admin's password to SEED_ADMIN_PASSWORD.
 */
async function createAdmin() {
  await connectDatabase();

  const existing = await User.findOne({ email: env.seedAdminEmail.toLowerCase() });
  if (existing && process.argv.includes('--reset-password')) {
    existing.passwordHash = await bcrypt.hash(env.seedAdminPassword, 12);
    existing.status = UserStatus.ACTIVE;
    await existing.save();
    console.log(`[create-admin] reset the password for ${existing.email} to SEED_ADMIN_PASSWORD from .env`);
  } else if (existing) {
    console.log(`[create-admin] ${existing.email} already exists - nothing changed (use --reset-password to set a new password).`);
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
