Mesclar com o documento agenda-protese-descoberta-v2.md

------

# Dentista

## 1. Jornada Consolidada

Cadastro ocorre **após atendimento**, com foco em rapidez e baixo atrito.

**Fluxo real otimizado:**
 Buscar paciente (CPF) → confirmar unidade → selecionar próteses → salvar

------

## 2. Dores Unificadas

- Risco de erro na combinação de próteses (impacta intervalo). Esse é o erro mais comum.
- Falta de feedback claro da unidade ativa
- Perda de dados em interrupções
- Falta de contexto clínico prévio no momento do encaminhamento

------

## 3. Requisitos de UI (Consolidados)

### Cadastro

-  Busca por CPF com **autopreenchimento automático**
- Tela única (sem navegação)
- Sugestão de próteses mais comuns
- Adição dinâmica de múltiplas próteses
- Resumo antes de salvar:
  - Unidade
  - Tipos
  - Intervalo calculado

------

### Contexto clínico

- **Histórico em modal (sem sair da tela)**
- Badge fixo com unidade ativa
- **Sticky state da unidade (sessão)**

------

### Fase final (qualidade)

- Seleção fácil:
  - Conforme / Não conforme
- Campo de justificativa:
  - Condicional (só aparece se necessário)

------

### Resiliência

- 💾 Auto-save (rascunho automático)

------

## 4. Requisitos Complementares (Unificados)

- CPF obrigatório
- Histórico clínico acessível
- Não exigir anexos (texto livre suficiente)

------

## 5. Pontos já resolvidos (confirmados)

- Busca por CPF já existente
- Cadastro é individual (não em lote)

------

# Atendente

## 1. Jornada Consolidada

Fluxo central do sistema:

**Receber → Priorizar → Contatar → Agendar**

------

## 2. Dores Unificadas

- Necessidade de cruzar múltiplas informações
- Falta de separação clara de filas
- Controle manual de contatos (planilha externa)
- Baixa visibilidade de:
  - Próteses recebidas
  - Próteses atrasadas
- Gestão de múltiplas unidades

------

## 3. Requisitos de UI (Consolidados)

## Painel Principal (núcleo do sistema)

### Estrutura obrigatória:

#### 1. Custódia de Próteses

- Próteses a receber
- Próteses recebidas (ação: **Agendar**)
- Próteses atrasadas (ordenadas por atraso)

------

#### 2. Filas (separação crítica)

- Aguardando 1ª consulta
- Em tratamento (retornos)

**Ordenação:**

- Encaminhamento (novos)
- Última consulta (em tratamento)

------

#### 3. Filtro de unidades

- Dropdown (ou outra opção com melhor UX:
  - Minha unidade
  - Unidades sob responsabilidade
  - Todas

------

## Módulo de Contato (rápido)

- Modal leve (não abre ficha completa)
- Registro estruturado:
  - Data (auto)
  - Canal
  - Resultado
  - Observação

------

### Atalhos

- Link direto WhatsApp (`wa.me`)
- Clique para ligar

------

## Notificações

- Badge por módulo:
  - Novas próteses
  - Atrasos
  - Pendências de contato

------

## 4. Requisitos Complementares (Unificados)

### Modelo de contato (ESSENCIAL)

- Registro formal (substitui planilha)
- Regra operacional:
  - Média de **2 tentativas de contato**

------

### Regras de fila

- Separação obrigatória:
  - Nunca atendidos vs em tratamento
- Ordenação dinâmica por prioridade

------

### Permissões

- Acesso a múltiplas unidades (já previsto → refletir UI)

------

### Simplificações operacionais

- Sem QR Code (busca por nome suficiente)

------

## 5. Lacunas ainda abertas

- Regra de desistência (quando parar contato)
- Confirmação de canal principal (WhatsApp dominante?)

------

# Coordenador

## 1. Jornada Consolidada

**Monitorar → Antecipar → Intervir**

------

## 2. Dores Unificadas

- Falta de previsibilidade
- Falta de visão consolidada
- Dificuldade em balancear:
  - Demanda vs capacidade
- Dependência de análise manual

------

## 3. Requisitos de UI (Consolidados)

## Dashboard (obrigatório)

### Indicadores:

- Fila total:
  - Nunca atendidos
  - Em tratamento
- Tempo médio de espera
- Próteses:
  - Recebidas
  - Atrasadas
- Taxa de falta

------

## Visualizações

- Ranking de atraso
- Evolução do backlog
- Distribuição por unidade

------

## Previsibilidade (diferencial crítico)

- Cálculo automático:
  - Capacidade semanal
  - Ocupação (retornos vs novos)
- Output:
  - “Vagas disponíveis para novos pacientes”

------

## Central de notificações

- Não conformidades
- Atrasos sistêmicos
- Contatos esgotados

------

## 4. Requisitos Complementares (Unificados)

- Campo:
  - Limite de pacientes na semana
- Logs de auditoria - futuro
- Ações em massa (bulk) - futuro
- Exportação (CSV/Excel) - futuro

------

## 5. Regras operacionais importantes

- Coordenador pode intervir no agendamento
- Sem meta formal de tempo de espera (mas sistema deve medir)

------

## 6. Lacunas ainda abertas

- Definir política de priorização (ex: ouvidoria, urgência)

------

# Protético

## 1. Jornada Consolidada

**Visualizar agenda do dia → atender → registrar → finalizar**

------

## 2. Dores Unificadas

- Uso exclusivo via celular
- Tempo crítico durante atendimento
- Interface precisa ser mínima e direta
- Dependência de conectividade (risco potencial)

------

## 3. Requisitos de UI (Consolidados)

## Tela principal: “Meu Dia”

- Lista de pacientes do dia
- Ordenação por horário
- Informações essenciais:
  - Nome
  - Tipo de prótese
  - Unidade
  - Observação destacada

------

## Ações rápidas

- Compareceu
- Faltou
- Finalizado
- Recusado

Botões grandes (touch-friendly)

------

## ⏱ Inputs simplificados

- Seleção rápida de tempo (sem digitação)

------

## 4. Requisitos Complementares (Unificados)

- Mobile-first obrigatório
- Uso em celular próprio
- Registro ocorre **após atendimento**

------

### Resiliência

- Offline-first (recomendado, mesmo com internet atual ok)
- Sincronização automática

------

### Funcional

- Campo de observação rápida
- Aba de feedback (não conformidades liberadas)

------

### Regra importante

- Sem encaixe (somente pacientes agendados)

------

## 5. Dados operacionais importantes

- Média: **8 pacientes/dia**
- Intervalo: 7–10 pacientes

------

# CONSOLIDAÇÃO DAS LACUNAS TRANSVERSAIS

## 1. Separação estrutural de filas (CRÍTICO)

Obrigatório no sistema inteiro:

- Encaminhados (sem 1ª consulta)
- Em tratamento

------

## 2. Custódia de próteses (núcleo operacional)

Deve existir claramente:

- Esperadas
- Recebidas
- Atrasadas

------

## 3. Modelo de contato (formalizar)

Substituir planilha atual por estrutura interna

------

## 4. Notificações

Sistema deve ser **orientado a eventos**, não só consulta passiva

------

## 5. Datas críticas 

Devemos poder obter:

- Tempo de espera desde o encaminhamento até a primeira consulta
- Tempo desde a primeira consulta até a entrega da prótese

------

# RESULTADO FINAL (síntese estratégica)

Após consolidação:

- O sistema deixa de ser **registro passivo**
- E passa a ser um **sistema operacional de agenda e fluxo**

Com três pilares claros:

1. **Fila inteligente (quem chamar)**
2. **Custódia (o que chegou / falta)**
3. **Capacidade (quando posso chamar)**