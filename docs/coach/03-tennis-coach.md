# Agente especialista em técnica de tênis

## O que significa ser especialista

O coach precisa reconhecer o contexto, localizar evidência no vídeo, distinguir uma boa execução de uma oportunidade específica e escolher uma intervenção compatível com o atleta. Fluência de texto, muitas fontes ou um esqueleto animado não provam competência.

Formato de cada orientação:

1. **Observação:** o que está realmente visível, incluindo um acerto quando houver evidência.
2. **Prova:** instante/intervalo, jogador, fase e overlay relevante.
3. **Interpretação:** hipótese técnica contextual, com limites da câmera/modelo.
4. **Ação:** uma instrução curta que o atleta consegue experimentar.
5. **Treino:** exercício, objetivo observável e forma de comparar outra tentativa.
6. **Reavaliação:** resultado medido/confirmado; manter, ajustar ou retirar a sugestão.

Exemplo condicionado: se o contato e a preparação foram identificados com evidência, o coach pode comparar sua ordem temporal. Sem contato observável, não dizer “você chegou atrasado” apenas porque o cotovelo parece flexionado.

## Contexto pessoal mínimo

Mão dominante, backhand de uma/duas mãos, experiência autodeclarada, objetivo do treino, golpe escolhido e feedback do atleta. Guardar preferências e observações aceitas por sessão, com origem. Não inferir nível, limitação física ou histórico de lesão a partir do corpo na imagem.

Revisar comparações dentro do próprio atleta, com câmera/condições equivalentes, antes de usar um profissional como padrão. Técnica varia; um único ângulo “ideal” universal não é critério suficiente.

## Conhecimento fundamentado

Construir uma coleção pequena e curada, não um scraping indiscriminado. Fontes prioritárias: federações oficiais para regras; literatura biomecânica revisada por pares; documentação primária dos modelos; material técnico autorizado de treinadores qualificados.

Cada item precisa de `sourceId`, URL, título, autores/organização, ano/data de acesso, trecho permitido ou paráfrase, população/tarefa estudada, tipo/força de evidência, restrições e conceitos a que se aplica. Um embedding facilita recuperação, mas não avalia qualidade científica.

Recuperar por golpe, fase, objetivo e evidência disponível. Regras determinísticas controlam o que pode ser concluído. A narração usa apenas a observação estruturada e fontes pertinentes. Se o conjunto não sustenta a conclusão, o coach pede confirmação ou se abstém. Atualizações da coleção/modelo têm versão e regressão no conjunto de avaliação.

### Taxonomia inicial

| Golpe/ação | Fases que podem orientar a revisão | Dependências |
| --- | --- | --- |
| Forehand/backhand | Preparação, deslocamento, contato, acompanhamento, recuperação | Identidade, corpo visível; contato requer bola/raquete ou marcação humana |
| Saque | Preparação, lançamento, carregamento, aceleração, contato, aterrissagem | Visibilidade completa; gesto rápido e oclusões exigem captura adequada |
| Retorno/split-step | Gatilho do adversário, preparação e primeiro deslocamento | Dois atletas sincronizados e contato adversário confirmado |
| Decisão tática | Posição, direção, recuperação e opção alternativa | Quadra/calibração, bola, adversário e contexto; pose sozinha é insuficiente |

## Stack e seleção por evidência

**Baseline implementável:** MediaPipe Pose Landmarker; 33 landmarks de imagem e coordenadas mundiais estimadas. Rodar detecção em worker, pois a chamada síncrona bloqueia a thread. É baseline de engenharia, não declaração de “melhor modelo para tênis”.

- [Guia web oficial](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js).
- [Referência da API](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.poselandmarker).

**Comparação posterior:** RTMW/alternativas whole-body e engines server existentes, com modelo, pesos, licença e hardware identificados. Comparar com a mesma anotação humana antes de trocar a baseline. [RTMW, artigo dos autores](https://arxiv.org/abs/2407.08634).

**3D quantitativo:** avaliar captura multicâmera calibrada e sincronizada. [OpenCap, estudo original](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1011462) validou tarefas como caminhada, agachamento e salto; isso não valida automaticamente saque de tênis. [OpenCap Monocular, preprint de 2026](https://arxiv.org/abs/2603.24733) é candidato de pesquisa, não prova de acurácia em tênis.

**Base técnica:** [Biomechanics and tennis — Elliott](https://pmc.ncbi.nlm.nih.gov/articles/PMC2577481/) ajuda a estruturar coordenação, cadeia cinética e variabilidade. Não converter conceitos desse artigo em thresholds diagnósticos ou ângulos universais.

## Requisitos de percepção

- Selecionar jogador/ROI e manter track ID. `numPoses: 1` pode trocar para o adversário; não resolve identidade.
- Multiplicar x/y normalizados pelas dimensões reais antes de calcular ângulos 2D; compensar letterboxing, rotação e espelhamento.
- Mostrar `—` quando uma medida não tiver evidência. Diferenciar joint visibility, qualidade da janela e confiança da interpretação.
- Gates iniciais a calibrar: todos os joints necessários com visibilidade ≥0,8; pessoa com altura ≥180 pixels de origem; ≥80% amostras válidas; ao menos 5 amostras para orientação temporal. São hipóteses conservadoras de engenharia, não limites científicos estabelecidos.
- Invalidar cortes, membros fora do quadro, troca de identidade, grandes lacunas ou câmera incompatível. Não interpolar um contato ausente e depois afirmar que foi visto.
- Exibir **“3D estimado de uma câmera”** ao rotacionar landmarks monoculares. Não é uma filmagem de um ângulo inexistente.

## Limites obrigatórios do coach

Body pose isolada não mede ace, winner, bola dentro/fora, velocidade da raquete, spin, forças, torque ou risco de lesão. Pronação e movimentos finos da mão exigem evidência apropriada. Não converter pontos de imagem em centímetros sem escala/calibração validada.

O produto é treinamento técnico, não diagnóstico. Quando o atleta relata dor, não prescrever uma correção biomecânica como tratamento. O trabalho técnico pode continuar em observações não clínicas com limites claros.

## Como demonstrar qualidade

Separar rótulos de referência feitos por treinador humano da saída do modelo. Avaliar evidência correta, adequação técnica, utilidade do cue, adequação do exercício, abstenção e consistência entre repetições. O treinador deve poder corrigir uma análise e o sistema preservar essa correção.

Não promover uma sugestão genérica a “erro detectado”. Não treinar/fine-tunar em vídeos privados por padrão. Um roadmap de fine-tuning só faz sentido depois de um dataset autorizado, versionado e uma falha mensurável do baseline.
