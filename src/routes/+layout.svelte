<script lang="ts">
  import '../app.css'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { authClient } from '$lib/auth/client'

  let { data, children } = $props()

  async function handleSignOut() {
    await authClient.signOut()
    goto('/login')
  }

  // Itens de navegação com controle de acesso por role
  // notificationKey mapeia para data.notifications para exibir badge de pendências
  const navItems = [
    {
      href: '/',
      label: 'Início',
      roles: ['dentist', 'attendant', 'coordinator', 'third_party'],
      notificationKey: null,
    },
    {
      href: '/fila',
      label: 'Fila de Encaminhamentos',
      roles: ['dentist', 'attendant', 'coordinator'],
      notificationKey: 'fila' as const,
    },
    {
      href: '/agenda',
      label: 'Agenda do Protético',
      roles: ['attendant', 'coordinator', 'third_party'],
      notificationKey: null,
    },
    {
      href: '/custodia',
      label: 'Custódia de Próteses',
      roles: ['attendant', 'coordinator', 'third_party'],
      notificationKey: 'custodia' as const,
    },
    {
      href: '/qualidade',
      label: 'Qualidade Pós-Entrega',
      roles: ['dentist', 'attendant', 'coordinator'],
      notificationKey: 'qualidade' as const,
    },
    {
      href: '/minha-agenda',
      label: 'Minha Agenda',
      roles: ['third_party'],
      notificationKey: null,
    },
    {
      href: '/pacientes',
      label: 'Pacientes',
      roles: ['coordinator', 'attendant'],
      notificationKey: null,
    },
    {
      href: '/metricas',
      label: 'Métricas',
      roles: ['coordinator'],
      notificationKey: null,
    },
    {
      href: '/usuarios',
      label: 'Usuários',
      roles: ['coordinator'],
      notificationKey: null,
    },
    {
      href: '/configuracoes',
      label: 'Configurações',
      roles: ['coordinator'],
      notificationKey: null,
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
          {@const isActive =
            item.href === '/'
              ? page.url.pathname === '/'
              : page.url.pathname.startsWith(item.href)}
          {@const badgeCount =
            item.notificationKey ? (data.notifications[item.notificationKey] ?? 0) : 0}
          <a
            href={item.href}
            class="mb-1 flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors {isActive
              ? 'bg-blue-50 font-medium text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
          >
            <span>{item.label}</span>
            {#if badgeCount > 0}
              <span
                class="ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none {isActive
                  ? 'bg-blue-200 text-blue-800'
                  : 'bg-red-100 text-red-700'}"
              >
                {badgeCount}
              </span>
            {/if}
          </a>
        {/each}
      </nav>

      <!-- Usuário + logout -->
      <div class="border-t border-gray-100 px-4 py-3">
        <p class="truncate text-sm font-medium text-gray-800">
          {data.user.name ?? data.user.email}
        </p>
        <p class="text-xs text-gray-400">{roleLabel[data.user.role] ?? data.user.role}</p>
        <button
          onclick={handleSignOut}
          class="mt-2 block text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          Sair
        </button>
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
