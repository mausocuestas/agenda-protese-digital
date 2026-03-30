<script lang="ts">
  import '../app.css'
  import { page } from '$app/state'

  let { data, children } = $props()

  // Itens de navegação com controle de acesso por role
  const navItems = [
    {
      href: '/',
      label: 'Início',
      roles: ['dentist', 'attendant', 'coordinator', 'third_party'],
    },
    {
      href: '/fila',
      label: 'Fila de Encaminhamentos',
      roles: ['dentist', 'attendant', 'coordinator'],
    },
    {
      href: '/agenda',
      label: 'Agenda do Protético',
      roles: ['attendant', 'coordinator', 'third_party'],
    },
    {
      href: '/custodia',
      label: 'Custódia de Próteses',
      roles: ['attendant', 'coordinator', 'third_party'],
    },
    {
      href: '/qualidade',
      label: 'Qualidade Pós-Entrega',
      roles: ['dentist', 'attendant', 'coordinator'],
    },
    {
      href: '/minha-agenda',
      label: 'Minha Agenda',
      roles: ['third_party'],
    },
    {
      href: '/configuracoes',
      label: 'Configurações',
      roles: ['coordinator'],
    },
  ]

  const roleLabel: Record<string, string> = {
    dentist: 'Dentista',
    attendant: 'Atendente',
    coordinator: 'Coordenador',
    third_party: 'Terceirizado',
  }

  let visibleItems = $derived(
    data.user ? navItems.filter((item) => item.roles.includes(data.user!.role)) : []
  )
</script>

{#if data.user}
  <div class="flex min-h-screen bg-gray-50">
    <!-- Sidebar fixa -->
    <aside class="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <!-- Cabeçalho do sistema -->
      <div class="border-b border-gray-100 px-4 py-4">
        <span class="text-sm font-semibold text-gray-900">Prótese Digital</span>
        <p class="text-xs text-gray-400">Saúde Atibaia</p>
      </div>

      <!-- Navegação filtrada por role -->
      <nav class="flex-1 px-2 py-3">
        {#each visibleItems as item}
          <a
            href={item.href}
            class="mb-1 flex items-center rounded-md px-3 py-2 text-sm transition-colors {item.href === '/'
              ? page.url.pathname === '/'
                ? 'bg-blue-50 font-medium text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              : page.url.pathname.startsWith(item.href)
                ? 'bg-blue-50 font-medium text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
          >
            {item.label}
          </a>
        {/each}
      </nav>

      <!-- Usuário + logout -->
      <div class="border-t border-gray-100 px-4 py-3">
        <p class="truncate text-sm font-medium text-gray-800">
          {data.user.name ?? data.user.email}
        </p>
        <p class="text-xs text-gray-400">{roleLabel[data.user.role] ?? data.user.role}</p>
        <a
          href="/auth/sign-out"
          class="mt-2 block text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          Sair
        </a>
      </div>
    </aside>

    <!-- Conteúdo principal -->
    <main class="min-w-0 flex-1 overflow-auto">
      {@render children()}
    </main>
  </div>
{:else}
  {@render children()}
{/if}
