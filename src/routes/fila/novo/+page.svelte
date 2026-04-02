<script lang="ts">
  import { enhance } from '$app/forms'
  import { browser } from '$app/environment'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  type FoundPatient = {
    id: number
    fullName: string
    cpf: string
    birthDate: string
    phone: string
  }

  type Draft = {
    introductionDate: string
    selectedTypeIds: number[]
    hasOmbudsmanFlag: boolean
    hasAccidentFlag: boolean
    note: string
    isNewPatient?: boolean
    newFullName?: string
    newBirthDate?: string
    newPhone?: string
  }

  // Controla qual etapa está ativa
  let stage = $state<'search' | 'form'>('search')
  let foundPatient = $state<FoundPatient | null>(null)
  let isNewPatient = $state(false)
  let searchError = $state('')
  let createError = $state('')
  let submitting = $state(false)
  let draftRestored = $state(false)

  // CPF — dígitos brutos para envio; formatado para exibição
  let cpfDigits = $state('')
  let cpfFormatted = $derived(
    cpfDigits
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  )

  // Dados do encaminhamento
  const today = new Date().toISOString().split('T')[0]
  let introductionDate = $state(today)
  let selectedTypeIds = $state<number[]>([])
  let hasOmbudsmanFlag = $state(false)
  let hasAccidentFlag = $state(false)
  let note = $state('')

  // Campos do novo paciente — necessários para bind e para o rascunho
  let newFullName = $state('')
  let newBirthDate = $state('')
  let newPhone = $state('')

  // Sticky: recupera a última unidade usada nesta sessão do navegador
  const SESSION_KEY = 'lastHealthUnitId'
  const DRAFT_KEY = 'draft_encaminhamento'

  function getInitialUnit(): number {
    if (browser && data.units.length > 1) {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (data.units.some((u) => u.id === parsed)) return parsed
      }
    }
    return data.units[0]?.id ?? 0
  }

  let healthUnitId = $state(getInitialUnit())

  $effect(() => {
    if (browser && data.units.length > 1) {
      sessionStorage.setItem(SESSION_KEY, String(healthUnitId))
    }
  })

  // Salva rascunho no localStorage sempre que os campos do formulário mudarem
  $effect(() => {
    if (!browser || stage !== 'form') return
    const draft: Draft = {
      introductionDate,
      selectedTypeIds: [...selectedTypeIds],
      hasOmbudsmanFlag,
      hasAccidentFlag,
      note,
    }
    if (isNewPatient) {
      draft.isNewPatient = true
      draft.newFullName = newFullName
      draft.newBirthDate = newBirthDate
      draft.newPhone = newPhone
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  })

  function loadDraft(): Draft | null {
    if (!browser) return null
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Draft
    } catch {
      return null
    }
  }

  function applyDraft(draft: Draft, forNewPatient: boolean) {
    introductionDate = draft.introductionDate
    selectedTypeIds = draft.selectedTypeIds
    hasOmbudsmanFlag = draft.hasOmbudsmanFlag
    hasAccidentFlag = draft.hasAccidentFlag
    note = draft.note
    if (forNewPatient && draft.isNewPatient) {
      newFullName = draft.newFullName ?? ''
      newBirthDate = draft.newBirthDate ?? ''
      newPhone = draft.newPhone ?? ''
    }
    draftRestored = true
  }

  function discardDraft() {
    if (browser) localStorage.removeItem(DRAFT_KEY)
    draftRestored = false
  }

  // Agrupa os tipos por posição para reduzir erro de seleção — sem alterar banco
  const prosthesisGroups = $derived([
    {
      label: 'Superior',
      types: data.prosthesisTypes.filter((t) => t.name.includes('Superior')),
    },
    {
      label: 'Inferior',
      types: data.prosthesisTypes.filter((t) => t.name.includes('Inferior')),
    },
    {
      label: 'Outros',
      types: data.prosthesisTypes.filter(
        (t) => !t.name.includes('Superior') && !t.name.includes('Inferior')
      ),
    },
  ])

  // Label curto dentro do contexto do grupo — evita repetir "Superior"/"Inferior"
  function shortLabel(name: string): string {
    if (name.includes('Total')) return 'Total'
    if (name.includes('Parcial')) return 'Parcial Removível'
    return name
  }

  function toggleType(id: number) {
    if (selectedTypeIds.includes(id)) {
      selectedTypeIds = selectedTypeIds.filter((t) => t !== id)
    } else if (selectedTypeIds.length < 2) {
      selectedTypeIds = [...selectedTypeIds, id]
    }
  }

  function resetSearch() {
    stage = 'search'
    foundPatient = null
    isNewPatient = false
    searchError = ''
    createError = ''
    draftRestored = false
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Cabeçalho -->
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Novo Encaminhamento</h1>
        <p class="text-sm text-gray-500">
          {#if stage === 'search'}
            Busque o paciente pelo CPF
          {:else if foundPatient}
            Paciente encontrado — complete os dados do encaminhamento
          {:else}
            Paciente não cadastrado — preencha os dados
          {/if}
        </p>
      </div>
      <a href="/fila" class="text-sm text-gray-500 hover:text-gray-700">← Voltar para a fila</a>
    </div>
  </header>

  <div class="mx-auto max-w-2xl p-6">

    <!-- ── ETAPA 1: Busca por CPF ────────────────────────────────────────────── -->
    {#if stage === 'search'}
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">Identificação do paciente</h2>
        <form
          method="POST"
          action="?/search_patient"
          use:enhance={() => {
            submitting = true
            return async ({ result }) => {
              submitting = false
              if (result.type === 'success') {
                const d = result.data as { patient: FoundPatient | null; cpf: string }
                searchError = ''
                foundPatient = d.patient
                isNewPatient = d.patient === null
                stage = 'form'
                // Restaura rascunho salvo, se existir
                const draft = loadDraft()
                if (draft) applyDraft(draft, d.patient === null)
              } else if (result.type === 'failure') {
                const d = result.data as { searchError?: string }
                searchError = d?.searchError ?? 'Erro ao buscar.'
              }
            }
          }}
        >
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="mb-1 block text-xs font-medium text-gray-600" for="cpf">CPF</label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                inputmode="numeric"
                placeholder="000.000.000-00"
                value={cpfFormatted}
                oninput={(e) => (cpfDigits = (e.target as HTMLInputElement).value.replace(/\D/g, ''))}
                class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
              />
            </div>
            <div class="flex items-end">
              <button
                type="submit"
                disabled={submitting || cpfDigits.length !== 11}
                class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </div>
          {#if searchError}
            <p class="mt-2 text-xs text-red-600">{searchError}</p>
          {/if}
        </form>
      </div>
    {/if}

    <!-- ── ETAPA 2: Formulário completo ─────────────────────────────────────── -->
    {#if stage === 'form'}
      {#if draftRestored}
        <div class="mb-4 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          <span>Rascunho restaurado — os dados do último preenchimento foram recuperados.</span>
          <button type="button" onclick={discardDraft} class="ml-4 font-medium underline hover:text-amber-900">
            Descartar
          </button>
        </div>
      {/if}
      <form
        method="POST"
        action="?/create"
        use:enhance={() => {
          submitting = true
          return async ({ result, update }) => {
            if (result.type === 'failure') {
              submitting = false
              const d = result.data as { createError?: string }
              createError = d?.createError ?? 'Erro ao salvar.'
            } else {
              // Limpa rascunho e redireciona para o detalhe do encaminhamento criado
              if (browser) localStorage.removeItem(DRAFT_KEY)
              await update()
            }
          }
        }}
      >
        <!-- ── Dados do paciente ──────────────────────────────────────────────── -->
        <section class="mb-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-sm font-semibold text-gray-700">Dados do paciente</h2>

          {#if foundPatient}
            <!-- Paciente já cadastrado — somente leitura -->
            <input type="hidden" name="patientId" value={foundPatient.id} />
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-xs text-gray-400">Nome</p>
                <p class="font-medium text-gray-800">{foundPatient.fullName}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">CPF</p>
                <p class="font-mono text-gray-800">{foundPatient.cpf}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Data de nascimento</p>
                <p class="text-gray-800">{foundPatient.birthDate}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Telefone</p>
                <p class="text-gray-800">{foundPatient.phone}</p>
              </div>
            </div>
            <p class="mt-3 text-xs text-blue-600">Paciente já cadastrado — dados reutilizados.</p>
          {:else}
            <!-- Novo paciente — campos editáveis -->
            <p class="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              CPF não encontrado. Preencha os dados para cadastrar o paciente.
            </p>
            <input type="hidden" name="cpf" value={cpfDigits} />
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="mb-1 block text-xs font-medium text-gray-600" for="fullName">
                  Nome completo
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  bind:value={newFullName}
                  required
                  class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600" for="birthDate">
                  Data de nascimento
                </label>
                <input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  bind:value={newBirthDate}
                  required
                  class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600" for="phone">
                  Telefone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  bind:value={newPhone}
                  placeholder="(11) 99999-9999"
                  required
                  class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
            </div>
          {/if}

          <button
            type="button"
            class="mt-4 text-xs text-gray-400 hover:text-gray-600"
            onclick={resetSearch}
          >
            ← Buscar outro CPF
          </button>
        </section>

        <!-- ── Dados do encaminhamento ───────────────────────────────────────── -->
        <section class="mb-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 class="mb-4 text-sm font-semibold text-gray-700">Dados do encaminhamento</h2>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600" for="introductionDate">
                Data de introdução
              </label>
              <input
                id="introductionDate"
                name="introductionDate"
                type="date"
                bind:value={introductionDate}
                required
                class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>

            {#if data.units.length > 0}
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600" for="healthUnitId">
                  Unidade de saúde
                </label>
                <select
                  id="healthUnitId"
                  name="healthUnitId"
                  bind:value={healthUnitId}
                  required
                  class="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                >
                  {#each data.units as unit (unit.id)}
                    <option value={unit.id}>{unit.name}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>

          <!-- Tipos de prótese (máx. 2) — agrupados por Superior / Inferior / Outros -->
          <div class="mt-5">
            <p class="mb-3 text-xs font-medium text-gray-600">
              Tipo(s) de prótese
              <span class="font-normal text-gray-400">(máx. 2)</span>
            </p>
            <div class="grid grid-cols-3 gap-2">
              {#each prosthesisGroups as group}
                <div class="rounded-md border border-gray-100 bg-gray-50 p-2.5">
                  <p class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {group.label}
                  </p>
                  <div class="flex flex-col gap-1.5">
                    {#each group.types as type (type.id)}
                      <button
                        type="button"
                        onclick={() => toggleType(type.id)}
                        title={type.name}
                        class="rounded border px-2.5 py-1.5 text-left text-xs transition-colors {selectedTypeIds.includes(type.id)
                          ? 'border-blue-500 bg-blue-50 font-medium text-blue-700'
                          : selectedTypeIds.length >= 2
                            ? 'cursor-not-allowed border-gray-100 bg-white text-gray-300'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}"
                        disabled={!selectedTypeIds.includes(type.id) && selectedTypeIds.length >= 2}
                      >
                        {shortLabel(type.name)}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
            <!-- Valores enviados via hidden inputs -->
            {#each selectedTypeIds as id}
              <input type="hidden" name="prosthesisTypeIds" value={id} />
            {/each}
            {#if selectedTypeIds.length === 0}
              <p class="mt-2 text-xs text-gray-400">Selecione ao menos um tipo.</p>
            {/if}
          </div>

          <!-- Flags de prioridade -->
          <div class="mt-5 flex gap-6">
            <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="hasOmbudsmanFlag" bind:checked={hasOmbudsmanFlag} class="rounded" />
              <span class="font-bold text-red-600">OUV</span> Ouvidoria
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="hasAccidentFlag" bind:checked={hasAccidentFlag} class="rounded" />
              <span class="font-bold text-orange-600">ACI</span> Acidente
            </label>
          </div>
        </section>

        <!-- ── Observação inicial (opcional) ─────────────────────────────────── -->
        <section class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 class="mb-1 text-sm font-semibold text-gray-700">
            Observação inicial
            <span class="font-normal text-gray-400">(opcional)</span>
          </h2>
          <p class="mb-3 text-xs text-gray-400">Anamnese, histórico relevante, observações clínicas…</p>
          <textarea
            name="note"
            bind:value={note}
            rows="3"
            class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          ></textarea>
        </section>

        {#if createError}
          <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</p>
        {/if}

        <div class="flex justify-end gap-3">
          <a
            href="/fila"
            class="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={submitting || selectedTypeIds.length === 0}
            class="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Salvando…' : 'Encaminhar paciente'}
          </button>
        </div>
      </form>
    {/if}

  </div>
</div>
