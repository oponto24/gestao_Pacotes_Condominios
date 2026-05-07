# Runbook — Storage Abstraction

> **Story:** 1.9 | **Owner:** Dev (Dex) | **Última atualização:** 2026-05-06

## Contexto

`src/lib/storage/` define um contrato `StorageDriver` agnóstico para upload/
download de objetos (fotos de pacotes, QR codes PNG, etc). Hoje a única
implementação é `LocalStorageDriver` (filesystem). Story 8.x pode trocar
por S3/R2 sem mudar callers.

## Como usar

```ts
import { storage } from '@/lib/storage';

// Upload
const result = await storage.put({
  key: 'fotos-pacotes/<condominio_id>/<pacote_id>.jpg',
  body: buffer,
  contentType: 'image/jpeg',
});

// URL pública/lógica para servir ao frontend
const url = storage.publicUrl(result.key);

// Download / delete / check
const obj = await storage.get(key);
await storage.delete(key);
const has = await storage.exists(key);
```

## Convenção de keys

```
<scope>/<condominio_id>/<entity_id>[.<ext>]
```

Exemplos:
- `fotos-pacotes/11111111-.../22222222-....jpg`
- `qrcodes/11111111-.../22222222-....png`

**Restrições defensivas (LocalStorageDriver):**
- Apenas `[a-zA-Z0-9._/-]`
- Sem `..` (path traversal)
- Sem barra inicial
- Tamanho máximo 512 chars
- `path.relative` valida que resolve dentro do `rootDir`

## Variáveis

| Variável | Default | Descrição |
|---|---|---|
| `STORAGE_DRIVER` | `local` | Único valor suportado hoje |
| `STORAGE_LOCAL_ROOT` | `./storage` (host) / `/app/storage` (container) | Raiz do filesystem |

## Layout em disco (dev)

```
storage/                       # gitignored, persistido em volume `storage`
├── fotos-pacotes/
│   └── <condominio_id>/<pacote_id>.jpg
├── qrcodes/
│   └── <condominio_id>/<pacote_id>.png
└── _smoke/                    # endpoint /api/admin/storage/test
```

No `docker-compose.yml`, ambos `app` e `worker` montam o volume nomeado
`storage:/app/storage` para compartilhar arquivos (worker grava QR, app
serve via `publicUrl`).

## Smoke test

Endpoint `POST /api/admin/storage/test` (super-admin only) executa
put → exists → get → delete e retorna metadata. Use após mudanças no
driver ou em deploys.

```bash
curl -X POST http://localhost:3000/api/admin/storage/test \
  -H "Cookie: <clerk_session>"
```

## Backup (dev)

```bash
docker run --rm -v gestao-pacotes-dev_storage:/data -v $PWD:/backup \
  alpine tar czf /backup/storage-$(date +%F).tar.gz -C /data .
```

## Migração futura para S3/R2

Para Story 8.x:
1. Criar `src/lib/storage/s3.ts` implementando `StorageDriver`
2. Adicionar caso no `switch` em `src/lib/storage/index.ts`
3. Definir `STORAGE_DRIVER=s3` + `S3_ENDPOINT/S3_BUCKET/...` em prod
4. Migrar arquivos existentes via script one-off (não há lock-in: keys são
   idênticas entre drivers)
