<script lang="ts">
  import '../app.css'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { authClient } from '$lib/auth/client'
  import { browser } from '$app/environment'

  let { data, children } = $props()

  async function handleSignOut() {
    await authClient.signOut()
    goto('/login')
  }

  // Estado de collapse da sidebar — persistido em localStorage
  let sidebarOpen = $state(true)

  $effect(() => {
    if (!browser) return
    const saved = localStorage.getItem('sidebar-open')
    if (saved !== null) sidebarOpen = saved === 'true'
  })

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen
    if (browser) localStorage.setItem('sidebar-open', String(sidebarOpen))
  }

  // Itens de navegação com controle de acesso por role
  const navItems = [
    {
      href: '/',
      label: 'Início',
      initial: 'I',
      roles: ['dentist', 'attendant', 'coordinator', 'third_party'],
      notificationKey: null,
    },
    {
      href: '/fila',
      label: 'Fila de Encaminhamentos',
      initial: 'F',
      roles: ['dentist', 'attendant', 'coordinator'],
      notificationKey: 'fila' as const,
    },
    {
      href: '/agenda',
      label: 'Agenda do Protético',
      initial: 'A',
      roles: ['attendant', 'coordinator', 'third_party'],
      notificationKey: null,
    },
    {
      href: '/custodia',
      label: 'Custódia de Próteses',
      initial: 'C',
      roles: ['attendant', 'coordinator', 'third_party'],
      notificationKey: 'custodia' as const,
    },
    {
      href: '/qualidade',
      label: 'Qualidade Pós-Entrega',
      initial: 'Q',
      roles: ['dentist', 'attendant', 'coordinator'],
      notificationKey: 'qualidade' as const,
    },
    {
      href: '/minha-agenda',
      label: 'Minha Agenda',
      initial: 'M',
      roles: ['third_party'],
      notificationKey: null,
    },
    {
      href: '/pacientes',
      label: 'Pacientes',
      initial: 'P',
      roles: ['coordinator', 'attendant'],
      notificationKey: null,
    },
    {
      href: '/metricas',
      label: 'Métricas',
      initial: 'Me',
      roles: ['coordinator'],
      notificationKey: null,
    },
    {
      href: '/usuarios',
      label: 'Usuários',
      initial: 'U',
      roles: ['coordinator'],
      notificationKey: null,
    },
    {
      href: '/configuracoes',
      label: 'Configurações',
      initial: 'Co',
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
  <div class="flex min-h-screen bg-neutral-50">

    <!-- Sidebar -->
    <aside
      class="flex shrink-0 flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 {sidebarOpen ? 'w-56' : 'w-14'}"
    >
      <!-- Cabeçalho com toggle -->
      <div class="flex items-center border-b border-neutral-100 px-3 py-4 {sidebarOpen ? 'justify-between' : 'justify-center'}">
        {#if sidebarOpen}
          <div>
            <span class="text-sm font-semibold text-neutral-900">Prótese Digital</span>
            <p class="text-xs text-neutral-400">Saúde Atibaia</p>
          </div>
        {/if}
        <button
          onclick={toggleSidebar}
          class="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
          aria-label={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
        >
          <!-- Seta direcional -->
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            {#if sidebarOpen}
              <path d="M10 3L5 8L10 13" />
            {:else}
              <path d="M6 3L11 8L6 13" />
            {/if}
          </svg>
        </button>
      </div>

      <!-- Navegação filtrada por role -->
      <nav class="flex-1 overflow-y-auto px-2 py-3">
        {#each visibleItems as item}
          {@const isActive =
            item.href === '/'
              ? page.url.pathname === '/'
              : page.url.pathname.startsWith(item.href)}
          {@const badgeCount =
            item.notificationKey ? (data.notifications[item.notificationKey] ?? 0) : 0}
          <a
            href={item.href}
            title={sidebarOpen ? undefined : item.label}
            class="relative mb-1 flex items-center rounded-md py-2 text-sm transition-colors
              {sidebarOpen ? 'justify-between px-3' : 'justify-center px-2'}
              {isActive ? 'bg-primary-50 font-medium text-primary-700' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}"
          >
            {#if sidebarOpen}
              <span>{item.label}</span>
              {#if badgeCount > 0}
                <span
                  class="ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none {isActive
                    ? 'bg-primary-200 text-primary-800'
                    : 'bg-danger-100 text-danger-700'}"
                >
                  {badgeCount}
                </span>
              {/if}
            {:else}
              <!-- Modo colapsado: inicial + badge como ponto -->
              <span class="text-xs font-semibold">{item.initial}</span>
              {#if badgeCount > 0}
                <span
                  class="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger-500"
                  aria-label="{badgeCount} pendências"
                ></span>
              {/if}
            {/if}
          </a>
        {/each}
      </nav>

      <!-- Usuário + logout -->
      <div class="border-t border-neutral-100 px-3 py-3">
        {#if sidebarOpen}
          <p class="truncate text-sm font-medium text-neutral-800">
            {data.user.name ?? data.user.email}
          </p>
          <p class="text-xs text-neutral-400">{roleLabel[data.user.role] ?? data.user.role}</p>
          <button
            onclick={handleSignOut}
            class="mt-2 block text-xs text-neutral-400 transition-colors hover:text-neutral-600"
          >
            Sair
          </button>
        {:else}
          <button
            onclick={handleSignOut}
            title="Sair"
            class="flex w-full items-center justify-center rounded p-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Sair"
          >
            ↪
          </button>
        {/if}
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
