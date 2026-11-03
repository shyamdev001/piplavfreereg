import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Lead } from '../models/Lead';
import { Counter } from '../models/Counter';
import { AuditLog } from '../models/AuditLog';
import { generateLeadId } from '../utils/generateLeadId';
import { CustomerType, LeadStatus, UserRole, UserStatus } from '../types/enums';

const FAKE_AGENTS = [
  { name: 'Amit Sharma', email: 'amit.agent@solarcoop.dev', phone: '9800000001' },
  { name: 'Priya Verma', email: 'priya.agent@solarcoop.dev', phone: '9800000002' },
  { name: 'Rohan Iyer', email: 'rohan.agent@solarcoop.dev', phone: '9800000003' },
];

const FAKE_CUSTOMER_NAMES = [
  'Rahul Patel', 'Mehul Shah', 'Sunita Deshmukh', 'Vikram Nair', 'Anita Joshi',
  'Karan Malhotra', 'Neha Kulkarni', 'Sanjay Reddy', 'Pooja Mehta', 'Arjun Singh',
  'Divya Menon', 'Rajesh Gupta', 'Kavita Rao', 'Manoj Tiwari', 'Shreya Kapoor',
  'Deepak Chauhan', 'Anjali Bhatt', 'Vivek Pandey', 'Ritu Saxena', 'Nikhil Agarwal',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomMobile(): string {
  return `9${Math.floor(100000000 + Math.random() * 899999999)}`.slice(0, 10);
}

async function seed() {
  await connectDatabase();

  console.log('[seed] clearing existing development data...');
  await Promise.all([User.deleteMany({}), Lead.deleteMany({}), Counter.deleteMany({}), AuditLog.deleteMany({})]);

  console.log('[seed] creating admin account...');
  const adminPasswordHash = await bcrypt.hash(env.seedAdminPassword, 12);
  const admin = await User.create({
    name: 'Solar Coop Admin',
    email: env.seedAdminEmail,
    phone: '9000000000',
    passwordHash: adminPasswordHash,
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });

  console.log('[seed] creating field agents...');
  const agentPasswordHash = await bcrypt.hash('AgentPass123!', 12);
  const agents = await User.insertMany(
    FAKE_AGENTS.map((a) => ({
      ...a,
      passwordHash: agentPasswordHash,
      role: UserRole.AGENT,
      status: UserStatus.ACTIVE,
    })),
  );

  console.log('[seed] creating sample Piplav registrations (no real documents attached)...');
  const statuses = Object.values(LeadStatus).filter((s) => s !== LeadStatus.ARCHIVED);

  for (let i = 0; i < FAKE_CUSTOMER_NAMES.length; i++) {
    const leadId = await generateLeadId();
    const agent = randomFrom(agents);

    await Lead.create({
      leadId,
      createdBy: agent._id,
      isDraft: false,
      status: randomFrom(statuses),
      customerBasicDetails: {
        fullName: FAKE_CUSTOMER_NAMES[i],
        fatherHusbandName: 'S/o Test Parent',
        mobileNumber: randomMobile(),
        customerType: CustomerType.RESIDENTIAL,
      },
      customerAddress: {
        fullAddress: `${100 + i}, Sample Faliyu, Piplav`,
        cityVillage: 'Piplav',
        district: 'Anand',
        state: 'Gujarat',
        pincode: '388460',
      },
      solarInformation: {
        requiredSystemSizeKw: 2.18,
      },
      electricityDetails: {
        consumerName: FAKE_CUSTOMER_NAMES[i],
        consumerNumber: `TEST-${100000 + i}`,
      },
      notes: 'Seed data - for development/testing only.',
      documents: [],
    });
  }

  console.log('\n[seed] Done!\n');
  console.log('----------------------------------------');
  console.log(' Admin login');
  console.log(`   email:    ${admin.email}`);
  console.log(`   password: ${env.seedAdminPassword}`);
  console.log(' Agent login (all agents share this dev password)');
  console.log(`   password: AgentPass123!`);
  agents.forEach((a) => console.log(`   email:    ${a.email}`));
  console.log('----------------------------------------');
  console.log('IMPORTANT: these are development-only credentials.');
  console.log('Change the admin password immediately in any shared/production environment.\n');

  await disconnectDatabase();
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
