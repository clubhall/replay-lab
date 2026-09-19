# Game Director: regras, estatísticas e recompensas

## Princípio

O placar é um cálculo determinístico a partir de eventos revisáveis. Visão computacional propõe acontecimentos; confirmação humana ou um fluxo automático validado pode confirmá-los. Uma ação do player, como rever um ponto, não significa que outro ponto aconteceu.

Fonte de regras: [ITF Rules of Tennis 2026](https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf). Os formatos alternativos devem ser configuração explícita da sessão, não inferidos pelo modelo.

## Primeiro formato implementado

Tênis simples, melhor de três sets, games com vantagem, set até seis games com diferença de dois e tie-break em 6–6 até sete pontos com diferença de dois. Extensões separadas: no-ad, tie-break de dez e match tie-break em substituição ao set decisivo. O schema pode prever formatos; só expor os implementados/testados. Duplas e regras de competições específicas ficam fora do primeiro incremento.

No tie-break: primeiro sacador serve um ponto, o outro dois, depois blocos de dois. O jogador que recebeu o primeiro ponto do tie-break saca no game inicial do set seguinte. Um match tie-break guarda seu resultado em pontos, não um set fictício de games.

Let não concede ponto. Dupla falta exige evidência do segundo serviço faltoso; um erro no saque não é automaticamente dupla falta. Resultado desconhecido permanece desconhecido.

## Eventos e correções

Contrato conceitual a reconciliar com o domínio existente:

```ts
type PointRevision = {
  eventId: string; pointId: string; sessionId: string;
  revision: number; ordinal: number;
  status: 'demo'|'inferred'|'confirmed'|'rejected';
  winner?: 'player'|'opponent'; server?: 'player'|'opponent';
  outcome?: 'ace'|'winner'|'forced-error'|'unforced-error'|'double-fault'|'unknown';
  stroke?: 'serve'|'forehand'|'backhand'|'volley'|'overhead'|'unknown';
  startMs: number; endMs: number; evidenceIds: string[];
  rallyContacts?: number; firstServeIn?: boolean; serveNumber?: 1|2;
  confirmedBy?: string; methodVersion: string;
};
```

Aplicar a última revisão válida por pointId e reconstruir derivados. Event IDs/revisions duplicados são idempotentes. Uma correção mantém histórico e invalida recompensas ligadas à evidência anterior. Evento demo não pode virar ponto real apenas mudando o filtro da UI.

O placar exige sequência completa desde o início ou um checkpoint manual explícito com provenance. Ao encontrar ordinal faltante/não confirmado, marcar o placar acumulado como incompleto; clips posteriores podem contribuir para estatísticas locais identificadas, mas não fabricar o resultado integral da partida.

## Estatísticas úteis e honestas

| Métrica | Numerador / denominador | Quando não exibir |
| --- | --- | --- |
| Pontos ganhos | Pontos confirmados ganhos / pontos confirmados observados | Sem pontos; indicar cobertura parcial |
| Primeiro saque em quadra | Primeiros serviços dentro / primeiros serviços observados com resultado conhecido | Resultado do primeiro serviço desconhecido |
| Pontos ganhos no primeiro saque | Pontos ganhos após primeiro saque válido / pontos com primeiro saque válido e vencedor conhecido | Falta tipo/resultado do saque |
| Pontos ganhos no segundo saque | Pontos ganhos no segundo saque / pontos conhecidos que chegaram ao segundo saque, incluindo dupla falta | Falta registro do contexto de serviço |
| Winners e erros | Contagem de eventos classificados e confirmados | Desfecho desconhecido não vira erro |
| Break points convertidos | Chances confirmadas convertidas / chances confirmadas de quebra | Estado anterior do placar incompleto |
| Rally mais longo | Máximo de contatos confirmados no rally | Contatos não anotados/rastreados |
| Distribuição de golpes | Golpes classificados / golpes observados classificados | Vídeo não permite classificar |

Exibir número de amostras e cobertura, com `—` para indisponível. Zero significa observação de ausência; não é substituto de dado faltante. Forced/unforced error é julgamento contextual e precisa revisão. Tempo em quadra pode ser duração anotada; não é intensidade, gasto calórico nem VO2.

## Conquistas propostas

Valores iniciais são design ajustável, não avaliação científica. XP recompensa atividade/objetivos verificáveis; não altera um rating competitivo oficial.

| Badge | Critério | Prova | Recompensa proposta |
| --- | --- | --- | --- |
| Primeiro replay | Rever e salvar o primeiro momento próprio | Ação de revisão salva; uma vez por atleta | 25 XP |
| Ponto construído | Rally com pelo menos oito contatos confirmados | Evento de rally; uma vez por ponto | 40 XP |
| Saque decisivo | Primeiro ace confirmado na sessão | Serviço válido sem toque, vencedor e revisão | 50 XP |
| Sob pressão | Vencer ponto de break contra si | Estado completo anterior + vencedor | 50 XP |
| Evolução em foco | Completar drill e comparar duas tentativas válidas | Missão concluída + comparação salva | 60 XP; não significa melhora automática |

“Winner” pode ser medalha de acontecimento além de badge persistente. Não premiar velocidade, spin ou “biomecânica perfeita” sem medida validada. Perks são preferências/recursos úteis de treino — uma rotina de revisão, um preset de comparação, um desafio — não bônus fictícios em força, velocidade ou capacidades corporais. Ferramentas essenciais de análise não devem ficar bloqueadas por XP.

## Ledger e apresentação

Chave de recompensa proposta: `(sessionId, ruleId, ruleVersion, evidenceId)`, com revisão/supersession e regra de uma vez por atleta quando aplicável. Refazer cálculo remove elegibilidade indevida sem duplicar crédito. O histórico distingue confirmação de evento, concessão e revogação.

Durante playback, um badge pode aparecer novamente como apresentação do acontecimento, mas a UI não anuncia novo XP já creditado. Seek reverso e loop não pagam de novo. Evento inferido pode mostrar proposta; só confirmação/critério satisfeito concede performance reward.

## Vetores mínimos de teste

| Caso | Entrada resumida | Esperado |
| --- | --- | --- |
| Game direto | A,A,A,A | A ganha um game; pontos resetam; sacador alterna |
| Deuce | A,A,A,B,B,B,A,B | 40–40 novamente, nenhum game concedido |
| Vantagem | Deuce + A,A | Game A |
| No-ad | Deuce + A com no-ad ativo | Game A |
| Set estendido | Games 5–5 → A → A | Set 7–5 |
| Tie-break | Games 6–6; pontos 6–6 → A → A | Set 7–6; tie-break 8–6 |
| Ordem de saque TB | Primeiro sacador A | A, B, B, A, A, B, B… |
| Fim de partida | Melhor de três; A ganha segundo set | Partida encerrada; ponto extra rejeitado |
| Ponto faltante | Ordinais 1,2,4 confirmados | Placar completo só até 2; lacuna explícita |
| Correção | Ponto 2 A → revisão B | Placar e badges recalculados; histórico preservado |
| Duplicação | Mesmo eventId/revision duas vezes | Nenhum novo ponto ou XP |
| Rejeição | Evidência de ace rejeitada | Badge/estatística correspondentes revogados |
| Replay | Rever/loop/seek mesmo ponto | Saldo XP inalterado |
| Demo | Eventos demo junto a sessão real | Nunca contam para pontuação/progressão real |

Adicione testes para checkpoint, saque/dupla falta, match tie-break, validação de schemas e denominadores desconhecidos. Um teste deve verificar regra/invariante do esporte, não apenas espelhar a implementação.
