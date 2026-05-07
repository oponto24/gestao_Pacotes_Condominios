# Runbook — AdminLayout

> **Story:** 2.7 | **Owner:** Dev (Dex) | **Última atualização:** 2026-05-06

## Contexto

`AdminLayout` é o chassi visual de todas as telas admin (`/admin/*`). Implementado
via **route group `(admin)`** do Next 15 — pasta entre parênteses não afeta URL,
mas aplica layout shared automaticamente.

**Estrutura:**
```
src/app/(admin)/
├── layout.tsx                 # Server: guard + data fetch + render AdminLayoutClient
├── admin/                     # URLs reais começam aqui
│   ├── page.tsx               # /admin (dashboard)
│   ├── pacotes/page.tsx       # /admin/pacotes
│   ├── setores/page.tsx       # /admin/setores
│   ├── unidades/page.tsx      # /admin/unidades
│   └── moradores/page.tsx     # /admin/moradores
```

**Componentes:**
- `AdminLayoutClient` — composição + state mobile drawer
- `AdminHeader` — sticky header (h-14) com hamburger mobile + nome do condomínio + UserMenu
- `AdminSidebar` — navegação lateral (md+ fixa, mobile via drawer)
- `UserMenu` — dropdown com Avatar (iniciais) + Sair (Clerk SignOutButton)

## Permissões

| Role | Comportamento ao acessar `/admin/*` |
|---|---|
| `admin` | ✅ Vê o layout |
| `super_admin` | Redirect para `/super-admin/condominios` |
| `porteiro` | Redirect para `/` (futuro `/portaria`) |
| `pending_provisioning` | Mensagem "Configurando sua conta…" (sem redirect) |
| Sem auth | Redirect para `/` |

Guard implementado em `src/app/(admin)/layout.tsx`.

## Adicionar nova página `/admin/*`

1. Criar `src/app/(admin)/admin/<rota>/page.tsx`
2. Página herda layout automaticamente — sem boilerplate
3. Para tenant context dentro da página, chamar `getTenantContext()`:

```tsx
import { getTenantContext } from '@/server/middleware/tenant';

export default async function MinhaTelaPage() {
  const ctx = await getTenantContext();
  if (ctx.kind !== 'tenant') return null; // layout já garante, mas TS exige check
  // ... usar ctx.condominioId, ctx.userId
}
```

## Adicionar item à sidebar

Editar `src/components/admin/AdminSidebar.tsx`:

```ts
const TOP_ITEMS: NavItem[] = [
  { href: '/admin/pacotes', label: 'Pacotes', icon: <Package /> },
  { href: '/admin/relatorios', label: 'Relatórios', icon: <BarChart /> }, // novo
];

// OU adicionar ao group Cadastros:
const CADASTROS = {
  items: [
    // ... existentes
    { href: '/admin/visitantes', label: 'Visitantes', icon: <UserPlus /> },
  ],
};
```

Items ativos detectam pathname automaticamente via `usePathname`.

## Padrão `EmptyState`

Atom reutilizável em `src/components/ui/empty-state.tsx`:

```tsx
import { EmptyState } from '@/components/ui/empty-state';
import { Inbox } from 'lucide-react';

<EmptyState
  icon={<Inbox className="h-12 w-12" />}
  title="Sem resultados"
  description="Tente ajustar os filtros."
  action={<Button onClick={reset}>Limpar filtros</Button>}
/>
```

## Padrão `ComingSoonPlaceholder` (DEV)

Para stubs de stories futuras (sem implementação real ainda):

```tsx
import { ComingSoonPlaceholder } from '@/components/admin/ComingSoonPlaceholder';
import { Layers } from 'lucide-react';

export default function MinhaTelaPage() {
  return (
    <ComingSoonPlaceholder
      title="Setores"
      storyId="2.2"
      icon={<Layers className="h-12 w-12" />}
      description="O CRUD de setores será implementado na story 2.2."
    />
  );
}
```

Remover quando a story real implementar a tela.

## Mobile drawer

Sidebar (md+) é fixa. Em mobile (<768px), some e o hamburger no header abre Sheet
lateral esquerda. State `mobileOpen` vive em `AdminLayoutClient`. Drawer fecha
automaticamente ao clicar em link via prop `onNavigate`.

## Estado persistido

`AdminSidebar` persiste o estado expandido/colapsado do grupo "Cadastros" em
`localStorage` (chave `aiox.adminSidebar.cadastrosOpen`). Defensivo a `localStorage`
indisponível (private mode, jsdom incomplete).

## Próximas evoluções

- Story 2.2/2.3/2.4: substituir stubs por CRUDs reais (Setor, Unidade, Morador)
- Story 6.1: substituir stub de `/admin/pacotes` pelo painel real
- Story 8.1: SuperAdminLayout análogo (separado pra cross-tenant features)
- Story dedicada (futuro): adicionar Notifications/Toasts globais
- Story dedicada (futuro): tema claro/escuro
