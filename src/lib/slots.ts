// Lógica de geração e validação do grid de slots do terceirizado.
// Funções puras — sem dependência de banco ou servidor.

export type SlotStatus = 'available' | 'occupied'

export interface Slot {
  startTime: string  // "HH:MM"
  endTime: string    // "HH:MM"
  duration: number   // 30 ou 60
  status: SlotStatus
  patientName?: string
  appointmentNumber?: number
}

// Converte "HH:MM" ou "HH:MM:SS" para minutos desde meia-noite
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

// Converte minutos desde meia-noite para "HH:MM"
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface ExistingAppointment {
  scheduledTime: string      // "HH:MM" ou "HH:MM:SS"
  scheduledDuration: number | null  // 30 ou 60
  patientName: string
  appointmentNumber: number
}

interface GenerateSlotsParams {
  startTime: string         // "HH:MM" ou "HH:MM:SS"
  endTime: string           // "HH:MM" ou "HH:MM:SS"
  lunchStart: string | null
  lunchEnd: string | null
  defaultDuration: number   // 30 ou 60
  existingAppointments: ExistingAppointment[]
}

// Gera o grid de slots com base nos parâmetros da agenda.
// Regras:
//  - Slots gerados a partir de startTime com intervalos de defaultDuration minutos
//  - Nenhum slot ultrapassa endTime
//  - Nenhum slot cruza o horário de almoço
//  - Slot de 1h com consulta de 30min registrada é dividido em dois sub-slots de 30min
export function generateSlots({
  startTime,
  endTime,
  lunchStart,
  lunchEnd,
  defaultDuration,
  existingAppointments,
}: GenerateSlotsParams): Slot[] {
  const startMin = timeToMinutes(startTime)
  const endMin = timeToMinutes(endTime)
  const lunchStartMin = lunchStart ? timeToMinutes(lunchStart) : null
  const lunchEndMin = lunchEnd ? timeToMinutes(lunchEnd) : null

  // Índice de consultas existentes por horário de início (HH:MM normalizado)
  const apptByTime = new Map<number, ExistingAppointment>()
  for (const appt of existingAppointments) {
    apptByTime.set(timeToMinutes(appt.scheduledTime), appt)
  }

  const slots: Slot[] = []
  let current = startMin

  while (current + defaultDuration <= endMin) {
    // Pula bloco de almoço
    if (lunchStartMin !== null && lunchEndMin !== null) {
      if (current >= lunchStartMin && current < lunchEndMin) {
        current = lunchEndMin
        continue
      }
      // Slot que cruzaria o almoço: avança até o fim do almoço
      if (current < lunchStartMin && current + defaultDuration > lunchStartMin) {
        current = lunchEndMin
        continue
      }
    }

    const slotEnd = current + defaultDuration
    const appt = apptByTime.get(current)

    if (appt) {
      const apptDuration = appt.scheduledDuration ?? defaultDuration

      if (apptDuration >= defaultDuration) {
        // Slot inteiro ocupado
        slots.push({
          startTime: minutesToTime(current),
          endTime: minutesToTime(slotEnd),
          duration: defaultDuration,
          status: 'occupied',
          patientName: appt.patientName,
          appointmentNumber: appt.appointmentNumber,
        })
      } else {
        // Slot de 1h dividido: primeiro sub-slot ocupado
        const halfEnd = current + apptDuration
        slots.push({
          startTime: minutesToTime(current),
          endTime: minutesToTime(halfEnd),
          duration: apptDuration,
          status: 'occupied',
          patientName: appt.patientName,
          appointmentNumber: appt.appointmentNumber,
        })
        // Segundo sub-slot: verificar se também está ocupado
        const appt2 = apptByTime.get(halfEnd)
        if (appt2) {
          slots.push({
            startTime: minutesToTime(halfEnd),
            endTime: minutesToTime(slotEnd),
            duration: apptDuration,
            status: 'occupied',
            patientName: appt2.patientName,
            appointmentNumber: appt2.appointmentNumber,
          })
        } else {
          slots.push({
            startTime: minutesToTime(halfEnd),
            endTime: minutesToTime(slotEnd),
            duration: apptDuration,
            status: 'available',
          })
        }
      }
    } else if (defaultDuration === 60) {
      // Slot de 1h sem booking no início — verificar se segunda metade está ocupada
      const halfEnd = current + 30
      const appt2 = apptByTime.get(halfEnd)
      if (appt2 && (appt2.scheduledDuration ?? 30) <= 30) {
        // Primeira metade livre, segunda ocupada — exibe dois sub-slots de 30min
        slots.push({
          startTime: minutesToTime(current),
          endTime: minutesToTime(halfEnd),
          duration: 30,
          status: 'available',
        })
        slots.push({
          startTime: minutesToTime(halfEnd),
          endTime: minutesToTime(slotEnd),
          duration: 30,
          status: 'occupied',
          patientName: appt2.patientName,
          appointmentNumber: appt2.appointmentNumber,
        })
      } else {
        slots.push({
          startTime: minutesToTime(current),
          endTime: minutesToTime(slotEnd),
          duration: defaultDuration,
          status: 'available',
        })
      }
    } else {
      slots.push({
        startTime: minutesToTime(current),
        endTime: minutesToTime(slotEnd),
        duration: defaultDuration,
        status: 'available',
      })
    }

    current = slotEnd
  }

  return slots
}

// Valida se um horário pode ser agendado conforme as regras da agenda.
// Retorna null se válido, ou string com o motivo da rejeição.
export function validateSlot(
  scheduledTime: string,  // "HH:MM"
  duration: number,       // 30 ou 60
  startTime: string,
  endTime: string,
  lunchStart: string | null,
  lunchEnd: string | null
): string | null {
  const t = timeToMinutes(scheduledTime)
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  // Regra 1: início da janela é inclusivo
  if (t < start) {
    return `Horário fora da janela do terceirizado (${startTime.slice(0, 5)}–${endTime.slice(0, 5)})`
  }
  // Regra 2: consulta deve caber inteira antes do fim da janela
  if (t + duration > end) {
    return `Horário fora da janela do terceirizado (${startTime.slice(0, 5)}–${endTime.slice(0, 5)})`
  }

  // Regra 3: consulta não pode ocorrer durante o almoço
  if (lunchStart && lunchEnd) {
    const ls = timeToMinutes(lunchStart)
    const le = timeToMinutes(lunchEnd)
    // Bloqueia se o início estiver dentro do intervalo [lunchStart, lunchEnd)
    if (t >= ls && t < le) {
      return `Horário dentro do intervalo de almoço (${lunchStart.slice(0, 5)}–${lunchEnd.slice(0, 5)})`
    }
    // Bloqueia se a consulta cruzar o início do almoço
    if (t < ls && t + duration > ls) {
      return `Consulta ultrapassaria o horário de almoço (${lunchStart.slice(0, 5)})`
    }
  }

  return null
}
