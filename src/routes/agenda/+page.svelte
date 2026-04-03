<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { enhance } from '$app/forms'
  import PageHeader from '$lib/components/page-header.svelte'
  import Button from '$lib/components/ui/button.svelte'
  import Field from '$lib/components/ui/field.svelte'
  import Badge from '$lib/components/ui/badge.svelte'
  import Modal from '$lib/components/ui/modal.svelte'
  import EmptyState from '$lib/components/ui/empty-state.svelte'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  // Estado dos formulários e modais
  let showCreateForm = $state(false)
  let editingScheduleId = $state<number | null>(null)

  type Schedule = typeof data.schedules[0]
  type SlotGrid = Schedule['slotGrid'][0]

  // Modal: adicionar paciente em slot vago
  let addModal = $state<{ schedule: Schedule; slot: SlotGrid } | null>(null)

  // Modal: detalhes do paciente agendado
  type PatientModalSlot = SlotGrid & { appointmentId: number; referralId: number; outcome: string | null }
  let patientModal = $state<{ schedule: Schedule; slot: PatientModalSlot } | null>(null)
  // Ação ativa dentro do modal do paciente
  let patientAction = $state<null | 'edit_time' | 'swap' | 'move'>(null)

  // Fecha modais após ações bem-sucedidas
  $effect(() => {
    if (form && 'success' in form && form.success) showCreateForm = false
  })
  $effect(() => {
    if (form && 'editSuccess' in form && form.editSuccess) editingScheduleId = null
  })
  $effect(() => {
    if (form && 'slotAdded' in form && form.slotAdded) addModal = null
  })
  $effect(() => {
    if (
      form &&
      ('editApptSuccess' in form ||
        'removeSuccess' in form ||
        'moveSuccess' in form ||
        'swapSuccess' in form)
    ) {
      patientModal = null
      patientAction = null
    }
  })

  // Formatadores
  function formatDate(d: string) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  function formatTime(t: string) {
    return t.slice(0, 5)
  }
  function formatCpf(cpf: string) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  function formatBirthDate(d: string) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  const apptLabel: Record<number, string> = {
    1: 'Escaneamento',
    2: '1º Ajuste',
    3: '2º Ajuste',
    4: 'Entrega',
  }

  const outcomeLabel: Record<string, string> = {
    attended: 'Compareceu',
    absent: 'Faltou',
    refused: 'Recusado',
  }

  type BadgeVariant = 'success' | 'danger' | 'warning' | 'neutral'
  function outcomeVariant(outcome: string | null | undefined): BadgeVariant {
    if (outcome === 'attended') return 'success'
    if (outcome === 'absent') return 'danger'
    if (outcome === 'refused') return 'warning'
    return 'neutral'
  }

  // Abre modal de adição de paciente em slot vago
  function openAddModal(schedule: Schedule, slot: SlotGrid) {
    addModal = { schedule, slot }
  }

  // Abre modal de detalhes do paciente
  function openPatientModal(schedule: Schedule, slot: SlotGrid) {
    if (slot.appointmentId == null || slot.referralId == null) return
    patientModal = {
      schedule,
      slot: slot as PatientModalSlot,
    }
    patientAction = null
  }
</script>

<div class="min-h-screen bg-neutral-50">
  <PageHeader
    title="Agenda do Protético"
    subtitle="Visitas do terceirizado às unidades de saúde"
  >
    {#snippet action()}
      {#if data.isCoordinator}
        <Button variant="primary" onclick={() => (showCreateForm = !showCreateForm)}>
          {showCreateForm ? 'Cancelar' : '+ Nova visita'}
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <!-- Formulário de criação — apenas coordenador -->
  {#if data.isCoordinator && showCreateForm}
    <div class="border-b border-neutral-200 bg-white px-6 py-4">
      <form
        method="POST"
        action="?/create"
        use:enhance={({ formElement }) =>
          async ({ update }) => {
            await update()
            formElement.reset()
          }}
        class="flex flex-wrap items-end gap-4"
      >
        <Field label="Unidade de saúde" for="unit">
          <select
            id="unit"
            name="healthUnitId"
            required
            class="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
          >
            <option value="">Selecione...</option>
            {#each data.units as unit (unit.id)}
              <option value={unit.id}>{unit.name}</option>
            {/each}
          </select>
        </Field>

        <Field label="Data" for="scheduledDate">
          <input
            id="scheduledDate"
            name="scheduledDate"
            type="date"
            required
            class="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
          />
        </Field>

        <Field label="Início" for="startTime">
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            class="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
          />
        </Field>

        <Field label="Término" for="endTime">
          <input
            id="endTime"
            name="endTime"
            type="time"
            required
            class="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
          />
        </Field>

        <Button type="submit" variant="primary">Salvar</Button>

        {#if form && 'error' in form && form.error}
          <p class="text-sm text-danger-600">{form.error}</p>
        {/if}
      </form>
    </div>
  {/if}

  <!-- Cards de visitas -->
  <div class="p-6 space-y-4">
    {#if data.schedules.length === 0}
      <EmptyState
        message="Nenhuma visita cadastrada."
        hint={data.isCoordinator ? 'Clique em "+ Nova visita" para adicionar.' : 'O coordenador precisa cadastrar visitas.'}
      />
    {:else}
      {#each data.schedules as schedule (schedule.id)}
        <div class="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">

          <!-- Cabeçalho do card -->
          <div class="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-semibold text-neutral-900">{formatDate(schedule.scheduledDate)}</span>
              <span class="text-neutral-600">{schedule.unitName}</span>
              <span class="text-xs text-neutral-400">
                {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
              </span>
              {#if schedule.lunchStart && schedule.lunchEnd}
                <span class="text-xs text-neutral-300">
                  almoço {formatTime(schedule.lunchStart)}–{formatTime(schedule.lunchEnd)}
                </span>
              {/if}
            </div>

            {#if data.isCoordinator}
              <div class="flex items-center gap-3 text-xs">
                <button
                  onclick={() => {
                    editingScheduleId = editingScheduleId === schedule.id ? null : schedule.id
                  }}
                  class="text-neutral-400 transition-colors hover:text-neutral-700"
                >
                  {editingScheduleId === schedule.id ? 'Cancelar edição' : 'Editar visita'}
                </button>
                <form method="POST" action="?/delete" use:enhance class="inline">
                  <input type="hidden" name="id" value={schedule.id} />
                  <button
                    type="submit"
                    class="text-danger-500 transition-colors hover:text-danger-700"
                    onclick={(e) => {
                      if (!confirm('Remover essa visita e todos os agendamentos?')) e.preventDefault()
                    }}
                  >
                    Remover visita
                  </button>
                </form>
              </div>
            {/if}
          </div>

          <!-- Formulário de edição de visita (coordenador) -->
          {#if data.canEditSchedule && editingScheduleId === schedule.id}
            <div class="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
              <form
                method="POST"
                action="?/edit_schedule"
                use:enhance
                class="flex flex-wrap items-end gap-4"
              >
                <input type="hidden" name="id" value={schedule.id} />

                <Field label="Data">
                  <input
                    name="scheduledDate"
                    type="date"
                    required
                    value={schedule.scheduledDate}
                    class="rounded-md border border-neutral-200 px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none"
                  />
                </Field>

                <Field label="Início">
                  <input
                    name="startTime"
                    type="time"
                    required
                    value={formatTime(schedule.startTime)}
                    class="rounded-md border border-neutral-200 px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none"
                  />
                </Field>

                <Field label="Término">
                  <input
                    name="endTime"
                    type="time"
                    required
                    value={formatTime(schedule.endTime)}
                    class="rounded-md border border-neutral-200 px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none"
                  />
                </Field>

                <Button type="submit" variant="primary" size="sm">Salvar</Button>

                {#if form && 'error' in form && form.error}
                  <p class="text-sm text-danger-600">{form.error}</p>
                {/if}
              </form>
            </div>
          {/if}

          <!-- Grid de slots -->
          <div class="divide-y divide-neutral-50">
            {#if schedule.slotGrid.length === 0}
              <div class="px-4 py-6 text-center text-xs text-neutral-400">
                Nenhum slot configurado para essa visita.
              </div>
            {:else}
              {#each schedule.slotGrid as slot}
                {#if slot.status === 'available'}
                  {#if data.canManageSlots}
                    <!-- Slot vago — clicável para agendar -->
                    <button
                      onclick={() => openAddModal(schedule, slot)}
                      class="flex w-full items-center gap-4 bg-primary-50/30 px-4 py-2.5 text-left transition-colors hover:bg-primary-50"
                    >
                      <span class="w-12 shrink-0 font-mono text-xs text-neutral-400">{slot.startTime}</span>
                      <span class="text-xs text-primary-500">+ Vago</span>
                    </button>
                  {:else}
                    <!-- Terceirizado vê slot vago mas não agenda -->
                    <div class="flex items-center gap-4 px-4 py-2.5">
                      <span class="w-12 shrink-0 font-mono text-xs text-neutral-300">{slot.startTime}</span>
                      <span class="text-xs text-neutral-300">—</span>
                    </div>
                  {/if}
                {:else}
                  {#if data.canManageSlots}
                    <!-- Slot ocupado — coord/atendente clicam para ver detalhes -->
                    <button
                      onclick={() => openPatientModal(schedule, slot)}
                      class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50"
                    >
                      <span class="w-12 shrink-0 font-mono text-xs text-neutral-500">{slot.startTime}</span>
                      <span class="font-medium text-neutral-800">{slot.patientName}</span>
                      <Badge variant="neutral">
                        {apptLabel[slot.appointmentNumber ?? 0] ?? `Consulta ${slot.appointmentNumber}`}
                      </Badge>
                      {#if slot.outcome}
                        <Badge variant={outcomeVariant(slot.outcome)}>
                          {outcomeLabel[slot.outcome] ?? slot.outcome}
                        </Badge>
                      {/if}
                    </button>
                  {:else if data.canSeePatients}
                    <!-- Terceirizado vê o paciente sem interação -->
                    <div class="flex items-center gap-3 px-4 py-2.5">
                      <span class="w-12 shrink-0 font-mono text-xs text-neutral-500">{slot.startTime}</span>
                      <span class="font-medium text-neutral-800">{slot.patientName}</span>
                      <Badge variant="neutral">
                        {apptLabel[slot.appointmentNumber ?? 0] ?? `Consulta ${slot.appointmentNumber}`}
                      </Badge>
                      {#if slot.outcome}
                        <Badge variant={outcomeVariant(slot.outcome)}>
                          {outcomeLabel[slot.outcome] ?? slot.outcome}
                        </Badge>
                      {/if}
                    </div>
                  {/if}
                {/if}
              {/each}
            {/if}
          </div>

        </div>
      {/each}
    {/if}
  </div>
</div>

<!-- ─── Modal: Adicionar paciente em slot vago ─────────────────────── -->
<Modal
  open={addModal !== null}
  title="Agendar paciente"
  onclose={() => (addModal = null)}
>
  {#if addModal}
    <form
      id="add-appt-form"
      method="POST"
      action="?/add_appointment"
      use:enhance={({ formElement }) =>
        async ({ update }) => {
          await update()
          formElement.reset()
        }}
      class="space-y-4"
    >
      <input type="hidden" name="scheduleId" value={addModal.schedule.id} />

      <div class="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        {formatDate(addModal.schedule.scheduledDate)} · {addModal.schedule.unitName} · slot {addModal.slot.startTime}
      </div>

      <Field label="Paciente" for="add-referral">
        <select
          id="add-referral"
          name="referralId"
          required
          class="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
        >
          <option value="">Selecione...</option>
          {#each addModal.schedule.eligible as er}
            <option value={er.referralId}>
              {er.patientName} — {apptLabel[er.nextApptNumber] ?? `Consulta ${er.nextApptNumber}`}
            </option>
          {/each}
        </select>
        {#if addModal.schedule.eligible.length === 0}
          <p class="text-xs text-neutral-400">
            Nenhum paciente ativo pendente para esta unidade.
          </p>
        {/if}
      </Field>

      <Field label="Horário" for="add-time">
        <input
          id="add-time"
          name="scheduledTime"
          type="time"
          required
          value={addModal.slot.startTime}
          min={formatTime(addModal.schedule.startTime)}
          max={formatTime(addModal.schedule.endTime)}
          class="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
        />
      </Field>

      {#if form && 'slotError' in form && form.slotError}
        <p class="text-sm text-danger-600">{form.slotError}</p>
      {/if}
    </form>
  {/if}

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (addModal = null)}>Cancelar</Button>
    <Button
      variant="primary"
      type="submit"
      form="add-appt-form"
      disabled={addModal?.schedule.eligible.length === 0}
    >
      Agendar
    </Button>
  {/snippet}
</Modal>

<!-- ─── Modal: Detalhes do paciente agendado ──────────────────────── -->
<Modal
  open={patientModal !== null}
  title="Paciente agendado"
  onclose={() => { patientModal = null; patientAction = null }}
>
  {#if patientModal}
    {@const patient = data.patientMap[patientModal.slot.referralId]}
    {@const slot = patientModal.slot}
    {@const schedule = patientModal.schedule}

    <div class="space-y-4">

      <!-- Info do agendamento atual -->
      <div class="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        {formatDate(schedule.scheduledDate)} · {schedule.unitName} · {slot.startTime}
        · <span class="font-medium">{apptLabel[slot.appointmentNumber ?? 0] ?? `Consulta ${slot.appointmentNumber}`}</span>
        {#if slot.outcome}
          · <span class="font-medium {slot.outcome === 'attended' ? 'text-success-600' : slot.outcome === 'absent' ? 'text-danger-600' : 'text-warning-600'}">
              {outcomeLabel[slot.outcome] ?? slot.outcome}
            </span>
        {/if}
      </div>

      <!-- Dados do paciente -->
      {#if patient}
        <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <div>
            <span class="text-xs text-neutral-500">Nome</span>
            <p class="font-medium text-neutral-800">{patient.patientName}</p>
          </div>
          <div>
            <span class="text-xs text-neutral-500">CPF</span>
            <p class="font-medium text-neutral-800">{formatCpf(patient.cpf)}</p>
          </div>
          <div>
            <span class="text-xs text-neutral-500">Nascimento</span>
            <p class="font-medium text-neutral-800">{formatBirthDate(patient.birthDate)}</p>
          </div>
          <div>
            <span class="text-xs text-neutral-500">Telefone</span>
            <p class="font-medium text-neutral-800">{patient.phone}</p>
          </div>
          {#if patient.prosthesisTypes.length > 0}
            <div class="col-span-2">
              <span class="text-xs text-neutral-500">Tipo de prótese</span>
              <p class="font-medium text-neutral-800">{patient.prosthesisTypes.join(', ')}</p>
            </div>
          {/if}
        </div>

        <!-- Histórico de consultas -->
        {#if patient.history.length > 0}
          <div>
            <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Histórico
            </p>
            <ul class="space-y-1">
              {#each patient.history as appt}
                <li class="flex items-center gap-3 text-xs text-neutral-600">
                  <span class="w-16 shrink-0 text-neutral-400">{formatDate(appt.scheduledDate)}</span>
                  <span>{apptLabel[appt.appointmentNumber] ?? `Consulta ${appt.appointmentNumber}`}</span>
                  <span class="text-neutral-400">{appt.unitName}</span>
                  {#if appt.outcome}
                    <Badge variant={outcomeVariant(appt.outcome)} >
                      {outcomeLabel[appt.outcome] ?? appt.outcome}
                    </Badge>
                  {:else}
                    <Badge variant="neutral">Aguardando</Badge>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}

      <!-- Ações disponíveis — apenas sem desfecho registrado -->
      {#if !slot.outcome && data.canManageSlots}
        <div class="border-t border-neutral-100 pt-3">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Ações</p>
          <div class="flex flex-wrap gap-2">
            <button
              onclick={() => (patientAction = patientAction === 'edit_time' ? null : 'edit_time')}
              class="text-xs text-primary-600 hover:text-primary-800"
            >
              Alterar horário
            </button>
            <span class="text-neutral-300">·</span>
            <button
              onclick={() => (patientAction = patientAction === 'swap' ? null : 'swap')}
              class="text-xs text-primary-600 hover:text-primary-800"
            >
              Trocar paciente
            </button>
            <span class="text-neutral-300">·</span>
            <button
              onclick={() => (patientAction = patientAction === 'move' ? null : 'move')}
              class="text-xs text-primary-600 hover:text-primary-800"
            >
              Mover para outra visita
            </button>
          </div>

          <!-- Formulário: alterar horário -->
          {#if patientAction === 'edit_time'}
            <form
              method="POST"
              action="?/edit_appointment"
              use:enhance
              class="mt-3 flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="id" value={slot.appointmentId} />
              <Field label="Novo horário">
                <input
                  name="scheduledTime"
                  type="time"
                  required
                  value={slot.startTime}
                  min={formatTime(schedule.startTime)}
                  max={formatTime(schedule.endTime)}
                  class="rounded-md border border-neutral-200 px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none"
                />
              </Field>
              <Button type="submit" variant="primary" size="sm">Salvar</Button>
            </form>
          {/if}

          <!-- Formulário: trocar paciente -->
          {#if patientAction === 'swap'}
            <form
              method="POST"
              action="?/swap_patient"
              use:enhance
              class="mt-3 flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="appointmentId" value={slot.appointmentId} />
              <Field label="Novo paciente">
                <select
                  name="newReferralId"
                  required
                  class="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {#each schedule.eligible as er}
                    <option value={er.referralId}>
                      {er.patientName} — {apptLabel[er.nextApptNumber] ?? `Consulta ${er.nextApptNumber}`}
                    </option>
                  {/each}
                </select>
              </Field>
              <Button type="submit" variant="primary" size="sm">Confirmar troca</Button>
            </form>
          {/if}

          <!-- Formulário: mover para outra visita -->
          {#if patientAction === 'move'}
            <form
              method="POST"
              action="?/move_appointment"
              use:enhance
              class="mt-3 flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="appointmentId" value={slot.appointmentId} />
              <Field label="Visita de destino">
                <select
                  name="targetScheduleId"
                  required
                  class="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {#each data.schedules.filter((s) => s.id !== schedule.id) as s}
                    <option value={s.id}>
                      {formatDate(s.scheduledDate)} · {s.unitName}
                    </option>
                  {/each}
                </select>
              </Field>
              <Field label="Horário de destino">
                <input
                  name="targetTime"
                  type="time"
                  required
                  class="rounded-md border border-neutral-200 px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none"
                />
              </Field>
              <Button type="submit" variant="primary" size="sm">Mover</Button>
            </form>
          {/if}

          {#if form && 'modalError' in form && form.modalError}
            <p class="mt-2 text-sm text-danger-600">{form.modalError}</p>
          {/if}

          <!-- Desmarcar — ação destrutiva separada -->
          <div class="mt-3 border-t border-neutral-100 pt-3">
            <form method="POST" action="?/remove_appointment" use:enhance class="inline">
              <input type="hidden" name="id" value={slot.appointmentId} />
              <button
                type="submit"
                class="text-xs text-danger-500 hover:text-danger-700 transition-colors"
                onclick={(e) => {
                  if (!confirm(`Desmarcar ${slot.patientName ?? 'este paciente'}?`)) e.preventDefault()
                }}
              >
                × Desmarcar paciente
              </button>
            </form>
          </div>
        </div>
      {/if}

    </div>
  {/if}

  {#snippet footer()}
    <Button variant="ghost" onclick={() => { patientModal = null; patientAction = null }}>
      Fechar
    </Button>
  {/snippet}
</Modal>
