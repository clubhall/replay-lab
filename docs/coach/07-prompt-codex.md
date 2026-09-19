# Prompt de delegação — ClubHall Replay Coach

Copie o bloco abaixo para uma sessão Codex com acesso a `clubhall/replay-lab`.

```text
Você é o lead de implementação do ClubHall Replay Coach. Trabalhe no GitHub da organização ClubHall, repositório clubhall/replay-lab. NÃO crie nem publique um GPT Site.

Comece pela branch codex/replay-coach-plan-20260919, pasta docs/coach/. Leia README, contexto auditado, plano de produto, arquitetura, Tennis Coach, scoring/gameplay, validação e execução. Leia também AGENTS.md/CONTRIBUTING aplicáveis. Esta documentação descreve a ambição e o estado observado em 19/09; confira o estado atual antes de editar.

Objetivo: construir um app/experimento separado de coach dentro da base Replay, reaproveitando o monorepo e preparando integração com ClubHall. Quero assistir aos meus vídeos de tênis como uma partida jogável: navegar por pontos, câmera lenta, loop, análise corporal, explicações com evidência, cortes de um clique, estatísticas, conquistas e missões que me ajudem a jogar melhor.

Não pare em um plano ou mockup. Execute por rodadas até entregar um fluxo real, testado e revisável. Primeiro reconcilie main e PR #1 codex/replay-ios, escolha uma base segura e preserve trabalho existente. Reaproveite o padrão Jev do accollier/made-for-me, branch codex/clubhall-cloud-prototype, conforme as referências do plano. Não confunda Jev com o detector de vídeo.

Abra duas frentes paralelas obrigatórias:
1. Game Director: regras de tênis, eventos, estatísticas com denominadores, badges, recompensas idempotentes e progressão.
2. Tennis Coach: conhecimento técnico fundamentado, percepção real, identidade do jogador, avaliação do movimento, observações com timestamps, cues e drills personalizados.
Use especialistas adicionais de mídia/visão e revisão quando ajudarem. Você integra contratos e alterações; defina escopo de arquivos, dependências e critérios de aceite por agente.

Preserve vídeo como protagonista, materiais preto/ouro Cybercab e UI de gameplay com detalhes progressivos. A arena/companheiro vive em um plano espacial próprio; preserve a geometria aprovada. Evite dashboard genérico e chat tomando a tela. Consulte docs/coach/references/.

Comece pelo ciclo: importar vídeo real → selecionar atleta → play/seek/slow/loop → confirmar ponto → placar/conquista → observação técnica com prova → drill → corte exportado → recuperar sessão. Depois aprofunde análise, comparação e automação. O arquivo exportado precisa reproduzir; JSON/composição não é vídeo renderizado.

Regras de confiança: o skeleton atual baseado em bounding boxes não serve como biomecânica. Use pose real; diferencie demo, inferência e confirmação. Não deduza bola, winner ou ace apenas do corpo. Rotule monocular como “3D estimado de uma câmera”. Não invente ângulos ideais, erro técnico, velocidade, torque ou lesão. Compare engines nos mesmos clips antes de chamar uma de melhor.

Jev deve usar decisões tipadas/ações permitidas, evidências, request/revision, cancelamento e fallback identificado. Chaves ficam no servidor. Sem credencial, conclua o restante com fallback e declare a integração não validada; não transforme isso em bloqueio de toda a tarefa.

Valide scoring, idempotência, timestamps/identidade, abstenção, persistência, exportação e mobile. Faça revisão independente e corrija falhas concretas. Use meus vídeos quando disponíveis; até lá, fixtures explicitamente identificadas e mídia autorizada. Não publique vídeos privados no Git.

Faça escolhas reversíveis autonomamente. Mantenha uma branch de integração clara e PRs focados; não funda PRs existentes nem altere produção sem autorização. Atualize o registro de execução com commits, testes, evidências, o que é real, o que é demo e bloqueios. Entregue código executável, instruções de execução e um fluxo validado — não apenas recomendações.
```
