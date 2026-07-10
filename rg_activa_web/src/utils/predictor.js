/**
 * Evaluates a single decision tree on the given feature vector.
 * @param {Array} node - The tree node (represented as [value] or [feature_index, threshold, missing_go_to_left, left_subtree, right_subtree])
 * @param {Array<number>} x - The feature vector: [Semana_prod, Muertos_acum, Descartes_acum, Aves_vivas, Peso_anterior, Dias]
 * @returns {number} The predicted value.
 */
function predictTree(node, x) {
  // If the node is a leaf, it will have length 1
  if (node.length === 1) {
    return node[0];
  }

  const featureIndex = node[0];
  const threshold = node[1];
  const missingGoToLeft = node[2];
  const leftSubtree = node[3];
  const rightSubtree = node[4];

  const val = x[featureIndex];

  // Handle missing values (NaN, null, undefined) exactly like scikit-learn
  if (val === null || val === undefined || isNaN(val)) {
    if (missingGoToLeft === 1) {
      return predictTree(leftSubtree, x);
    } else {
      return predictTree(rightSubtree, x);
    }
  }

  if (val <= threshold) {
    return predictTree(leftSubtree, x);
  } else {
    return predictTree(rightSubtree, x);
  }
}

/**
 * Predicts the output value by averaging the predictions of all trees in the forest.
 * @param {Array<Array>} forest - List of trees in the random forest.
 * @param {Array<number>} x - The feature vector.
 * @returns {number} The ensemble prediction.
 */
export function predictForest(forest, x) {
  if (!forest || forest.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < forest.length; i++) {
    sum += predictTree(forest[i], x);
  }
  return sum / forest.length;
}

/**
 * Simulates a full cycle or predicts the next week's values.
 * @param {Object} models - The loaded models object containing { peso, iniciador, terminador }
 * @param {Object} state - The current state containing:
 *   - semana_actual (number)
 *   - pollos_iniciales (number)
 *   - muertos_acum (number)
 *   - descartes_acum (number)
 *   - peso_actual (number)
 * @returns {Object} Predicted values for the next week:
 *   - semana_proyectada (number)
 *   - peso_esperado_gr (number)
 *   - iniciador_bolsas (number)
 *   - terminador_bolsas (number)
 */
export function predictNextWeek(models, state) {
  if (!models || !models.peso || !models.iniciador || !models.terminador) {
    throw new Error("Models not loaded");
  }

  const semana_proxima = state.semana_actual + 1;
  const aves_vivas = state.pollos_iniciales - state.muertos_acum - state.descartes_acum;
  const dias = semana_proxima * 7;

  // Features vector: ['Semana_prod', 'Muertos_acum', 'Descartes_acum', 'Aves_vivas', 'Peso_anterior', 'Dias']
  const x = [
    semana_proxima,
    state.muertos_acum,
    state.descartes_acum,
    aves_vivas,
    state.peso_actual, // weight of current week is the "previous weight" for next week
    dias
  ];

  const peso_pred = predictForest(models.peso, x);
  const iniciador_pred = predictForest(models.iniciador, x);
  const terminador_pred = predictForest(models.terminador, x);

  return {
    semana_proyectada: semana_proxima,
    peso_esperado_gr: Math.max(0, Math.round(peso_pred * 100) / 100),
    iniciador_bolsas: Math.max(0, Math.round(iniciador_pred * 100) / 100),
    terminador_bolsas: Math.max(0, Math.round(terminador_pred * 100) / 100)
  };
}
