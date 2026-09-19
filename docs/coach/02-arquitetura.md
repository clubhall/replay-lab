# Arquitetura proposta: percepção, evidência e ação

## Responsabilidades

| Camada | Responsabilidade | Não deve fazer |
| --- | --- | --- |
| Media runtime | Decode, timestamps, seek, playback, proxy e exportação | Alterar o original ou perder relação temporal |
| Percepção | Identidade do jogador, pose, bola/raquete quando disponíveis | Inventar estatísticas ou usar skeleton ilustrativo como medição |
| Evidence store | Proveniência, resultados por frame, confiança, versões, revisões | Misturar inferência com confirmação |
| Sports domain | Regras, eventos, placar, métricas e validação | Transferir a autoridade do placar a um LLM |
| Coach | Conhecimento esportivo, contexto pessoal, interpretação e treino | Diagnosticar ou afirmar o que a imagem não permite ver |
| Jev decision adapter | Escolher entre próximas ações e componentes permitidos | Detectar articulações a partir de texto ou criar código arbitrário |
| Composition/runtime | Executar ações validadas e renderizar UI conhecida | Aplicar respostas obsoletas ou sobrescrever edições explícitas |
| Reward ledger | Calcular conquistas e XP versionados | Pagar novamente a mesma evidência |

O agente especialista é o sistema completo; Jev é uma peça de decisão. Um modelo multimodal pode ajudar a descrever contexto, mas não substitui medidas validadas nem um detector de bola.

## Reuso verificável

- `packages/analysis-contracts/src/index.ts`: `EngineRequest`, `EngineOutput`, export/import, tracks, poseFrames, insights e engineRuns.
- `packages/video-domain`: tipos de domínio a inspecionar antes de criar novos schemas.
- `packages/engine-pose-abstraction`: substituir/isolar fallback geométrico para que não emita evidência biomecânica.
- `apps/replay-web`: playback e timeline existentes.
- PR #1 `codex/replay-ios`: comparar importação, persistência, trim e compartilhamento antes de duplicar implementação.
- Jev: [decision-core.mjs, commit 6465a051](https://github.com/accollier/made-for-me/blob/6465a051ce0274886f186fdfedba016bd9fa8b42/server/decision-core.mjs). Preservar atribuição/licença aplicável e adaptar contratos explicitamente.

## Contratos a implementar e validar

Estes nomes são propostas; mapear para schemas existentes antes de adicionar versões.

```ts
type EvidenceState = 'demo' | 'inferred' | 'confirmed' | 'rejected';
type EvidenceRef = {
  id: string; sessionId: string; assetId: string; assetFingerprint: string;
  startMs: number; endMs: number; playerTrackId?: string;
  source: 'manual' | 'pose' | 'ball' | 'racket' | 'audio' | 'import';
  state: EvidenceState; methodVersion: string; runId?: string;
  confidence?: number; missingEvidence: string[]; revision: number;
};
type CoachObservation = {
  id: string; evidenceIds: string[]; stroke: string; phase?: string;
  observation: string; interpretation?: string; uncertainty: string;
  strength?: string; cue?: string; drillId?: string; sourceIds: string[];
  proposedActions: CoachAction[];
};
type CoachAction =
  | {type:'seek'; timestampMs:number}
  | {type:'slow'; rate:0.25|0.5|1}
  | {type:'loop'; startMs:number; endMs:number}
  | {type:'show_pose'; mode:'2d'|'estimated-3d'}
  | {type:'compare'; leftEvidenceId:string; rightEvidenceId:string}
  | {type:'propose_clip'; startMs:number; endMs:number}
  | {type:'request_confirmation'; eventId:string}
  | {type:'offer_drill'; drillId:string};
```

Validar intervalos contra duração do asset, ownership/session, identidade do jogador e evidências existentes. `confidence` do detector não é confiança clínica, nem percentual de correção técnica. Clips cortados precisam preservar offset do original. Export/import mantém proveniência e solicita relink quando faltar mídia.

## Estado do runtime

Estados claros: `empty → media-ready → selecting-player → analyzing → review-ready`, com ramificações `needs-evidence`, `cancelled`, `failed` e `exporting`.

Cada análise recebe `requestId`, `sessionId`, `assetFingerprint`, `playerTrackId`, `revision` e intervalo. Troca de vídeo/jogador ou seek invalida desenhos/decisões incompatíveis. O worker devolve o timestamp de origem. Nada deve ser desenhado sobre um frame diferente apenas porque foi a última resposta recebida.

Persistir resultados e eventos como dados da sessão. Uma reanálise cria uma versão/rastreabilidade; não duplica insights ou redefine pontos confirmados silenciosamente. Agentes e UI usam as mesmas funções de domínio.

## Adaptação Jev

API documentada: `POST https://api.typesafe.ai/v1/systemone`, bearer somente no servidor, modelo configurável (`jev-latest` no protótipo existente). Tipos `choice`, `noul`, `score`. [Quick start oficial](https://docs.typesafe.ai/introduction/quickstart).

Enviar estado resumido e evidências relevantes; não enviar o vídeo bruto a esse endpoint de decisão. Exemplo de escolhas: `review_contact`, `compare_repetitions`, `confirm_point`, `offer_drill`, `request_better_view`. Separar decisão de narração: resposta tipada escolhe o caminho; coach/evidência fornece o conteúdo.

Reutilizar a disciplina existente: request/revision, cancelamento, allowlist, validação de probabilidades e fallback. O deadline de 900 ms e confiança de 0,58 são parâmetros herdados do protótipo, a medir/calibrar para este caso; não são garantia de latência ou qualidade. Mostrar `source: local | jev` em diagnósticos e responder honestamente quando não houver chave. Nunca bloquear playback aguardando Jev.

Credenciais ausentes: documentar a variável necessária e seguir com fallback testável. Não pedir que o usuário cole secrets no chat, não colocar chaves no cliente/Git. A configuração autenticada será validada no ambiente de execução apropriado.

## Mídia e análise

Browser MVP: Blob/stream/proxy, MediaPipe worker e progressão assíncrona. GPU com fallback CPU se suportado. `IMAGE` para frames independentes/seek; `VIDEO` com timestamps crescentes para varredura. Política inicial de amostragem deve ser medida; contato precisa de revisão mais fina, não interpolação tratada como observação.

Servidor: jobs canceláveis, IDs idempotentes, upload em partes quando necessário, retry com limites, armazenamento do original e derivados separados. Reaproveitar FastAPI existente para engines; não enfiar decode de horas de vídeo no request de composição Jev.

Exportação: avaliar FFmpeg nativo/servidor para render determinístico; caminho browser somente após comprovar codecs/memória/Safari. Stream-copy pode cortar em keyframes; cortes exatos podem requerer reencode. A UI precisa descrever o resultado real. HyperFrames pode ser um renderer/adaptador de composição, sujeito a validação; composição JSON não é um MP4.

## Generalização futura

Criar um `SportAdapter` com regras, taxonomia de movimentos/fases, métricas, drills e conhecimento. Tênis é a primeira implementação completa. Infraestrutura de mídia, evidência e ações é compartilhada. Não adicionar abstrações para vários esportes antes de o ciclo de tênis funcionar.
