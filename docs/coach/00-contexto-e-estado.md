# Contexto recuperado e estado verificado

Auditoria de leitura realizada em 19/09/2026. Conteúdo de repositório, descrição de PR, memória de conversa e runtime testado são tipos diferentes de evidência. Este levantamento não executou os apps nem verificou builds instalados no iPhone.

## Decisões das sessões anteriores

| Sessão | Decisão/resultado recuperado | Qualificação |
| --- | --- | --- |
| 25/03/2026 | Replay separado do app principal; recebe sessão/participantes/permissões e devolve mídia, momentos e análises | Decisão de arquitetura recuperada; manter fronteira |
| 28/05/2026 | Player/timeline próprios; indexing, highlights e pipeline de análise separados da UX | Proposta de arquitetura, não prova de implementação |
| 12/09/2026 | Experiência de “gameboy para esportes reais”; importação, momentos, câmera lenta, badge e persistência | Conversa relatou verificações locais; não comprova publicação ou dispositivo físico |
| 17/09/2026 | Interface imersiva com continuidade espacial e detalhes progressivos | Direção de design |
| 19/09/2026 | Cloud Navigation/arena e Jev para decisões tipadas e composição de interface | Brief anterior distingue propostas de implementação |
| Pedido atual | App separado de coach; tênis primeiro; vídeos reais, corpo, gameplay, recompensas e edição | Objetivo deste plano |
| Correção atual | GitHub da organização como local de execução; preparar plano e prompt para Codex antes da implementação | Não construir/publicar GPT Site |

No cadastro consultado, o antigo “ClubHall · Replay” de 12/09 estava sem versão publicada/URL ao vivo. Não confundir o relato de um protótipo local funcional com um produto distribuído.

## Código encontrado

| Projeto | Estado observado | Referência |
| --- | --- | --- |
| `clubhall/live` | Main contém apenas LICENSE, `06b3bbc6d0aba2869717b28e466bb6be8067694b`. PR #1 é documentação de captura/produção, não runtime | [Live PR #1](https://github.com/clubhall/live/pull/1) |
| `clubhall/replay-lab` | Base executável browser + FastAPI, pacotes de análise e overlays. Main `8e7991e22c1eda048484560a8e142a60f2a759e0` | [README fixado](https://github.com/clubhall/replay-lab/blob/8e7991e22c1eda048484560a8e142a60f2a759e0/README.md) |
| Replay iOS | PR #1 aberto/draft, `codex/replay-ios`, `a538853a2f6372ebc2af0e6424252f827d6d544d`, 12/09 | [PR #1](https://github.com/clubhall/replay-lab/pull/1) |
| App ClubHall | Código principal em `accollier/clubhall`; trabalho recente em PRs, não em Live | [PR #15 recovery](https://github.com/accollier/clubhall/pull/15), [PR #16 sports console](https://github.com/accollier/clubhall/pull/16) |
| Jev/Cloud prototype | `accollier/made-for-me`, branch `codex/clubhall-cloud-prototype`, `6465a051ce0274886f186fdfedba016bd9fa8b42` | [PR #1](https://github.com/accollier/made-for-me/pull/1) |
| `accollier/replay` | Main contém IDEA.md; não é a base executável encontrada | [Repo no commit auditado](https://github.com/accollier/replay/tree/75edf9c6c13481a101cf66da7b6b48237dadb042) |

Por isso este plano fica em **`clubhall/replay-lab`**. Ele não converte Live em aplicativo, nem substitui silenciosamente branches de mobile ou Cloud Navigation.

## O que já pode ser reaproveitado

Main do lab: player/timeline, contratos portáveis, tracks, pose frames, insights, engine runs e interfaces de worker. PR iOS: sua descrição registra importação local, velocidades, loop, trim, tags/notas, persistência e compartilhamento de original/composição. Conferir source e comportamento antes de portar.

No PR iOS, vídeo de highlights renderizado permanece pendente; compartilhamento de JSON/composição não resolve essa entrega. Validação física e EAS/TestFlight também não estão estabelecidas por esta auditoria. O preview listado no PR não foi testado aqui.

## Lacunas que mudam a implementação

1. **RF-DETR não está validado com vídeos reais nos resultados encontrados.** O runtime usa fixture fallback sem `CLUBHALL_RFDETR_RUNNER`; benchmark commitado registra clips reais pulados por falta de assets. [Runtime](https://github.com/clubhall/replay-lab/blob/8e7991e22c1eda048484560a8e142a60f2a759e0/apps/replay-rfdetr-service/app/rfdetr_runtime.py), [benchmark](https://github.com/clubhall/replay-lab/blob/8e7991e22c1eda048484560a8e142a60f2a759e0/fixtures/output/benchmark-summary.json).
2. **O fallback de pose não é detecção de articulações.** Posiciona joints por proporções fixas de bounding boxes. Não permite avaliar técnica/biomecânica. [Código](https://github.com/clubhall/replay-lab/blob/8e7991e22c1eda048484560a8e142a60f2a759e0/packages/engine-pose-abstraction/src/index.ts).
3. **Jev possui adapter, mas não coach de vídeo.** A branch encontrada implementa endpoint de composição com decisões tipadas e fallback; coaching era intenção não suportada. Não houve confirmação de chamada autenticada. [Decision core](https://github.com/accollier/made-for-me/blob/6465a051ce0274886f186fdfedba016bd9fa8b42/server/decision-core.mjs).
4. **Os contratos são uma base útil.** Ampliar preservando compatibilidade e proveniência. [Analysis contracts](https://github.com/clubhall/replay-lab/blob/8e7991e22c1eda048484560a8e142a60f2a759e0/packages/analysis-contracts/src/index.ts).

## Instruções do repositório

No main auditado, a árvore completa não contém AGENTS.md nem pasta docs. Existe [CONTRIBUTING.md](https://github.com/clubhall/replay-lab/blob/8e7991e22c1eda048484560a8e142a60f2a759e0/CONTRIBUTING.md), que pede mudanças focadas e lint/typecheck/test, com testes Python quando o worker mudar. O executor deve verificar instruções novamente na branch efetivamente utilizada.

## Escopo desta entrega

Somente documentação e referências visuais. Sem implementação de modelo, merge de PR existente, alteração de produção ou promessa de testes não executados. As verificações do plano cobrem links locais, consistência, proveniência e diff. O trabalho de implementação começa na sessão Codex delegada.
