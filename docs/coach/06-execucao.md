# Execução por agentes

## Um responsável integra; especialistas entregam partes verificáveis

| Agente | Responsabilidade | Entrega | Dependência |
| --- | --- | --- | --- |
| Lead / integrador | Estado, branch, contratos, ordem e integração | App executável, PRs e registro de evidências | Nenhuma |
| Game Director | Regras, eventos, estatísticas, badges, XP e missões | Engine determinística + vetores de teste + interação do placar | Contratos de evento |
| Tennis Coach | Taxonomia, conhecimento, observações/cues/drills e avaliação | Coach baseado em evidência + coleção curada + rubrica | Contratos de evidência |
| Percepção / biomecânica | Vídeo, pose, identidade e benchmark | Engine real, qualidade, overlays e comparação | Playback e contratos |
| Media / interação | Player, timeline, edição, exportação e acabamento | Fluxo de vídeo real em desktop/iPhone | Base reconciliada |
| Reviewer | Revisão independente de claims, regras e comportamento | Defeitos reproduzíveis e resultado dos gates | Cada entrega integrada |

Game Director e Tennis Coach devem trabalhar em paralelo desde o início. Percepção pode rodar em paralelo com scoring após acertar schemas. O integrador mantém poucos worktrees/branches nomeados; cada agente recebe arquivos próprios, invariantes e critérios de aceite. Não permitir que vários agentes redesenhem a aplicação inteira.

## Quadro de tarefas proposto

As linhas são unidades de trabalho prontas para virar GitHub issues se o executor precisar; não representam issues já abertas.

| ID | Tarefa | Dono | Depende de | Aceite |
| --- | --- | --- | --- | --- |
| C01 | Auditar main e PR #1; escolher base e plano de reuso | Lead | — | Commit/base e diferenças registrados; sem merge cego |
| C02 | Definir schemas de evidência, evento e ação | Lead + especialistas | C01 | Validação, versionamento e demo/inferred/confirmed/rejected |
| C03 | Entregar import/playback/slow/loop e seleção de jogador | Media | C01 | Um arquivo real navegável no celular e desktop |
| C04 | Persistir sessão/anotações e relink/import/export | Media | C02,C03 | Reabrir recupera dados; mídia faltante explícita |
| C05 | Implementar regras e estatísticas de tênis | Game Director | C02 | Vetores de pontuação, lacunas e correções passam |
| C06 | Conquistas e ledger de XP | Game Director | C05 | Reprocessamento idempotente e badge corrigível |
| C07 | Coleção de conhecimento + rubrica de treinador | Tennis Coach | C02 | Fontes primárias, aplicabilidade e abstenção descritas |
| C08 | Integrar pose real, tracking e qualidade | Percepção | C02,C03 | Corpo real; timestamps/identidade corretos; sem fallback falso |
| C09 | Coach com cues, drills e prova visível | Tennis Coach | C07,C08 | Acerto/correção sustentados ou abstenção; um próximo passo |
| C10 | Visualização 2D/3D estimada e comparação | Percepção + Media | C08 | Mesma fase/atleta; estimativa claramente identificada |
| C11 | Adapter Jev e composição validada | Lead | C02,C09 | Ações reais, stale/timeout/schema tratados; fallback honesto |
| C12 | Corte de um clique e arquivo exportado | Media | C03,C04 | Arquivo reproduzível no iPhone; áudio/duração conferidos |
| C13 | Badges sincronizados + loop de treino | Lead + Game Director | C06,C09,C11 | Ver → aprender → treinar → comparar sem XP artificial |
| C14 | Benchmark, revisão técnica e iPhone físico | Reviewer | C08–C13 | Matriz documentada; métricas reais, falhas e não executados |

## Critério de conclusão do primeiro incremento

- [ ] Vídeo real entra, reproduz, desacelera e navega por acontecimentos.
- [ ] Usuário escolhe seu jogador e consegue corrigir a seleção.
- [ ] Um ponto confirmado produz placar correto e recompensa rastreável.
- [ ] Uma observação técnica tem evidência temporal e fonte aplicável, ou o agente se abstém.
- [ ] Corpo/medidas provêm de engine real; 3D monocular é identificado como estimado.
- [ ] Agente opera pelo mesmo catálogo de ações da interface.
- [ ] Corte gera um vídeo conferido, além de salvar a composição/intervalo quando útil.
- [ ] Sessão sobrevive a reabertura sem misturar demonstração com dados reais.
- [ ] O fluxo principal foi verificado e há registro preciso das limitações de device/modelo.
- [ ] PR referencia commit, decisões, evidências e próximo bloqueio concreto.

## Política de execução

Executar em rodadas de implementação, teste útil, revisão e correção. Fazer escolhas reversíveis autonomamente. Não parar a cada decisão visual/técnica; perguntar apenas quando faltar uma decisão do usuário que realmente altere o objetivo ou uma autorização necessária.

Não refazer o plano a cada rodada. Não alterar auth/navegação do app principal, fundir PRs existentes, trocar backend ou criar outra organização/repositório sem necessidade. Reconciliar dependências/contratos primeiro. Não publicar em GPT Sites.

Se uma integração externa estiver bloqueada, isolar o adaptador, manter fallback identificado, completar trabalho independente e declarar exatamente o que falta. Não substituir análise real por fixtures silenciosas para declarar a tarefa concluída.

Final de cada rodada: atualizar um registro único com estado, commit, decisões e evidências. Nada de múltiplos documentos conflitantes chamados final/final2. O plano nesta pasta é a entrada; o registro de execução demonstra o que se tornou realidade.
