import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';
import { UserRole, UserStatus } from '../src/types/enums';
import { signAccessToken } from '../src/services/token.service';

export async function createUser(overrides: Partial<{
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  status: UserStatus;
}> = {}) {
  const password = overrides.password ?? 'Password123!';
  const passwordHash = await bcrypt.hash(password, 4);

  const user = await User.create({
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? `user${Date.now()}${Math.random()}@test.dev`,
    phone: overrides.phone ?? '9000000000',
    passwordHash,
    role: overrides.role ?? UserRole.AGENT,
    status: overrides.status ?? UserStatus.ACTIVE,
  });

  return { user, password };
}

export function authCookieFor(user: { _id: unknown; role: UserRole; name: string; email: string }): string {
  const token = signAccessToken({
    sub: String(user._id),
    role: user.role,
    name: user.name,
    email: user.email,
  });
  return `accessToken=${token}`;
}
