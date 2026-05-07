# =====================================================================
# Multi-stage Dockerfile — Sistema de Gestão de Pacotes em Condomínios
# =====================================================================
# Stages:
#   - deps        : instala dependências (cache layer otimizado)
#   - development : roda `next dev` (usado por app + worker em dev)
#   - builder     : compila Next.js para produção
#   - production  : imagem final mínima (usada em story 8.4 — deploy VPS)
# =====================================================================

# ---------- Base ----------
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat tini
ENV NODE_ENV=development
# tini = init process leve (PID 1) para evitar zombie processes em containers

# ---------- Stage: deps ----------
FROM base AS deps
COPY package.json package-lock.json ./
# Schema Prisma precisa estar presente no `npm ci` por causa do postinstall (prisma generate)
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------- Stage: development ----------
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
# Código-fonte é montado via bind mount no docker-compose dev
# (não fazemos COPY do src/ pra permitir hot reload)
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev"]

# ---------- Stage: builder ----------
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- Stage: production ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
