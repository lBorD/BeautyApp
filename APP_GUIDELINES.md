# Guia de desenvolvimento do App Mobile (Expo / React Native) — BeautyApp

Este documento orienta o desenvolvimento do app mobile do **BeautyApp**, priorizando rapidez, simplicidade e redução de fricção para profissionais autônomos.

## Visão geral

Este app é uma agenda simples para profissionais autônomos (ex.: lash designer, manicure, cabeleireira, esteticista).

Objetivo: substituir a combinação de:
- WhatsApp
- Google Calendar
- calculadora
- controle manual de clientes e serviços

O app deve exigir menos energia mental do que usar essas ferramentas separadamente.

## Princípio central do produto

Se uma tarefa for mais rápida de fazer no WhatsApp ou no Google Calendar, o app está errado.

Prioridades permanentes:
- rapidez
- simplicidade
- poucos toques
- clareza visual

## Estrutura de navegação

A navegação principal deve ser fixa e mínima.

- Barra inferior com 4 abas operacionais principais:
  - Agenda
  - Clientes
  - Serviços
  - Financeiro

- Exceção: a aba `Configurações` pode continuar como uma quinta aba utilitária para logout, preferências e ajustes de conta. Ela não deve competir com os fluxos principais nem virar um módulo pesado.

Evitar menus escondidos, pilhas complexas e navegação excessiva.

## Fluxo principal do produto

Fluxo crítico: criação de agendamento.

Meta: máximo de **3 a 5 ações**.

Ordem ideal:
1. selecionar cliente
2. selecionar serviço
3. selecionar horário
4. confirmar

Esse fluxo é prioridade máxima em qualquer decisão de UX e de backend.

## Princípios de UX

### Redução de carga cognitiva

Evitar sobrecarregar a profissional com memória, cálculos e decisões repetitivas.

Aplicar sempre:
- sinal/custo padrão já definido
- duração automática por serviço
- menos digitação possível

### Interface minimalista

Regras visuais:
- fundo claro
- uma cor principal
- poucos elementos por tela
- espaçamento generoso
- ação principal clara e óbvia em cada tela

### Velocidade percebida

O app deve parecer instantâneo.

Boas práticas:
- cache local
- atualização otimista
- evitar recarregar listas completas sem necessidade
- evitar spinners longos
- telas devem abrir mesmo offline, usando dados previamente carregados (quando possível)

## Estrutura de código

Organizar por feature.

- `features/agenda`
- `features/clients`
- `features/services`
- `features/finance`
- `shared/components` para componentes reutilizáveis

Evitar lógica espalhada entre telas. Regras de negócio devem ficar centralizadas por feature.

## Prioridades de desenvolvimento

1. fluxo de agendamento
2. estabilidade de autenticação, clientes e serviços
3. melhorias de velocidade e clareza na agenda
4. integração com Google Calendar
5. lembretes automáticos

Financeiro e regras para agendamentos concluídos/cancelados não são prioridade imediata. Antes de qualquer implementação financeira real, definir como esses status afetam os cálculos. O sinal, por enquanto, tem regra simples: padrão de 30% do valor total, por agendamento, ajustável por seletor de percentual ou por valor manual em R$, com exibição de quanto falta pagar e sem configuração por serviço.

Evitar funcionalidades complexas antes da validação de uso real do fluxo principal.

## Objetivo final do app

Ser a ferramenta central de trabalho de profissionais autônomos, com estas qualidades:
- rápido
- simples
- confiável
- intuitivo

A prioridade do projeto não é a quantidade de funcionalidades e sim a experiência de uso.
