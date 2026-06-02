import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const users = [
    {
      name:  process.env.SEED_USER1_NAME  ?? 'Usuário 1',
      email: process.env.SEED_USER1_EMAIL ?? '',
      password: process.env.SEED_USER1_PASSWORD ?? '',
      role: 'ADMIN' as const,
    },
    {
      name:  process.env.SEED_USER2_NAME  ?? 'Usuário 2',
      email: process.env.SEED_USER2_EMAIL ?? '',
      password: process.env.SEED_USER2_PASSWORD ?? '',
      role: 'ADMIN' as const,
    },
  ];

  for (const user of users) {
    if (!user.email || !user.password) {
      console.warn(`⚠️  Pulando usuário sem email/senha: ${user.name}`);
      continue;
    }
    const hashed = await bcrypt.hash(user.password, 10);
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        name: user.name,
        email: user.email,
        password: hashed,
        role: user.role,
      },
    });
    console.log(`✅ Usuário: ${created.name} (${created.email})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
