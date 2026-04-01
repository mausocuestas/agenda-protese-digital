<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { enhance } from '$app/forms'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let showAddForm = $state(false)
  let editingUserId = $state<number | null>(null)
  let showInactive = $state(false)
  let filterRole = $state('all')

  const roleLabel: Record<string, string> = {
    dentist: 'Dentista',
    attendant: 'Atendente',
    coordinator: 'Coordenador',
    third_party: 'Terceirizado',
  }

  // Cores dos badges por perfil
  const roleBadge: Record<string, string> = {
    dentist: 'bg-blue-100 text-blue-700',
    attendant: 'bg-violet-100 text-violet-700',
    coordinator: 'bg-indigo-100 text-indigo-700',
    third_party: 'bg-orange-100 text-orange-700',
  }

  let visibleUsers = $derived(
    data.users
      .filter((u) => showInactive || u.isActive)
      .filter((u) => filterRole === 'all' || u.role === filterRole)
  )

  // Fecha formulário de adição após cadastro bem-sucedido
  $effect(() => {
    if (form && 'userAdded' in form && form.userAdded) showAddForm = false
  })

  // Fecha edição inline após salvar (editUser e toggleActive retornam userEdited)
  $effect(() => {
    if (form && 'userEdited' in form && form.userEdited) editingUserId = null
  })
</script>

<div class="min-h-screen bg-gray-50">
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Usuários do Sistema</h1>
        <p class="text-sm text-gray-500">Gerencie a equipe e seus perfis de acesso</p>
      </div>
      <button
        onclick={() => (showAddForm = !showAddForm)}
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        {showAddForm ? 'Cancelar' : '+ Novo usuário'}
      </button>
    </div>
  </header>

  <div class="mx-auto max-w-4xl space-y-4 px-6 py-6">

    <!-- Erros de edição/toggle (visíveis no topo) -->
    {#if form && 'editError' in form && form.editError}
      <p class="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{form.editError}</p>
    {/if}

    <!-- Formulário de novo usuário -->
    {#if showAddForm}
      <div class="rounded-lg border border-blue-100 bg-blue-50 px-4 py-4">
        <h2 class="mb-3 text-sm font-semibold text-gray-700">Novo Usuário</h2>
        <form
          method="POST"
          action="?/addUser"
          use:enhance={({ formElement }) =>
            async ({ update }) => {
              await update()
              formElement.reset()
            }}
          class="grid grid-cols-2 gap-3"
        >
          <div>
            <label for="newName" class="mb-1 block text-xs font-medium text-gray-600">
              Nome completo *
            </label>
            <input
              id="newName"
              name="name"
              type="text"
              required
              maxlength="255"
              placeholder="Ex: Ana Paula Santos"
              class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label for="newEmail" class="mb-1 block text-xs font-medium text-gray-600">
              E-mail *
            </label>
            <input
              id="newEmail"
              name="email"
              type="email"
              required
              placeholder="usuario@saude.atibaia.sp.gov.br"
              class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label for="newRole" class="mb-1 block text-xs font-medium text-gray-600">
              Perfil *
            </label>
            <select
              id="newRole"
              name="role"
              required
              class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
            >
              <option value="">Selecione...</option>
              <option value="dentist">Dentista</option>
              <option value="attendant">Atendente</option>
              <option value="coordinator">Coordenador</option>
              <option value="third_party">Terceirizado</option>
            </select>
          </div>

          <div>
            <label for="newUnit" class="mb-1 block text-xs font-medium text-gray-600">
              Unidade padrão
            </label>
            <select
              id="newUnit"
              name="defaultUnitId"
              class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
            >
              <option value="">Sem unidade</option>
              {#each data.units as unit (unit.id)}
                <option value={unit.id}>{unit.label}</option>
              {/each}
            </select>
          </div>

          <div class="col-span-2 flex items-center gap-4 pt-1">
            <button
              type="submit"
              class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Cadastrar
            </button>
            {#if form && 'error' in form && form.error}
              <p class="text-sm text-red-600">{form.error}</p>
            {/if}
          </div>
        </form>
      </div>
    {/if}

    <!-- Filtros -->
    <div class="flex items-center gap-4">
      <select
        bind:value={filterRole}
        class="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
      >
        <option value="all">Todos os perfis</option>
        <option value="dentist">Dentista</option>
        <option value="attendant">Atendente</option>
        <option value="coordinator">Coordenador</option>
        <option value="third_party">Terceirizado</option>
      </select>

      <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" bind:checked={showInactive} class="rounded" />
        Mostrar inativos
      </label>

      <span class="ml-auto text-xs text-gray-400">
        {visibleUsers.length}
        {visibleUsers.length !== 1 ? 'usuários' : 'usuário'}
      </span>
    </div>

    <!-- Lista de usuários -->
    <div class="space-y-2">
      {#each visibleUsers as u (u.id)}
        <div
          class="rounded-lg border border-gray-200 bg-white {u.isActive ? '' : 'opacity-60'}"
        >
          {#if editingUserId === u.id}
            <!-- Formulário de edição inline -->
            <form
              method="POST"
              action="?/editUser"
              use:enhance
              class="grid grid-cols-4 gap-3 px-4 py-3"
            >
              <input type="hidden" name="id" value={u.id} />

              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600">Nome</label>
                <input
                  name="name"
                  type="text"
                  required
                  maxlength="255"
                  value={u.name}
                  class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600">Perfil</label>
                <select
                  name="role"
                  class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  <option value="dentist" selected={u.role === 'dentist'}>Dentista</option>
                  <option value="attendant" selected={u.role === 'attendant'}>Atendente</option>
                  <option value="coordinator" selected={u.role === 'coordinator'}>Coordenador</option>
                  <option value="third_party" selected={u.role === 'third_party'}>Terceirizado</option>
                </select>
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600">Unidade padrão</label>
                <select
                  name="defaultUnitId"
                  class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">Sem unidade</option>
                  {#each data.units as unit (unit.id)}
                    <option value={unit.id} selected={u.defaultUnitId === unit.id}>{unit.label}</option>
                  {/each}
                </select>
              </div>

              <div class="flex items-end gap-2">
                <button
                  type="submit"
                  class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onclick={() => (editingUserId = null)}
                  class="text-xs text-gray-400 transition-colors hover:text-gray-600"
                >
                  Cancelar
                </button>
              </div>

              <!-- Unidades adicionais — só exibido para dentistas -->
              {#if u.role === 'dentist'}
                {@const extraUnits = data.userUnitRows.filter((r) => r.userId === u.id)}
                {@const availableUnits = data.units.filter(
                  (unit) =>
                    !extraUnits.some((r) => r.unitId === unit.id) && unit.id !== u.defaultUnitId
                )}
                <div class="col-span-4 border-t border-gray-100 pt-3">
                  <p class="mb-2 text-xs font-medium text-gray-600">Unidades adicionais</p>
                  <div class="flex flex-wrap items-center gap-2">
                    <!-- Tag removível por unidade já vinculada -->
                    {#each extraUnits as row (row.id)}
                      <form method="POST" action="?/removeUserUnit" use:enhance>
                        <input type="hidden" name="userUnitId" value={row.id} />
                        <button
                          type="submit"
                          title="Remover vínculo"
                          class="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 transition-colors hover:bg-red-100 hover:text-red-600"
                        >
                          {row.unitLabel}
                          <span aria-hidden="true">×</span>
                        </button>
                      </form>
                    {/each}

                    <!-- Formulário de adição de nova unidade -->
                    {#if availableUnits.length > 0}
                      <form
                        method="POST"
                        action="?/addUserUnit"
                        use:enhance
                        class="flex items-center gap-1"
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="unitId"
                          class="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
                        >
                          <option value="">Selecione...</option>
                          {#each availableUnits as unit (unit.id)}
                            <option value={unit.id}>{unit.label}</option>
                          {/each}
                        </select>
                        <button
                          type="submit"
                          class="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
                        >
                          + Adicionar
                        </button>
                      </form>
                    {:else if extraUnits.length > 0}
                      <span class="text-xs text-gray-400">Todas as unidades já vinculadas</span>
                    {:else}
                      <span class="text-xs text-gray-400">Nenhuma unidade adicional</span>
                    {/if}
                  </div>

                  {#if form && 'unitError' in form && form.unitError}
                    <p class="mt-1 text-xs text-red-600">{form.unitError}</p>
                  {/if}
                </div>
              {/if}
            </form>
          {:else}
            <!-- Linha de visualização -->
            <div class="flex items-center gap-4 px-4 py-3">
              <div class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-gray-800">{u.name}</span>
                <span class="block truncate text-xs text-gray-400">{u.email}</span>
              </div>

              <span
                class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium {roleBadge[u.role]}"
              >
                {roleLabel[u.role]}
              </span>

              <span class="w-40 shrink-0 truncate text-xs text-gray-500">
                {u.unitLabel ?? '—'}
              </span>

              <span class="w-12 shrink-0 text-xs {u.isActive ? 'text-green-600' : 'text-gray-400'}">
                {u.isActive ? 'Ativo' : 'Inativo'}
              </span>

              <div class="flex shrink-0 items-center gap-3">
                <button
                  onclick={() => (editingUserId = u.id)}
                  class="text-xs text-blue-500 transition-colors hover:text-blue-700"
                >
                  Editar
                </button>

                <!-- Oculta o botão de desativar para o próprio coordenador logado -->
                {#if u.id !== data.currentUserId}
                  <form method="POST" action="?/toggleActive" use:enhance>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="isActive" value={u.isActive} />
                    <button
                      type="submit"
                      class="text-xs transition-colors {u.isActive
                        ? 'text-red-400 hover:text-red-600'
                        : 'text-green-500 hover:text-green-700'}"
                    >
                      {u.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                  </form>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <p class="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
          Nenhum usuário encontrado.
        </p>
      {/each}
    </div>

  </div>
</div>
