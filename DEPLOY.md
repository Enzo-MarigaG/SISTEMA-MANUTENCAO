# Deploy — VPS Hostinger (frontend + backend no mesmo domínio)

Ordem testada. Backend na porta `3001`, frontend na `3000`, Nginx na frente.

## 0. Pré-requisitos na VPS
- Node.js + npm
- PostgreSQL com o banco `manutencao_db` criado
- PM2 global: `npm i -g pm2`
- Nginx

## 1. Enviar os arquivos de ambiente (com os segredos)
Os `.env*` de produção **não** estão no git (contêm segredos), então envie manualmente.

```bash
# Backend: o NestJS só lê o arquivo chamado .env  → RENOMEIE no envio
scp backend/.env.production usuario@SERVIDOR:/caminho/projeto/backend/.env

# Frontend: o Next lê .env.production automaticamente → MANTÉM o nome
scp frontend/.env.production usuario@SERVIDOR:/caminho/projeto/frontend/.env.production
```

> O `.env` do backend precisa estar no lugar **antes** do `npm ci`, porque o
> `postinstall` roda `prisma generate`, que lê o `.env` (via `prisma.config.ts`).

## 2. Backend (pasta `backend/`)
> ⚠️ NÃO exporte `NODE_ENV=production` no shell nem use `--omit=dev`: o build usa
> `prisma`, `@nestjs/cli` e `typescript`, que estão em devDependencies. O
> `NODE_ENV=production` vem só do PM2 (ecosystem).

```bash
cd backend
npm ci                     # postinstall → prisma generate (lê o .env)
npm run build              # gera dist/src/main.js
npx prisma migrate deploy  # cria as tabelas
npm run seed               # cria os 2 usuários — rodar só na 1ª vez
cd ..
```

## 3. Frontend (pasta `frontend/`)
> O `NEXT_PUBLIC_API_URL` é embutido no bundle no `build`, então o
> `.env.production` precisa já estar no lugar (passo 1) antes daqui.
>
> ⚠️ **Não leve o `.env.local` para o servidor.** No Next ele tem precedência
> sobre o `.env.production` e aponta para `http://localhost:3001/api` (dev) — se
> existir na VPS, a URL da API entra errada no bundle. O `git clone` não o traz
> (está no .gitignore); se você copiar a pasta por scp/rsync, exclua-o:
> `rm -f frontend/.env.local` na VPS antes do build.

```bash
cd frontend
rm -f .env.local           # garante que só o .env.production vale
npm ci
npm run build
cd ..
```

## 4. Subir tudo com PM2 (a partir da RAIZ)
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # siga a instrução que ele imprime, p/ subir após reboot
```

## 5. Nginx (proxy reverso)
- `https://SEU_DOMINIO/`      → `http://127.0.0.1:3000` (frontend)
- `https://SEU_DOMINIO/api/`  → `http://127.0.0.1:3001` (backend)

Casa com `COOKIE_CROSS_ORIGIN=false` e `NEXT_PUBLIC_API_URL=https://SEU_DOMINIO/api`.
Use HTTPS (Certbot/Let's Encrypt): o cookie de login tem `secure=true` em produção.

## Atualizações futuras
```bash
git pull
cd backend && npm ci && npm run build && npx prisma migrate deploy && cd ..
cd frontend && npm ci && npm run build && cd ..
pm2 reload ecosystem.config.js
```
(`npm run seed` só na primeira vez.)
