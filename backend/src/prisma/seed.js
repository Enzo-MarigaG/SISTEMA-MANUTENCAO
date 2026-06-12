const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const users = [
    {
      name:     process.env.SEED_USER1_NAME     ?? 'Usuário 1',
      email:    process.env.SEED_USER1_EMAIL    ?? '',
      password: process.env.SEED_USER1_PASSWORD ?? '',
      role: 'ADMIN',
      pixKey: process.env.SEED_USER1_PIXKEY ?? null,
    },
    {
      name:     process.env.SEED_USER2_NAME     ?? 'Usuário 2',
      email:    process.env.SEED_USER2_EMAIL    ?? '',
      password: process.env.SEED_USER2_PASSWORD ?? '',
      role: 'ADMIN',
      pixKey: process.env.SEED_USER2_PIXKEY ?? null,
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
      update: { name: user.name, pixKey: user.pixKey },
      create: {
        name: user.name,
        email: user.email,
        password: hashed,
        role: user.role,
        pixKey: user.pixKey,
      },
    });
    console.log(`✅ ${created.name} (${created.email}) — PIX: ${created.pixKey ?? 'não definido'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
