# Agenda Prótese Digital — Documento de Descoberta
**Versão:** 2.0 — Validado pela Coordenação  
**Data:** Março de 2026  
**Status:** ✅ Pronto para modelagem do banco de dados

---

## Contexto Geral

O sistema tem como objetivo rastrear e gerenciar o fluxo completo de confecção e ajuste de próteses dentárias no município, desde o encaminhamento do paciente pelo dentista da unidade até a entrega da prótese definitiva finalizada.

O modelo atual utiliza **prótese digital**, confeccionada após escaneamento intraoral por empresa terceirizada. O profissional terceirizado atende atualmente **todas as sextas-feiras** em unidades de saúde específicas (configurável). Os dias e horários serão expandidos futuramente.

---

## Decisão Estrutural Central — Paciente vs. Encaminhamento

> ⚠️ Esta é a decisão arquitetural mais importante do sistema.

Um mesmo paciente pode ser encaminhado para prótese **mais de uma vez** ao longo do tempo (ex: quebrou a prótese, perdeu um dente adicional, novo tipo de prótese necessária). Por isso, o sistema separa dois conceitos distintos:

```
PACIENTE (dados permanentes, não mudam entre encaminhamentos)
  └── Nome, CPF, data de nascimento, telefone, unidade de saúde

ENCAMINHAMENTO / CASO (dados específicos de cada processo)
  └── Data de introdução, tipo(s) de prótese, OS, status, observações
  └── Um paciente pode ter N encaminhamentos ao longo do tempo
  └── Cada encaminhamento tem seu próprio histórico de consultas
```

Exemplo prático: Maria Santos teve uma prótese total superior em 2024. Em 2026, perdeu mais um dente e precisa de uma parcial inferior. São dois encaminhamentos distintos, com datas, OS e status independentes — mas o mesmo cadastro de paciente.

**Caso especial — Quebra ou Perda:**  
Quando uma prótese é quebrada ou perdida, cria-se um novo encaminhamento vinculado ao anterior. O processo pode ser mais rápido porque a empresa já possui o molde digital, bastando reimprimir. O histórico anterior fica preservado e vinculado.

---

## Atores e Níveis de Acesso

| Ator | O que pode fazer | O que pode ver |
|---|---|---|
| **Dentista** | Inserir encaminhamento; confirmar unidade antes de salvar; inserir/editar observações | Somente seus próprios registros de inserção |
| **Atendente** | Realizar contato com pacientes; registrar tentativas; ocupar slots de agenda; inserir/editar observações | Sua unidade + unidades designadas à sua responsabilidade |
| **Coordenador** | Tudo: regular fila, priorizar, configurar sistema, gerenciar usuários, liberar/restringir visibilidade de informações ao terceirizado, inserir/editar observações | Todas as unidades |
| **Terceirizado** | Confirmar presença/falta/recusa na consulta; registrar OS pronta; indicar previsão de tempo para próxima consulta | Lista do dia + casos com consulta pronta aguardando recebimento + informações liberadas pelo coordenador |

> **Nota:** Os perfis Coordenador e Administrador foram unificados em um único perfil **Coordenador**.

> **Observação sobre o dentista e a unidade:** Alguns dentistas atuam em mais de uma unidade. O sistema sugere a unidade padrão do dentista logado, mas exibe confirmação antes de salvar, permitindo a troca.

> **Observação sobre observações:** O campo de observações não é exclusivamente clínico. Dentistas, atendentes e coordenadores podem inserir e editar observações em momentos diferentes do processo.

---

## Jornadas e Requisitos de UX/UI por Ator

---

### Dentista

#### Jornada Consolidada

Cadastro ocorre **após o atendimento**, com foco em rapidez e baixo atrito.

**Fluxo otimizado:** Buscar paciente (CPF) → confirmar unidade → selecionar próteses → salvar

#### Dores Principais

- Risco de erro na combinação de próteses — impacta o intervalo calculado. **É o erro mais comum.**
- Falta de feedback claro da unidade ativa no momento do cadastro
- Perda de dados em caso de interrupção durante o preenchimento
- Falta de contexto clínico prévio no momento do encaminhamento

#### Requisitos de UI — Cadastro

- Busca por CPF com **autopreenchimento automático** dos dados do paciente
- Tela única, sem navegação entre etapas
- Sugestão das próteses mais comuns (atalho para a combinação mais frequente)
- Adição dinâmica de múltiplas próteses
- Resumo antes de salvar: unidade ativa · tipos selecionados · intervalo calculado automaticamente

#### Requisitos de UI — Contexto Clínico

- **Histórico do paciente acessível via modal** (sem sair da tela de cadastro)
- Badge fixo com a unidade ativa visível em todo momento
- **Sticky state da unidade por sessão** (não precisa reconfirmar a cada cadastro)

#### Requisitos de UI — Fase de Avaliação (Fase 5)

- Seleção clara: **Conforme / Não conforme** por critério
- Campo de justificativa **condicional** — só aparece quando necessário

#### Resiliência

- Auto-save automático de rascunho — evita perda de dados em interrupções

#### Requisitos Complementares

- CPF obrigatório para busca e cadastro
- Histórico clínico acessível sem sair da tela
- Não exigir upload de anexos — texto livre é suficiente

---

### Atendente

#### Jornada Consolidada

**Receber → Priorizar → Contatar → Agendar**

#### Dores Principais

- Necessidade de cruzar múltiplas informações dispersas para decidir quem contatar
- Falta de separação visual clara entre filas distintas
- Controle manual de tentativas de contato (planilha externa)
- Baixa visibilidade sobre próteses recebidas e próteses atrasadas
- Gestão simultânea de múltiplas unidades sem suporte claro no sistema

#### Requisitos de UI — Painel Principal (núcleo do sistema)

**Custódia de Próteses:**
- Próteses a receber (OS marcada como pronta, aguardando confirmação)
- Próteses recebidas — ação principal: **Agendar**
- Próteses atrasadas — ordenadas por tempo de atraso

**Filas (separação obrigatória):**
- Aguardando 1ª consulta (nunca atendidos)
- Em tratamento (retornos agendados ou aguardando agendamento)

**Ordenação:**
- Encaminhamentos novos: por data de introdução
- Em tratamento: por data da última consulta (mais antigo no topo)

**Filtro de unidades:**
- Minha unidade
- Unidades sob minha responsabilidade
- Todas (com dropdown ou outra solução de melhor UX)

#### Requisitos de UI — Módulo de Contato

- Modal leve — sem abrir a ficha completa do paciente
- Registro estruturado: data (automática) · canal · resultado · observação livre
- Atalhos: link direto WhatsApp (`wa.me`) e clique para ligar

#### Notificações

Badges por módulo:
- Novas próteses recebidas
- Próteses/pacientes com atraso
- Pendências de contato

#### Requisitos Complementares

- Registro formal de contatos substitui planilha externa
- Regra operacional: média de 2 tentativas antes de escalar para o coordenador
- Sem QR Code — busca por nome ou CPF é suficiente

#### Lacunas em Aberto

- Regra definitiva de desistência: quando parar as tentativas de contato?
- Confirmação do canal dominante: WhatsApp é o principal?

---

### Coordenador

#### Jornada Consolidada

**Monitorar → Antecipar → Intervir**

#### Dores Principais

- Falta de previsibilidade sobre demanda futura e capacidade disponível
- Ausência de visão consolidada entre unidades
- Dificuldade em equilibrar demanda vs. capacidade instalada
- Dependência de análise manual para identificar gargalos

#### Requisitos de UI — Dashboard

**Indicadores obrigatórios:**
- Fila total: nunca atendidos · em tratamento
- Tempo médio de espera
- Próteses recebidas e próteses atrasadas
- Taxa de falta

**Visualizações:**
- Ranking de atraso (pacientes fora da janela há mais tempo)
- Evolução do backlog ao longo do tempo
- Distribuição por unidade

**Previsibilidade (diferencial crítico):**
- Cálculo automático: capacidade semanal vs. ocupação (retornos + novos)
- Output direto: "X vagas disponíveis para novos pacientes esta semana"

#### Requisitos de UI — Central de Notificações

- Não conformidades pendentes de decisão
- Atrasos sistêmicos (pacientes esquecidos)
- Contatos esgotados sem resolução (aguardando decisão do coordenador)

#### Requisitos Complementares

- Campo configurável: limite de pacientes por semana
- Logs de auditoria *(futuro)*
- Ações em massa (bulk) *(futuro)*
- Exportação CSV/Excel *(futuro)*

#### Regras Operacionais

- Coordenador pode intervir diretamente no agendamento
- Sem meta formal de tempo de espera, mas o sistema deve medir e exibir

#### Lacunas em Aberto

- Definir política formal de priorização (ex: ouvidoria, urgência médica)

---

### Terceirizado (Protético)

#### Jornada Consolidada

**Visualizar agenda do dia → atender → registrar → finalizar**

#### Dores Principais

- Uso predominantemente via celular próprio, sem garantia de PC disponível na unidade
- Tempo crítico durante o atendimento — interface deve ser mínima e direta
- Dependência de conectividade pode ser um risco em algumas unidades

#### Requisitos de UI — Tela Principal: "Meu Dia"

- Lista de pacientes do dia ordenada por horário
- Para cada paciente: nome · tipo de prótese · unidade · observação destacada

#### Requisitos de UI — Ações Rápidas

Botões grandes, touch-friendly:
- ✅ Compareceu
- ❌ Faltou
- 🏁 Finalizado
- 🚫 Recusado

- Inputs simplificados: seleção rápida de tempo (sem digitação manual)

#### Requisitos Complementares

- **Mobile-first obrigatório** — uso em celular próprio
- Registro ocorre **após** o atendimento
- Sem encaixe: somente pacientes agendados aparecem na lista
- Campo de observação rápida por paciente
- Aba de não conformidades acessível

#### Resiliência

- Offline-first recomendado (internet atual é ok, mas pode falhar)
- Sincronização automática quando a conexão for restabelecida

#### Dados Operacionais

- Média: **8 pacientes/dia** · intervalo típico: 7–10

---

## Dados do Paciente

### Tabela: Paciente (dados permanentes)

- Nome completo
- Data de nascimento
- CPF
- Telefone (preferencialmente com WhatsApp)
- Unidade de saúde de origem

### Tabela: Encaminhamento / Caso (dados por processo)

- Vínculo com o paciente
- **Data de introdução** ← início do relógio de espera para este encaminhamento
- Tipo(s) de prótese solicitada(s) — multi-seleção *(ver nota abaixo)*
- Número da Ordem de Serviço — OS (fornecido pela empresa terceirizada)
- Status do encaminhamento: `Ativo` | `Reavaliação Pendente` | `Suspenso` | `Inativo`
- Motivo de inativação: `Desistência` | `Óbito` | `Cancelamento`
- Vínculo com encaminhamento anterior (em caso de quebra/perda)
- Observações (texto livre — visível e editável por dentista, atendente e coordenador)

> **Nota sobre múltiplos tipos de prótese:** É comum um encaminhamento incluir dois tipos (ex: PT Superior + PT Inferior). ✅ **Decisão tomada:** tabela separada com relação N:N entre encaminhamento e tipo de prótese. Cada tipo é contabilizado individualmente nas métricas.

### Tipos de Prótese

- Prótese Total Maxilar
- Prótese Total Mandibular
- Prótese Parcial Maxilar Removível
- Prótese Parcial Mandibular Removível
- Colocação de Placa de Mordida
- Prótese Temporária
- Reembasamento e Conserto
- **Repetição** *(adicionado)*
- Outros

---

## Estrutura de Consultas por Encaminhamento

> ⚠️ Esclarecimento importante validado pela coordenação.

Cada encaminhamento tem **4 consultas como padrão**. Consultas adicionais são exceção — acontecem raramente, mas o sistema permite sem bloquear.

| Consulta | O que acontece |
|---|---|
| **1ª — Escaneamento** | Nenhum ajuste. Apenas escaneamento intraoral. Marco zero da confecção. |
| **2ª — 1ª consulta de ajuste** | Prótese provisória entregue. Ajuste de encaixe, cor, estética. |
| **3ª — 2ª consulta de ajuste** | Ajustes finais na provisória. |
| **4ª — Entrega da definitiva** | Prótese no material final instalada. Avaliação do dentista. |

### Prazos entre consultas

| Situação | Prazo padrão |
|---|---|
| Após escaneamento → 2ª consulta (todos os tipos) | **14 dias** |
| Após escaneamento → 2ª consulta (próteses removíveis) | **21 dias** *(peça metálica exige mais tempo)* |
| Entre 2ª, 3ª e 4ª consultas (todos os tipos) | **14 dias** |

> Todos os prazos são configuráveis pelo coordenador. Os prazos das removíveis se equiparam aos demais a partir da 2ª consulta.

---

## Fluxo Completo — As 5 Fases

---

### FASE 1 — Entrada do Paciente (Encaminhamento)

**Quem:** Dentista da unidade de saúde  
**O que acontece:** O dentista identifica a necessidade de prótese e registra o encaminhamento. Esse momento define a **data de introdução** deste encaminhamento.

**Fluxo:**
1. Dentista acessa o sistema com seu login
2. Busca o paciente pelo CPF — se já existir, vincula novo encaminhamento; se não, cria o cadastro
3. Preenche os dados do encaminhamento: tipo(s) de prótese, observações
4. Sistema sugere a unidade com base no login; dentista confirma ou corrige antes de salvar
5. Encaminhamento entra na fila com status `Ativo`

**Regra especial — Reavaliação Pendente:**  
Encaminhamentos que aguardam na fila por mais de **6 meses** (configurável) recebem automaticamente o status `Reavaliação Pendente`. Esses pacientes **não ficam disponíveis para agendamento** até que o dentista os reavalie clinicamente. Após reavaliação (com possível atualização do tipo de prótese), o encaminhamento retorna à fila com a **data de introdução original preservada**.

---

### FASE 2 — Regulação da Fila e Agendamento

**Quem:** Coordenador (regula e libera para agendamento) + Atendente ou Coordenador (contata e agenda)  
**O que acontece:** O coordenador decide quais pacientes ficam disponíveis para agendamento. Quem fizer o agendamento (coordenador ou atendente) define data e horário com base na disponibilidade informada pelo paciente.

> **Importante:** O sistema exibe apenas pacientes das unidades que o terceirizado atenderá na semana configurada. Se o terceirizado atende no "Centro - UBS" naquela semana, apenas pacientes do Centro e das unidades designadas ao Centro ficam visíveis para agendamento.

#### Critérios de Prioridade (para novos encaminhamentos — 1ª consulta)

O sistema ordena por **data de introdução** como padrão e exibe flags visuais:

| Flag | Situação |
|---|---|
| 🔴 Ouvidoria | Paciente com registro de ouvidoria |
| 🟡 Acidente | Necessidade decorrente de acidente |
| ⚠️ Idoso | Paciente acima da idade configurável *(padrão a definir)* |
| 🕐 Atrasado | Passou da janela esperada sem agendamento |
| ⏸️ Suspenso | Paciente temporariamente impedido — permanece visível mas sinalizado |

#### Critérios de Prioridade (para pacientes em confecção — retorno)

- Prótese pronta confirmada + maior tempo desde a última consulta = topo da fila

#### Fluxo de Contato

1. Atendente ou coordenador visualiza a lista de pacientes disponíveis para contato
2. Realiza o contato e registra:
   - Data e horário
   - Canal: `Ligação` | `WhatsApp` | `Presencial`
   - Resultado: `Confirmado` | `Sem resposta` | `Desmarcou`
   - Observação livre *(com quem falou, restrições de horário, outras informações relevantes)*
3. Para contato por **WhatsApp**: registrar também o prazo de aguardo de resposta (padrão: até 24 horas)
4. Slot é ocupado **somente após confirmação do paciente**, com data e horário definidos conforme disponibilidade

#### Regras de Tentativas de Contato

**Para novos pacientes (pré-1ª consulta):**
- Até 5 tentativas em dias e horários diferentes
- Após a 3ª tentativa sem sucesso → flag amarelo visível para o coordenador
- Após 5 tentativas sem sucesso → coordenador decide: continuar tentando ou liberar a vaga
  - Se liberar a vaga: paciente volta para a fila com flag de "sem contato", mas **não fica disponível para agendamento** até o coordenador liberar novamente

**Para pacientes em confecção (processo já iniciado):**
- Tentativas contínuas, sempre registradas
- Paciente nunca vai a inativo automaticamente
- Inativo apenas por: `Desistência` | `Óbito` | `Cancelamento`
- Status `Suspenso`: paciente temporariamente impedido (viagem, doença, tratamento paralelo). Permanece visível na fila com flag, provavelmente no topo. Sem campo "até" para manter a simplicidade — coordenador remove a suspensão manualmente quando adequado.

#### Distinção entre Falta e Desmarcamento

| Situação | Consequência |
|---|---|
| Faltou sem avisar | Slot perdido; paciente volta ao topo da fila; flag de atenção após 2 faltas seguidas |
| Desmarcou com aviso | Slot pode ser realocado; paciente mantém prioridade sem penalidade |

---

### FASE 3 — 1ª Consulta (Escaneamento)

**Quem:** Profissional terceirizado  
**O que acontece:** Escaneamento intraoral. Nenhum ajuste é feito nesta consulta.

> **Interface do terceirizado:** deve ser **mobile-first**. Em algumas unidades haverá PC desktop com auxiliar de odonto para os registros; em outras, não. O terceirizado deve conseguir registrar tudo pelo próprio celular quando necessário.

**Fluxo:**
1. Terceirizado acessa a lista do dia pelo sistema (mobile)
2. Para cada paciente, registra uma das opções:
   - ✅ **Compareceu** → sistema registra data e calcula prazo da próxima consulta
   - ❌ **Faltou** → slot registrado como perdido; paciente volta ao topo da fila
   - 🚫 **Recusado** → terceirizado obrigatoriamente registra o motivo *(situação bucal que impede início da confecção)*
3. Ao confirmar comparecimento, terceirizado indica a **previsão de tempo para a próxima consulta**: `30 minutos` | `1 hora`
   - Essa informação fica visível para quem fará o agendamento
4. Sistema calcula automaticamente a data prevista para o retorno (próximo dia de atendimento disponível após o prazo configurado)

**Em caso de Recusa:**
- Motivo registrado pelo terceirizado
- Informação visível para o terceirizado (foi ele quem recusou), para o dentista que encaminhou e para o coordenador
- Paciente permanece na fila aguardando resolução da situação clínica

**Em caso de falta:**
- Paciente volta ao topo da fila
- Após 2 faltas seguidas: flag de atenção para o coordenador

---

### FASE 4 — Ciclo de Consultas (Confecção)

**Quem:** Profissional terceirizado (executa e registra) + Atendente/Coordenador (agenda retornos)

**O que acontece:** A empresa confecciona próteses provisórias para as consultas de ajuste (2ª e 3ª). Na 4ª consulta, entrega a prótese definitiva.

> **Próteses removíveis** tendem a exigir mais tempo na confecção inicial (peça metálica), por isso o prazo da 1ª para a 2ª consulta é de 21 dias. As consultas seguintes seguem o padrão de 14 dias.

#### Fluxo de Custódia da Prótese

Para garantir que nenhuma prótese se perca entre a empresa e a unidade:

1. Terceirizado marca a OS como **"consulta pronta"** no sistema
2. Sistema sinaliza como **"aguardando confirmação de recebimento"**
3. Atendente ou coordenador confirma o recebimento físico na unidade
4. **Somente após confirmação** o sistema libera o agendamento do paciente
5. Atendente ou coordenador agenda e realiza o contato

#### Monitoramento de Janelas

- O sistema monitora o prazo esperado entre consultas
- Se um paciente ultrapassa a janela prevista sem agendamento → flag automático de atraso
- Isso evita que alguém fique esquecido no meio do processo

#### Visibilidade do Terceirizado

O terceirizado pode visualizar todos os casos com consulta pronta (OS na empresa), com:
- Nome do paciente
- Tipo de prótese
- Número da OS
- Data da última consulta (para ter noção de prioridade)
- Ordenação por data da última consulta (mais antigo primeiro)

---

### FASE 5 — Finalização e Entrega

**Quem:** Terceirizado (instala) + Dentista da unidade (avalia conformidade) + Coordenador (aprova e registra OK) + Atendente (ligação de satisfação)

---

**Passo 1 — Instalação da Prótese Definitiva (4ª consulta)**  
O terceirizado instala a prótese definitiva e registra no sistema, da mesma forma que nas consultas anteriores.

---

**Passo 2 — Avaliação de Conformidade pelo Dentista**

> ⚠️ **Conformidade e Aprovação são independentes.**  
> O dentista pode registrar uma não conformidade e ainda assim aprovar a prótese (ex: paciente com expectativas não realistas, desconforto inerente ao uso de prótese). A não conformidade documenta a situação clínica; a aprovação é a decisão técnica e contratual.

O dentista avalia os 3 critérios:

| Critério | Resultado |
|---|---|
| Adaptação e Estética | ✅ Conforme / ❌ Não conforme |
| Oclusão e Funcionalidade | ✅ Conforme / ❌ Não conforme |
| Material e Acabamento | ✅ Conforme / ❌ Não conforme |

- Em caso de **Não conforme** em qualquer critério: dentista **obrigatoriamente** registra o motivo (campo texto livre)
- Mesmo com não conformidade, o dentista pode **Aprovar** a prótese

**Parecer final:**
- ✅ **Aprovado** — prótese atende os critérios técnicos e contratuais
- ❌ **Recusado** — dentista **obrigatoriamente** justifica; prótese retorna para ajuste ou repetição pela empresa

**Visibilidade das informações de não conformidade e recusa:**
- Visíveis imediatamente para o coordenador
- Coordenador decide se libera a visualização para o terceirizado (representante da empresa)

---

**Passo 3 — OK da Coordenação**  
Após aprovação do dentista, o coordenador registra:
- ✅ OK formal com data
- Número da nota fiscal emitida pela empresa *(pode conter letras e números)*

Esse registro libera os trâmites de pagamento à empresa terceirizada.

---

**Passo 4 — Ligação de Satisfação**  
Entre **30 e 60 dias após a instalação da definitiva**, o atendente realiza uma ligação de acompanhamento e registra:

| Resposta | Ação no sistema |
|---|---|
| 😊 Ótimo, me adaptei bem | Caso encerrado |
| 😐 Razoável, ainda me acostumando | Registro + monitoramento |
| 😞 Com dificuldades / preciso de consulta | Checkbox marcado: "necessita consulta na Unidade" |

**Para o caso de necessidade de consulta na Unidade:**
- Um checkbox simples sinaliza a necessidade
- Atendentes, coordenadores e dentistas veem a sinalização
- A marcação da consulta é feita em outro sistema (agenda da unidade)
- Após a consulta ser marcada, o responsável remove a sinalização no sistema

> O caso só é encerrado definitivamente após o registro da ligação de satisfação.

---

## Dashboard — Tela Principal

### Coordenador

| Indicador | Descrição |
|---|---|
| ✅ / ⚠️ Próteses previstas | Todas confirmadas ou quantidade pendente de recebimento |
| 📊 Meta do mês | X / 20 finalizadas (meta configurável) |
| 📋 Agendamentos pendentes | Pacientes disponíveis aguardando contato |
| 📅 Horizonte de slots | Previsão de retornos nas próximas semanas |
| ❌ Não conformidades / Recusas | Se houver casos pendentes de avaliação ou decisão |
| 🏥 Consulta na Unidade | Pacientes com necessidade de marcação de consulta com dentista |

### Atendente

| Badge | Significado |
|---|---|
| 🔵 Azul | Pacientes novos aguardando primeiro contato |
| 🟡 Amarelo | Retornos com prótese confirmada e pronta para agendar |
| 🔴 Vermelho | Pacientes fora da janela esperada (atrasados) |
| 🏥 Branco/Cinza | Pacientes com necessidade de consulta na Unidade |

---

## Métricas do Sistema

### Por Período

- Pessoas atendidas (prótese finalizada)
- Pessoas aguardando (sem 1ª consulta)
- Pacientes ativos em confecção
- Atendidos por unidade de saúde
- Próteses entregues por tipo
- Próteses entregues por faixa etária
- Satisfação pós-entrega (por tipo, por período)
- Não conformidades por critério (Adaptação | Oclusão | Material)
- Recusas por fase (escaneamento | consulta de ajuste | entrega)
- Tempo médio de espera (introdução → 1ª consulta)
- Tempo médio de conclusão (1ª consulta → definitiva instalada)

---

## Configurações do Sistema (painel do Coordenador)

| Parâmetro | Valor padrão |
|---|---|
| Tempo para flag "Reavaliação Pendente" | 6 meses |
| Dias e horários de atendimento do terceirizado | Sexta-feira, 8h às 15h |
| Unidades onde o terceirizado atende por semana | Configurável por data |
| Intervalo entre consultas — padrão | 14 dias |
| Intervalo 1ª → 2ª consulta — próteses removíveis | 21 dias |
| Meta mensal de finalizações | 20 |
| Número máximo de tentativas de contato (novos) | 5 |
| Tentativas para flag amarelo | 3 |
| Prazo máximo de resposta WhatsApp | 24 horas |
| Idade para flag ⚠️ Idoso | A definir |
| Unidades designadas por unidade responsável | Configurável por unidade |

---

## Modelo de Unidades e Responsabilidades

### Unidades Responsáveis e suas Designadas

**Centro - UBS** é responsável pelos agendamentos de:
1. Alvinópolis - UBS
2. Boa Vista - USF
3. Cachoeira - USF
4. CEO (Centro de Especialidades Odontológicas)
5. Flamenguinho - UBS
6. Itapetinga - USF
7. Portão - USF
8. Tanque - USF

**Imperial - USF** é responsável pelos agendamentos de:
1. Cerejeiras - USF
2. Maracanã - USF
3. Rio Abaixo - USF
4. Rio Acima - USF
5. Rosário - USF
6. Santa Clara - USF
7. São José - USF
8. Usina - USF

### Regra de Visibilidade por Semana

O coordenador configura semanalmente em quais unidades o terceirizado atenderá. O sistema filtra automaticamente os pacientes visíveis para agendamento com base nessa configuração:

```
Exemplo:
Terceirizado atende em "Centro - UBS" nesta semana
→ Visíveis para agendamento: pacientes do Centro + das 8 unidades designadas ao Centro
→ Atendente do Centro vê apenas esses pacientes
→ Coordenador vê esses pacientes por padrão, mas pode visualizar todos
```

---

## Lacunas Transversais (afetam todos os atores)

---

### 1. Separação estrutural de filas (CRÍTICO)

Obrigatório em todo o sistema — nunca misturar:
- **Encaminhados** (aguardando 1ª consulta — nunca atendidos)
- **Em tratamento** (processo já iniciado — retornos)

---

### 2. Custódia de próteses (núcleo operacional)

Três estados claramente visíveis:
- **Esperadas** — OS marcada como pronta, aguardando confirmação de recebimento
- **Recebidas** — confirmadas na unidade, liberadas para agendamento
- **Atrasadas** — prazo da janela vencido sem agendamento

---

### 3. Modelo de contato (formalizar)

Substituir planilha externa por estrutura interna no sistema — cada tentativa de contato deve ser registrada formalmente.

---

### 4. Notificações orientadas a eventos

O sistema não deve ser apenas consulta passiva. Deve notificar proativamente sobre eventos críticos: prótese recebida, janela vencida, tentativas esgotadas, não conformidade registrada.

---

### 5. Datas críticas mensuráveis

O sistema deve permitir calcular:
- **Tempo de espera:** data de introdução → 1ª consulta
- **Tempo de conclusão:** 1ª consulta → entrega da prótese definitiva

---

## Riscos Mapeados e Mitigações

| Risco | Mitigação no sistema |
|---|---|
| Slot fantasma | Confirmação de recebimento obrigatória antes do agendamento |
| Paciente esquecido | Flag automático quando janela esperada vence |
| Prótese extraviada | Fluxo de custódia com confirmação de recebimento na unidade |
| Pagamento indevido à empresa | OK formal + número de NF como pré-requisito |
| Contestação contratual | Registro de não conformidades por critério e histórico completo |
| Ouvidoria sem histórico | Registro de canal, tentativas e resultado de cada contato |
| Terceirizado sem PC na unidade | Interface mobile-first para todos os registros do terceirizado |
| Informação sensível exposta | Coordenador controla o que o terceirizado pode visualizar |

---

## Pontos Resolvidos na Validação

| Ponto | Decisão |
|---|---|
| Tempo para Reavaliação Pendente | ✅ 6 meses confirmado |
| Prazos entre consultas | ✅ 14 dias padrão; 21 dias para removíveis após escaneamento |
| Número de consultas | ✅ Exatamente 4 para todos os tipos |
| Reprovação → comunicação à empresa | ✅ Via sistema; coordenador libera visibilidade ao terceirizado |
| Quem confirma recebimento | ✅ Atendente ou coordenador |
| Prazo da ligação de satisfação | ✅ 30 a 60 dias após instalação |
| Histórico em caso de quebra/perda | ✅ Novo encaminhamento vinculado ao anterior; processo possivelmente mais rápido |
| Unidades responsáveis e designadas | ✅ Centro - UBS (8 designadas) e Imperial - USF (8 designadas) |

---

## Decisão Tomada na Modelagem

**Múltiplos tipos de prótese no mesmo encaminhamento:**  
✅ **Tabela separada (relação N:N)** entre encaminhamento e tipo de prótese. Flexível, correto tecnicamente e permite quantificação plena nas métricas.

---

---

## Visão Estratégica do Sistema

Após a consolidação das jornadas, dores e requisitos de todos os atores, o sistema deixa de ser um **registro passivo de encaminhamentos** e passa a ser um **sistema operacional de agenda e fluxo**.

Três pilares sustentam essa visão:

| Pilar | O que resolve |
|---|---|
| **1. Fila inteligente** | Quem chamar — separação clara, ordenação por prioridade, flags visuais |
| **2. Custódia** | O que chegou e o que falta — rastreabilidade total das próteses |
| **3. Capacidade** | Quando posso chamar — previsibilidade de vagas disponíveis |

---

*Documento gerado e validado durante sessão de Discovery — Março de 2026.*  
*Atualizado com refinamentos de UX/UI, lacunas transversais e visão estratégica.*  
*Próximo passo: modelagem do banco de dados (Neon PostgreSQL) com dados de exemplo.*
