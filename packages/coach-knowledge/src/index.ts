import { KNOWLEDGE_VERSION, preparationDrill } from "./knowledge";
import type {
  CoachAbstentionReason,
  CoachAction,
  CoachIdentity,
  CoachInput,
  CoachPoseFrame,
  CoachResult,
} from "./types";

export * from "./types";
export * from "./knowledge";

export const RUBRIC_VERSION = "tennis-evidence-rubric/1";
/** Conservative engineering gates, not scientifically established tennis thresholds. */
export const COACH_QUALITY_GATES = Object.freeze({
  jointVisibility: 0.8,
  personHeightPx: 180,
  validFraction: 0.8,
  minimumSamples: 5,
  maximumGapMs: 250,
});

const requiredJoints = [
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];
const nonempty = (value: string) =>
  typeof value === "string" && value.trim().length > 0;
const finite = (value: number) => Number.isFinite(value);

function matchesIdentity(input: CoachInput, evidence: CoachIdentity): boolean {
  return (
    evidence.sessionId === input.sessionId &&
    evidence.assetId === input.assetId &&
    evidence.assetFingerprint === input.assetFingerprint &&
    evidence.athleteId === input.athlete.id &&
    evidence.playerTrackId === input.athlete.playerTrackId
  );
}

function validFrame(frame: CoachPoseFrame): boolean {
  return requiredJoints.every((name) => {
    const matches = frame.keypoints.filter((point) => point.name === name);
    if (matches.length !== 1) return false;
    const point = matches[0];
    return (
      finite(point.x) &&
      finite(point.y) &&
      point.x > 0 &&
      point.x < 1 &&
      point.y > 0 &&
      point.y < 1 &&
      typeof point.visibility === "number" &&
      finite(point.visibility) &&
      point.visibility >= COACH_QUALITY_GATES.jointVisibility &&
      point.visibility <= 1
    );
  });
}

/** Pure and deterministic. Labels and pose remain separate evidence sources. */
export function evaluateCoach(input: CoachInput): CoachResult {
  const base = {
    requestId: input.requestId,
    revision: input.revision,
    rubricVersion: RUBRIC_VERSION,
    knowledgeVersion: KNOWLEDGE_VERSION,
  };
  const abstain = (
    reason: CoachAbstentionReason,
    message: string,
    missingEvidence: string[],
    actions: CoachAction[] = [],
  ): CoachResult => ({
    ...base,
    status: "abstained",
    reason,
    message,
    missingEvidence,
    actions,
  });
  if (
    ![
      input.requestId,
      input.sessionId,
      input.assetId,
      input.assetFingerprint,
      input.athlete.id,
      input.athlete.playerTrackId,
    ].every(nonempty) ||
    !Number.isInteger(input.revision) ||
    input.revision < 0 ||
    ![input.durationMs, input.startMs, input.endMs].every(finite) ||
    input.durationMs <= 0 ||
    input.startMs < 0 ||
    input.startMs >= input.endMs ||
    input.endMs > input.durationMs
  ) {
    return abstain(
      "invalid_context",
      "Selecione atleta, vídeo e intervalo válidos antes da revisão.",
      ["contexto e intervalo válidos"],
    );
  }
  const pose = input.pose;
  if (!pose)
    return abstain(
      "missing_pose",
      "Ainda não há evidência corporal real para orientar este golpe.",
      ["pose real do atleta selecionado"],
    );
  if (
    pose.kind !== "model" ||
    (pose.state !== "inferred" && pose.state !== "confirmed") ||
    /box|bbox|fallback|demo|synthetic|geometric/i.test(pose.provider) ||
    ![pose.id, pose.provider, pose.modelVersion, pose.runId].every(nonempty)
  ) {
    return abstain(
      "non_body_evidence",
      "Caixas de detecção e demonstrações não sustentam uma análise corporal.",
      ["inferência de pose com modelo e execução identificados"],
    );
  }
  if (!matchesIdentity(input, pose) || !pose.identityVerified) {
    return abstain(
      "identity_mismatch",
      "A identidade do atleta não está confirmada nesta evidência.",
      ["mesmo atleta, track, sessão e vídeo"],
    );
  }
  if (pose.revision !== input.revision)
    return abstain(
      "stale_revision",
      "A análise pertence a uma revisão anterior. Analise novamente.",
      ["evidência da revisão atual"],
    );
  const frames = pose.frames;
  if (
    frames.some(
      (frame, index) =>
        !finite(frame.timestampMs) ||
        frame.timestampMs < input.startMs ||
        frame.timestampMs > input.endMs ||
        !nonempty(frame.id) ||
        (index > 0 && frame.timestampMs <= frames[index - 1].timestampMs),
    ) ||
    new Set(frames.map((frame) => frame.id)).size !== frames.length
  ) {
    return abstain(
      "invalid_timestamps",
      "Os frames não formam uma sequência válida no intervalo selecionado.",
      ["timestamps de origem únicos e crescentes"],
    );
  }
  if (
    frames.some(
      (frame) =>
        frame.sessionId !== input.sessionId ||
        frame.trackId !== input.athlete.playerTrackId,
    )
  ) {
    return abstain(
      "identity_mismatch",
      "Há frames de outra sessão ou outro jogador nesta janela.",
      ["identidade contínua em todos os frames"],
    );
  }
  const valid = frames.filter(validFrame);
  const maxGap = COACH_QUALITY_GATES.maximumGapMs;
  if (
    pose.coordinates !== "source-normalized" ||
    !pose.cameraStable ||
    !pose.bodyFullyVisible ||
    !finite(pose.personHeightPx) ||
    pose.personHeightPx < COACH_QUALITY_GATES.personHeightPx ||
    valid.length < COACH_QUALITY_GATES.minimumSamples ||
    valid.length / frames.length < COACH_QUALITY_GATES.validFraction ||
    valid[0].timestampMs - input.startMs > maxGap ||
    input.endMs - valid[valid.length - 1].timestampMs > maxGap ||
    valid.some(
      (frame, index) =>
        index > 0 && frame.timestampMs - valid[index - 1].timestampMs > maxGap,
    )
  ) {
    return abstain(
      "insufficient_quality",
      "A visibilidade ou continuidade desta janela não sustenta orientação técnica.",
      ["corpo inteiro, identidade contínua e amostras de pose suficientes"],
    );
  }
  if (input.stroke !== "forehand" && input.stroke !== "backhand") {
    return abstain(
      "unsupported_stroke",
      "Este rubric ainda não sustenta uma orientação de saque ou retorno.",
      ["evidência de bola/raquete e fases específicas do golpe"],
    );
  }
  const marks = input.phaseMarks ?? [];
  if (marks.some((mark) => !matchesIdentity(input, mark)))
    return abstain(
      "identity_mismatch",
      "As marcações pertencem a outro atleta ou vídeo.",
      ["marcações do atleta selecionado"],
    );
  if (marks.some((mark) => mark.revision !== input.revision))
    return abstain(
      "stale_revision",
      "As marcações precisam ser revistas nesta versão.",
      ["marcações da revisão atual"],
    );
  if (
    marks.some(
      (mark) =>
        !finite(mark.timestampMs) ||
        mark.timestampMs < input.startMs ||
        mark.timestampMs > input.endMs,
    )
  ) {
    return abstain(
      "invalid_timestamps",
      "Uma marcação está fora do intervalo selecionado.",
      ["marcações dentro da janela"],
    );
  }
  const confirmed = marks.filter(
    (mark) =>
      mark.source === "manual" &&
      mark.state === "confirmed" &&
      [mark.id, mark.methodVersion, mark.confirmedBy].every(nonempty),
  );
  const preparation = confirmed.filter((mark) => mark.phase === "preparation");
  const contact = confirmed.filter((mark) => mark.phase === "contact");
  if (preparation.length !== 1 || contact.length !== 1) {
    return abstain(
      "missing_phase_confirmation",
      "Confirme uma preparação e um contato visíveis para revisar a sequência. Pose isolada não confirma contato.",
      ["preparação e contato confirmados por uma pessoa"],
      [
        { type: "loop", startMs: input.startMs, endMs: input.endMs },
        {
          type: "request_confirmation",
          eventId: `${input.requestId}:preparation-contact`,
        },
      ],
    );
  }
  const prep = preparation[0];
  const hit = contact[0];
  if (
    new Set([pose.id, prep.id, hit.id]).size !== 3 ||
    prep.timestampMs >= hit.timestampMs ||
    marks.some((mark) => mark.state === "rejected")
  ) {
    return abstain(
      "contradictory_phases",
      "As marcações são contraditórias; revise-as antes de interpretar a técnica.",
      ["ordem temporal confirmada, sem evidência rejeitada"],
    );
  }
  if (
    ![prep, hit].every((mark) =>
      valid.some(
        (frame) => Math.abs(frame.timestampMs - mark.timestampMs) <= maxGap,
      ),
    )
  ) {
    return abstain(
      "insufficient_quality",
      "Faltam amostras corporais próximas das fases marcadas.",
      ["pose visível próxima de cada marcação"],
    );
  }
  const allowPractice =
    nonempty(input.athlete.goal) &&
    nonempty(input.athlete.experience) &&
    input.athlete.painReported !== true;
  const id = [
    input.sessionId,
    input.assetFingerprint,
    input.athlete.id,
    input.athlete.playerTrackId,
    String(input.revision),
    prep.id,
    hit.id,
  ]
    .map(encodeURIComponent)
    .join(":");
  return {
    ...base,
    status: "observation",
    observation: {
      id,
      sessionId: input.sessionId,
      assetId: input.assetId,
      assetFingerprint: input.assetFingerprint,
      athleteId: input.athlete.id,
      playerTrackId: input.athlete.playerTrackId,
      revision: input.revision,
      evidenceIds: [pose.id, prep.id, hit.id],
      stroke: input.stroke,
      phase: "preparation",
      startMs: prep.timestampMs,
      endMs: hit.timestampMs,
      observation: `A preparação marcada em ${(prep.timestampMs / 1000).toFixed(2)} s antecede o contato confirmado em ${(hit.timestampMs / 1000).toFixed(2)} s.`,
      interpretation:
        "A sequência marcada é compatível com a organização preparação–contato descrita no currículo. As fases foram confirmadas por uma pessoa, não detectadas a partir da pose.",
      uncertainty:
        "Esta ordem não prova que a preparação foi suficientemente antecipada, nem mede eficiência, força, spin ou qualidade do resultado. A pose de uma câmera é estimada.",
      strength:
        "Há uma sequência preparação–contato identificável para comparar com a próxima tentativa.",
      ...(allowPractice
        ? {
            cue: "Na próxima tentativa, repita a preparação antes do contato e compare a sua sensação.",
            drill: {
              ...preparationDrill,
              sourceIds: [...preparationDrill.sourceIds],
            },
          }
        : {}),
      sourceIds: ["usta-school-team-manual", "mediapipe-pose-web"],
      reassessment:
        "Compare outra tentativa do mesmo atleta com câmera equivalente e novas marcações confirmadas. Registre o feedback e mantenha, ajuste ou retire a sugestão; não atribua melhora automaticamente.",
    },
    actions: [
      { type: "seek", timestampMs: prep.timestampMs },
      { type: "slow", rate: 0.5 },
      { type: "loop", startMs: prep.timestampMs, endMs: hit.timestampMs },
      ...(allowPractice
        ? [{ type: "offer_drill" as const, drillId: preparationDrill.id }]
        : []),
    ],
  };
}
