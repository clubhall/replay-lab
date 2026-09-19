# Validação: provar que o coach ajuda

## Primeiros vídeos de Arthur

Proposta para a próxima sessão: três clips de 15–30 segundos — forehand, backhand e saque — mais um trecho de partida para placar/contexto. Câmera fixa em paisagem, corpo/pés/raquete inteiros, boa luz, preferencialmente 1080p/60 fps. Uma vista lateral ajuda a primeira revisão técnica; o enquadramento de quadra inteira atende outra necessidade. Preservar originais. Se o navegador não decodificar o arquivo, criar uma cópia H.264 MP4 e manter ligação ao original.

120 fps pode ajudar movimentos rápidos quando a câmera/luz permitem; não garante localização exata de contato. Duas vistas ajudam estudos futuros, mas triangulação exige sincronização/calibração.

Até receber esses vídeos, trabalhar com fixtures identificadas e clips autorizados/licenciados. Não alegar validação no corpo de Arthur. Não versionar seus vídeos privados no GitHub por padrão.

## Dataset mínimo de avaliação

Proposta inicial: 30–50 clips curtos, distribuídos por forehand/backhand/saque e casos difíceis; ampliar apenas se o risco exigir. Separar por atleta/sessão entre calibração e teste para evitar vazamento. Incluir canhoto, dois jogadores, roupas parecidas, oclusão, câmera lateral/frontal, pouca luz, corpo cortado, corte de câmera e nenhum atleta. Registrar licença/consentimento, origem, taxa de frames e codec.

Anotações humanas: jogador, fases, contatos quando visíveis, desfecho de pontos quando conhecido, observações técnicas sustentadas e situações em que o sistema deve se abster. Um treinador qualificado deve adjudicar divergências técnicas; registrar desacordo em vez de impor precisão inexistente.

## Matriz de testes

| Área | Caso de teste | Critério |
| --- | --- | --- |
| Playback | Importar, seek reverso, pause, slow, A/B, fim do vídeo | Sem perda de estado; nada desenhado no timestamp errado |
| Vídeo grande | Arquivo representativo longo/5 GB e cancelamento | Sem leitura integral em memória; UI responsiva; limites documentados |
| Identidade | Dois jogadores trocam de posição | Não atribuir corpo/feedback ao atleta errado; interromper se incerto |
| Pose | Oclusão e membros fora de quadro | Medidas indisponíveis; sem skeleton sintético apresentado como detecção |
| Geometria | Vídeo retrato, landscape, rotação, letterbox | Joints alinham ao frame correto; ângulos usam dimensões da origem |
| 3D | Rotacionar representação monocular | Rótulo de estimativa; sem forças, escala ou anatomia inventadas |
| Coach | Evidência ausente/contraditória | Abstenção ou pergunta útil; não inventar erro técnico |
| Coach | Evidência de acerto | Reconhece força específica com timestamp |
| Placar | Deuce, vantagem, tie-break, correção e ponto ausente | Exato segundo regras/configuração; lacuna fica explícita |
| Recompensa | Rever, reenviar, reanalisar e desfazer | Idempotência; recompensa inválida é revogada/recalculada |
| Jev | Chave ausente, timeout, schema inválido, resposta antiga | Fallback identificado; playback continua; edição explícita preservada |
| Edição | Cortar e exportar vídeo com áudio | Novo arquivo reproduzível, duração correta, áudio sincronizado |
| Persistência | Fechar/reabrir e relink | Sessão e eventos íntegros; mídia ausente não aparece como salva |
| Mobile | Safari/iPhone físico e acesso por toque | Controles usáveis, orientação e download/share verificados |

## Métricas separadas

- Percepção: erro dos landmarks onde há referência, cobertura válida, identity switches, erro temporal de eventos e falhas por câmera/condição.
- Coach: precisão das evidências citadas; observações não sustentadas; adequação técnica julgada por treinador; ações úteis; qualidade de abstenção.
- Gameplay: exatidão do placar, duplicação de XP, correções, tempo para abrir o ponto e encontrar o próximo exercício.
- Sistema: tempo até playback, tempo de análise por minuto, p50/p95 de decisão, frames perdidos, memória/pico, falhas/custo por minuto.
- Produto: atleta compreende a orientação, executa o drill e consegue comparar uma nova tentativa. Melhora de performance precisa de avaliação longitudinal; não inferir do XP.

Gate estrutural obrigatório: zero afirmações factuais sem evidence IDs; placar exato nos vetores determinísticos; zero XP duplicado; nenhuma mistura de demo com histórico real. Precisão técnica/latência recebem metas numéricas após baseline e medição, documentadas antes de declarar sucesso. Não usar confiança autoatribuída pelo modelo como avaliação independente.

## Relatório de execução

Cada rodada registra: commit, dados usados, versão de modelos, configuração/hardware, comandos, testes executados, falhas, screenshots/recording e limitações. Identificar claramente **passou**, **falhou**, **não executado**. Benchmark com todos os clips `skipped` é um teste não realizado.

Seguir `CONTRIBUTING.md`: lint, typecheck e testes relevantes; Python quando o serviço for alterado. Para este PR de documentos, validar links locais, consistência dos contratos/nomes, referências e diff; não apresentar testes de produto não executados como aprovados.
