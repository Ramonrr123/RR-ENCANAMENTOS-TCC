# RR Encanamentos — ERP (TCC)

Sistema de gestão integrada (ERP) para a RR Encanamentos. Frontend React + Vite, API NestJS e banco PostgreSQL (Docker local ou Supabase). Publicação na Vercel.

Autor: Ramon Rocha.

## Requisitos

- Node.js 20+ (recomendado 22)
- npm
- Docker Desktop (Postgres local via `docker-compose.yml`)
- Git

## Variáveis de ambiente

Copie os exemplos e preencha os valores localmente. **Não** versione arquivos `.env` com segredos.

### Backend (`backend/.env`)

| Nome | Uso |
|------|-----|
| `DATABASE_URL` | Connection string do Postgres |
| `JWT_SECRET` | Segredo para assinar JWT |
| `PORT` | Porta HTTP da API (padrão 3001) |
| `API_GLOBAL_PREFIX` | Prefixo opcional das rotas (ex.: `api` na Vercel) |
| `TEST_DATABASE_URL` | Opcional: banco só para testes automatizados |

Referência: `backend/.env.example`.

### Frontend (`frontend/.env`)

| Nome | Uso |
|------|-----|
| `VITE_API_URL` | URL base da API (em dev: `http://localhost:3001`) |

Referência: `frontend/.env.example`.

## Postgres local (Docker)

```bash
docker compose up -d
```

Aponte `DATABASE_URL` do backend para esse banco. Para parar: `docker compose down`.

## Instalação

```bash
cd backend
cp .env.example .env
npm install

cd ../frontend
cp .env.example .env
npm install
```

## Migrações

```bash
cd backend
npx prisma migrate deploy
```

## Seed (simulação)

```bash
npm run seed
```

Logins de demonstração local:

- administrador: `admin` / `admin123`
- funcionários: `encanador.tcc`, `pedreiro.tcc`, `pintor.tcc`, `eletricista.tcc` / `func123`

## Rodar

```bash
cd backend
npm run start:dev

cd frontend
npm run dev
```

Saúde da API:

```powershell
pwsh -File scripts/checar-health.ps1
```

## Publicar na Vercel

O `vercel.json` define frontend (Vite) e backend (container), com rewrite de `/api/*` para a API.

1. Conecte este repositório ao projeto Vercel.
2. Configure `DATABASE_URL` (Supabase), `JWT_SECRET`, `API_GLOBAL_PREFIX=api` e `VITE_API_URL=/api`.
3. Aplique as migrações no banco publicado com `prisma migrate deploy`.
4. Não rode o seed de demonstração no banco de produção da empresa.

## Documentação de produto

Requisitos: `docs/PRD.md`.
