import type { CoachDrill, CoachKnowledgeSource } from "./types";

export const KNOWLEDGE_VERSION = "tennis-primary-sources/2026-09-19.1";

/** Small reviewed collection. No scraping, embeddings, or athlete data are needed. */
export const coachKnowledge: readonly CoachKnowledgeSource[] = [
  {
    sourceId: "usta-school-team-manual",
    url: "https://www.usta.com/es/content/dam/usta/sections/southern/pdf/net-generation-high-school-team-tennis-manual.pdf",
    title: "Net Generation School Team Tennis Manual",
    authors: ["USTA School Tennis"],
    organization: "United States Tennis Association",
    publicationYear: null,
    accessedOn: "2026-09-19",
    paraphrase:
      "O currículo organiza golpes em preparação, contato e finalização. Propõe progressões cooperativas, começando com tarefas simples e adaptadas à experiência do jogador.",
    populationAndTask:
      "Equipes escolares de ensino fundamental e médio; aprendizagem de golpes e sessões de treino.",
    evidenceType: "federation-coaching-curriculum",
    evidenceStrength:
      "Orientação pedagógica de federação; não é validação experimental deste coach ou de limiares de pose.",
    restrictions: [
      "Aplicabilidade a adultos deve ser revista com o atleta.",
      "Não estabelece intervalo ideal entre preparação e contato.",
      "O exercício ClubHall é uma adaptação autoral, não uma reprodução do manual.",
    ],
    concepts: [
      "forehand",
      "backhand",
      "preparation",
      "contact",
      "cooperative-rally",
    ],
  },
  {
    sourceId: "usta-serve-basics-2017",
    url: "https://www.usta.com/en/home/improve/tips-and-instruction/national/learning-the-basics--serve.html",
    title: "Tennis 101: Perfecting the Serve",
    authors: ["Elliott Pettit"],
    organization: "United States Tennis Association",
    publicationYear: 2017,
    accessedOn: "2026-09-19",
    paraphrase:
      "O material sugere praticar o lançamento da bola separadamente e adaptar a complexidade do movimento à experiência do jogador.",
    populationAndTask:
      "Jogadores iniciantes, intermediários e avançados; aprendizagem do saque.",
    evidenceType: "federation-coaching-advice",
    evidenceStrength:
      "Conselho técnico de treinador; não define parâmetros quantitativos nem valida inferências automáticas.",
    restrictions: [
      "A pose corporal não localiza a bola nem confirma o contato.",
      "Não usar este material para inferir spin, velocidade, lesão ou um ângulo universal.",
      "Fonte disponível para revisão; o rubric inicial não emite instrução de saque.",
    ],
    concepts: ["serve", "toss", "contact"],
  },
  {
    sourceId: "mediapipe-pose-web",
    url: "https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js",
    title: "Pose landmark detection guide for Web",
    authors: ["Google AI Edge"],
    organization: "Google",
    publicationYear: null,
    accessedOn: "2026-09-19",
    paraphrase:
      "Pose Landmarker devolve landmarks de imagem e coordenadas mundiais estimadas. As chamadas de detecção são síncronas; workers evitam bloquear a interface.",
    populationAndTask:
      "Detecção computacional de pose humana em imagens e vídeo; documentação de API web.",
    evidenceType: "model-documentation",
    evidenceStrength:
      "Documentação primária do comportamento da API; não é benchmark de precisão em tênis.",
    restrictions: [
      "Visibilidade de joint não é confiança da interpretação técnica.",
      "Uma câmera não fornece captura multicâmera calibrada.",
      "Landmarks não confirmam identidade, contato, forças ou risco de lesão.",
    ],
    concepts: ["pose", "visibility", "estimated-3d", "worker"],
  },
];

export const preparationDrill: CoachDrill = {
  id: "cooperative-preparation-review-v1",
  title: "Repetir e comparar a preparação",
  instructions:
    "Com um parceiro, faça uma pequena sequência cooperativa do golpe escolhido em ritmo confortável. Filme da mesma posição e marque preparação e contato nas tentativas que estiverem visíveis.",
  objective:
    "Conseguir revisar a sequência preparação–contato no próprio golpe, sem buscar um intervalo universal.",
  comparison:
    "Compare duas tentativas do mesmo atleta com câmera equivalente. Registre a percepção do atleta e mantenha, ajuste ou retire o cue com revisão humana.",
  origin: "clubhall-authored-adaptation",
  sourceIds: ["usta-school-team-manual"],
};
