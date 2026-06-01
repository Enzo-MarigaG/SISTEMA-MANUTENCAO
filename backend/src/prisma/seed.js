const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const users = [
    {
      name: 'Enzo',
      email: 'enzomariga1@gmail.com',
      password: 'Copagenzo123',
      role: 'ADMIN',
      pixKey: null,
    },
    {
      name: 'Ariel',
      email: 'kedffe@gmail.com',
      password: 'Ariel#4321',
      role: 'ADMIN',
      pixKey: '(54) 992665632',
    },
  ];

  for (const user of users) {
    const hashed = await bcrypt.hash(user.password, 10);
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        pixKey: user.pixKey,
      },
      create: {
        name: user.name,
        email: user.email,
        password: hashed,
        role: user.role,
        pixKey: user.pixKey,
      },
    });
    console.log(`✅ Usuário: ${created.name} (${created.email}) — PIX: ${created.pixKey ?? 'não definido'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
