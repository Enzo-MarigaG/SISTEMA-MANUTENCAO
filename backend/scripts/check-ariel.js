// Diagnostica e (opcionalmente) corrige o login do Ariel.
// Uso na VPS, dentro de backend/:
//   node scripts/check-ariel.js          -> só mostra o estado do usuário
//   node scripts/check-ariel.js --reset  -> reseta a senha p/ a do .env.production e ativa
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const EMAIL = process.env.SEED_USER2_EMAIL || 'arielrommel17@gmail.com';
const PASSWORD = process.env.SEED_USER2_PASSWORD || 'arcAriel17';
const DO_RESET = process.argv.includes('--reset');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });

  if (!user) {
    console.log(`❌ Não existe usuário com email "${EMAIL}".`);
    if (DO_RESET) {
      const hashed = await bcrypt.hash(PASSWORD, 10);
      const created = await prisma.user.create({
        data: { name: process.env.SEED_USER2_NAME || 'Ariel', email: EMAIL, password: hashed, role: 'ADMIN', pixKey: process.env.SEED_USER2_PIXKEY || null },
      });
      console.log(`✅ Usuário criado: ${created.email}`);
    }
    return;
  }

  console.log('Usuário encontrado:');
  console.log({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active });

  const match = await bcrypt.compare(PASSWORD, user.password);
  console.log(`Senha "${PASSWORD}" confere com o hash do banco? ${match ? '✅ SIM' : '❌ NÃO'}`);
  console.log(`Conta ativa? ${user.active ? '✅ SIM' : '❌ NÃO (login é bloqueado)'}`);

  if (DO_RESET) {
    const hashed = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.update({ where: { email: EMAIL }, data: { password: hashed, active: true } });
    console.log(`\n✅ Senha redefinida para "${PASSWORD}" e conta ativada.`);
  }
}

main()
  .catch((e) => console.error('ERRO:', e.message))
  .finally(() => prisma.$disconnect());
