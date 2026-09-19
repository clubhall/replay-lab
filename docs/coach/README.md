# ClubHall Replay Coach — plano de execução

**Data:** 19/09/2026 · **Primeiro esporte:** tênis · **Estado:** proposta documentada; implementação ainda não iniciada por este plano.

## Objetivo

Transformar vídeos reais de Arthur em uma experiência de partida jogável: rever pontos, navegar por acontecimentos, receber conquistas no momento certo, analisar movimentos, entender uma correção útil, praticar e comparar a evolução. O agente acompanha o jogo e opera o Replay com o atleta. O produto precisa funcionar como uma experiência de esporte e gameplay, com evidências visíveis para cada observação.

**Decisão explícita do usuário:** trabalhar no GitHub da organização; não construir nem publicar um GPT Site. Criar um app/experimento separado dentro da base existente, reaproveitando contratos e infraestrutura do Replay. A implementação será delegada ao Codex por meio deste pacote.

## Comece aqui

1. [Estado verificado da conta e sessões anteriores](00-contexto-e-estado.md).
2. [Produto, experiência e etapas](01-plano-de-produto.md).
3. [Arquitetura Jev, evidências e contratos](02-arquitetura.md).
4. [Agente especialista e pesquisa em biomecânica](03-tennis-coach.md).
5. [Placar, estatísticas e gameplay](04-scoring-e-gameplay.md).
6. [Validação e protocolo dos primeiros vídeos](05-validacao.md).
7. [Agentes, tarefas, dependências e aceite](06-execucao.md).
8. [Prompt completo para o Codex](07-prompt-codex.md).
9. [Referências visuais fornecidas pelo usuário](references/README.md).

## Resultado da primeira sessão com vídeo real

O atleta importa um vídeo, escolhe a si mesmo, reproduz e desacelera, marca um ponto, vê o placar e a conquista correspondentes, abre um movimento com evidência no frame, recebe uma orientação fundamentada, salva/exporta um trecho reproduzível e recupera a sessão depois de fechar o app.

Sem uma chamada Jev validada, o produto identifica a decisão como fallback local. Sem evidência visual suficiente, o treinador solicita uma vista melhor ou uma confirmação. Demonstrações permanecem separadas do histórico real. Uma reconstrução monocular estimada não será apresentada como biomecânica 3D validada.

## O que este PR entrega

Contexto auditado, proposta de implementação, contratos conceituais, frentes de agentes e critérios de teste. Não entrega um treinador em produção, uma integração Jev autenticada, um novo build TestFlight ou resultados de análise dos vídeos de Arthur.

## Implementation progress

The separate runnable experiment is in [`apps/replay-coach`](../../apps/replay-coach/README.md). See the single [execution record](EXECUTION.md) for implementation, evidence and remaining acceptance gates; the original plan above remains the handoff baseline.
