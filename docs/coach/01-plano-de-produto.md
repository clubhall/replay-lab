# Produto e plano por etapas

## Experiência desejada

Replay é a memória e inteligência esportiva do ClubHall; Live captura o jogo; o app principal coordena participantes, experiências e permissões. O coach deve poder existir como app separado, com fronteiras claras, mantendo futura integração com a sessão ClubHall.

Jornada: **meu vídeo → minha partida → um momento → uma observação → uma missão de treino → uma nova tentativa → evolução comprovada**.

A referência de COD está na clareza dos acontecimentos, estatísticas, progresso e recompensas. Não implica copiar combate, criar pontuações arbitrárias de saúde ou transformar todo segundo em uma notificação.

### Interações fundamentais

| Momento | O atleta faz | O agente faz | Evidência necessária |
| --- | --- | --- | --- |
| Entrar | Importa vídeo/abre sessão | Verifica duração, codec, orientação e possibilidades de análise | Arquivo real e metadata |
| Escolher | Indica jogador, mão dominante, golpe e objetivo | Mantém identidade do jogador e propõe uma revisão curta | Seleção explícita; identidade rastreada |
| Rever | Toca um acontecimento ou arrasta a timeline | Abre o instante correspondente, preserva contexto | Timestamps do vídeo original |
| Pontuar | Confirma quem venceu e, se conhecido, como | Atualiza regras, estatísticas e recompensas | Evento confirmado e revisável |
| Entender | Pede “o que eu poderia fazer melhor?” | Mostra evidência, uma interpretação e uma ação | Frame/intervalo + fonte técnica + incerteza |
| Comparar | Escolhe duas tentativas | Alinha fases comparáveis e indica limitações da câmera | Mesmo jogador, golpe, contexto e referências temporais |
| Guardar | Salva ou corta um momento | Produz clipe reproduzível ou informa que apenas o projeto foi salvo | Arquivo exportado e conferido |
| Voltar | Abre a sessão em outro momento | Recupera anotações, progresso e media relink quando necessário | Persistência verificada |

## Direção visual e comportamento

- Vídeo é a superfície principal. Evitar dashboard genérico, landing page, chatbot que monopoliza a tela e navegação pesada.
- iPhone primeiro; desktop expande vídeo, timeline e comparação. No celular, alcance do polegar, leitura e vídeo livre de obstruções têm prioridade.
- Preto profundo, ouro champagne/Cybercab e materiais suaves; usar as referências fornecidas. Brilho concentra atenção em ações e conquistas, não cobre tudo.
- A arena/companheiro possui um plano espacial próprio, distinto da superfície do vídeo, e continuidade de presença. Preservar geometria aprovada quando o asset estiver disponível; não reinventar como anel ou estádio genérico.
- Um insight principal por vez; abrir detalhes progressivamente. A interface muda com a intenção e com o momento da partida.
- Controles: tocar para reproduzir/pausar, anterior/próximo acontecimento, velocidade, loop, seleção de trecho, overlays, comparar, guardar/exportar.
- Feedback sonoro e voz são opcionais, interrompíveis e discretos. Pausar/voltar nunca dispara novas recompensas permanentes.
- Badges entram no timestamp relevante durante o replay. Após análise offline, exibi-los em sincronia não significa análise ao vivo.
- Demonstrar “o agente jogando como eu” como **revisão tática e alternativa explicada**: o que observou, qual opção propõe e por quê. Não simular um resultado inevitável ou inventar o movimento que o vídeo não registrou.

## Escopo de execução

### R0 — Reconciliar a base e definir contratos

Auditar main, PR #1 `codex/replay-ios`, contratos de análise e branch Jev. Registrar o commit de trabalho e o motivo da base escolhida. Proposta: preservar o app web existente e criar um entrypoint/módulo coach isolado; usar `apps/replay-coach` apenas se a separação exigir um workspace. Reutilizar pacotes; não copiar o monorepo inteiro. Não fundir PRs abertos automaticamente.

Saída: fluxo mínimo desenhado em código/contratos, mapa dos arquivos e comando reproduzível. A fase termina com decisões pequenas suficientes para implementação, não com mais um planejamento amplo.

### R1 — Uma partida utilizável com vídeo real

Importar/abrir, selecionar jogador, reproduzir, seek, 0,25×/0,5×/1×, quadro próximo disponível, loop A/B e marcos manuais. Anotações e estado devem sobreviver a reabertura. Manter vídeo grande fora de JSON/ArrayBuffer integral; se o modo for local, explicitar limites de armazenamento/relink. Se houver upload remoto, implementar progresso, cancelamento, retomada e acesso por sessão; não presumir que um POST de 5 GB funcionará.

Saída: um atleta consegue rever sua partida sem análise automática. Clips de demonstração têm identificação permanente.

### R2 — Corpo observado e coach fundamentado

Implementar pose real com worker, seleção de jogador, alinhamento exato com vídeo, qualidade e invalidação de resultados obsoletos. Exibir 2D e, quando disponível, “3D estimado de uma câmera”. Estruturar observação → evidência → hipótese → cue → drill → comparação. Começar por forehand, backhand e saque em clips curtos; bola, raquete e contexto tático são capacidades independentes.

Saída: primeira análise rastreável de clip real, com recusas quando a câmera não permite avaliar. Análise em segundo plano deixa playback responsivo.

### R3 — Partida como gameplay

Integrar eventos confirmados ao placar, estatísticas com denominador e badges determinísticos. Adicionar missões de treino individualizadas e progressão por evidência. Correções reconstroem placar e recompensas; rever o mesmo ponto não multiplica XP.

Saída: loop completo de vídeo → ponto → placar → conquista → treino. Sem esperar classificação perfeita de todos os eventos.

### R4 — Jev e edição operando o app

Adaptar o padrão Jev já existente: decisões tipadas, ações permitidas, request/revision, deadline e fallback. O agente pode abrir, desacelerar, repetir, comparar e preparar um corte. Exportar um arquivo de vídeo real; salvar JSON ou composição HyperFrames é um resultado diferente. Confirmar duração, codec, áudio e reprodução do arquivo exportado no iPhone.

Saída: uma revisão comandada em linguagem natural chega a uma ação real, preservando edições explícitas do usuário. Dependências de credenciais não bloqueiam o resto do fluxo.

### R5 — Evidência de qualidade e melhoria

Comparar engines em clips reais, calibrar confiança/abstenção, revisão por treinador humano qualificado, ensaiar falhas e iPhone físico. Aplicar refinamento visual sobre o fluxo funcional. Relatar o que funcionou e o que não funcionou com commit e evidência.

Saída: release candidate identificável no fluxo de deploy do repositório, sem publicação em GPT Sites. Não anunciar automaticamente TestFlight, precisão biomecânica ou inferência em tempo real.

## Prioridade para os vídeos da próxima sessão

Obrigatório: importar, navegar, desacelerar, marcar, explicar com evidência, salvar e exportar um trecho. Alvo seguinte: pose real e comparações úteis em clips curtos. Dependente de benchmark: rastreamento de bola/raquete, placar totalmente automático e reconstrução 3D quantitativa.

Esta sequência não é uma promessa de que todos os níveis de análise estarão prontos em uma data arbitrária. O agente deve entregar o máximo executável e validado, sem interromper toda a frente por uma dependência externa.
