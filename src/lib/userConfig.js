/*
 * Configuración del usuario que necesitan helpers puros (monthKeyFromDate,
 * getCategory, buildRecommendations) que viven fuera del componente.
 * Se actualiza SOLO desde los setters envueltos de CuentaClaraApp, nunca
 * durante el render: mutar módulo mientras React renderiza es una fuente de
 * bugs difíciles bajo StrictMode / rendering concurrente.
 */
export const userConfig = {
  categoryLabels: {},
  customCategories: [],
};
