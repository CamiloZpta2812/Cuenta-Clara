export const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

:root {
  --paper: #F4F1EA;
  --paper-line: #E4DDCE;
  --ink: #2E2B27;
  --ink-soft: #6E675E;
  --income: #2F7D5C;
  --income-soft: #E3EFE8;
  --expense: #BB4B34;
  --expense-soft: #F5E2DB;
  --savings: #B98A2E;
  --savings-soft: #F6EEDA;
  --debt: #6B5199;
  --debt-soft: #EDE7F5;
  --brand: #BB4B34;
  --card: #FFFFFF;
}
.cc-app {
  font-family: 'Poppins', sans-serif;
  color: var(--ink);
  background:
    repeating-linear-gradient(to bottom, transparent 0 39px, var(--paper-line) 39px 40px),
    var(--paper);
  min-height: 100vh;
  display: flex;
  box-sizing: border-box;
}
.cc-app * { box-sizing: border-box; }
.cc-mono { font-family: 'Poppins', sans-serif; }
.cc-display { font-family: 'Poppins', sans-serif; }

.cc-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.55);
  border-right: 1px solid var(--paper-line);
  padding: 22px 16px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: 100vh;
}
.cc-brand { display: flex; align-items: center; gap: 10px; padding: 0 6px; }
.cc-brand-logo { display: inline-flex; align-items: center; line-height: 1; }
.cc-brand-title { font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: -0.01em; }
.cc-brand-sub { font-size: 12px; color: var(--ink-soft); }
.cc-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.cc-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 9px; border: none;
  background: transparent; cursor: pointer; text-align: left;
  font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 500;
  color: var(--ink-soft); transition: background .15s ease, color .15s ease;
  border-left: 3px solid transparent;
}
.cc-nav-item:hover { background: rgba(32,43,56,0.05); color: var(--ink); }
.cc-nav-item.active { background: var(--card); color: var(--ink); border-left: 3px solid var(--brand); font-weight: 600; box-shadow: 0 1px 2px rgba(46,43,39,.06); }
.cc-sidebar-footer { display: flex; flex-direction: column; gap: 8px; padding: 0 6px; }
.cc-sidebar-note { font-size: 11px; color: var(--ink-soft); line-height: 1.5; }

.cc-main { flex: 1; padding: 28px 34px; max-width: 1180px; }
.cc-page-title { font-family: 'Poppins', sans-serif; font-size: 24px; font-weight: 600; margin: 0 0 4px 0; }
.cc-page-sub { color: var(--ink-soft); font-size: 14px; margin: 0 0 22px 0; }
.cc-subtabs { display: flex; gap: 6px; margin-bottom: 18px; flex-wrap: wrap; }
.cc-subtab { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--paper-line); background: var(--card); color: var(--ink-soft); font-size: 13px; font-weight: 600; cursor: pointer; }
.cc-subtab.active { background: var(--brand); color: #fff; border-color: var(--brand); }

.cc-form-error {
  display: flex; align-items: center; gap: 8px;
  background: var(--expense-soft); color: var(--expense);
  padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.45;
}

.cc-banner {
  display: flex; align-items: center; gap: 8px;
  background: var(--expense-soft); color: var(--expense);
  padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;
}

.cc-banner-offline { background: var(--savings-soft); color: var(--savings); }
.cc-banner-ok { background: var(--income-soft); color: var(--income); }

.cc-stamp {
  display: inline-flex; align-items: center; gap: 8px;
  border: 3px double currentColor; padding: 10px 18px; border-radius: 8px;
  transform: rotate(-3deg); font-family: 'Poppins', sans-serif;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 12.5px;
}

.cc-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin: 20px 0; }
.cc-card { background: var(--card); border-radius: 14px; padding: 18px 20px; box-shadow: 0 1px 2px rgba(32,43,56,.05), 0 6px 18px rgba(32,43,56,.05); border: 1px solid rgba(32,43,56,0.04); }
.cc-stat-label { font-size: 12px; color: var(--ink-soft); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.cc-stat-value { font-family: 'Poppins', sans-serif; font-size: 21px; font-weight: 600; }
.cc-stat-sub { font-size: 11.5px; color: var(--ink-soft); margin-top: 4px; }

.cc-icon-circle { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

.cc-charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 22px 0; }
.cc-charts-grid.cc-full { grid-template-columns: 1fr; }
.cc-chart-title { font-size: 14px; font-weight: 600; margin: 0 0 4px 0; }
.cc-chart-sub { font-size: 12px; color: var(--ink-soft); margin: 0 0 10px 0; }

.cc-rec-list { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.cc-rec-item { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; font-size: 13.5px; line-height: 1.5; }

.cc-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }

.cc-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 9px 15px; border-radius: 8px;
  border: none; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 13.5px;
  cursor: pointer; transition: transform .1s ease, opacity .15s ease; white-space: nowrap;
}
.cc-btn:active { transform: scale(0.97); }
.cc-btn-primary { background: var(--brand); color: #fff; }
.cc-btn-outline { background: transparent; border: 1.5px solid var(--paper-line); color: var(--ink); }
.cc-btn-danger { background: transparent; color: var(--expense); padding: 6px 8px; }
.cc-btn-sm { padding: 6px 10px; font-size: 12.5px; }
.cc-btn:disabled { opacity: .5; cursor: not-allowed; }

.cc-form { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); background: var(--card); padding: 18px; border-radius: 12px; border: 1.5px dashed var(--paper-line); margin-bottom: 18px; }
.cc-form-actions { grid-column: 1 / -1; display: flex; gap: 10px; margin-top: 2px; }
.cc-field-full { grid-column: 1 / -1; }
.cc-field { display: flex; flex-direction: column; gap: 5px; }
.cc-field label { font-size: 11.5px; color: var(--ink-soft); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
.cc-input, .cc-select {
  padding: 9px 10px; border: 1px solid var(--paper-line); border-radius: 8px;
  font-family: 'Poppins', sans-serif; font-size: 16px; background: #fff; color: var(--ink); width: 100%;
}
.cc-input:focus, .cc-select:focus { outline: 2px solid var(--brand); outline-offset: 1px; }
.cc-type-toggle { display: flex; gap: 6px; grid-column: 1 / -1; }
.cc-type-btn { flex: 1; padding: 9px; border-radius: 8px; border: 1.5px solid var(--paper-line); background: #fff; cursor: pointer; font-weight: 600; font-size: 13.5px; }
.cc-type-btn.active-gasto { background: var(--expense-soft); border-color: var(--expense); color: var(--expense); }
.cc-type-btn.active-ingreso { background: var(--income-soft); border-color: var(--income); color: var(--income); }

.cc-filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.cc-filters select { min-width: 140px; }
.cc-day-filter {
  position: relative; display: flex; align-items: center; min-width: 140px;
  border: 1px solid var(--paper-line); border-radius: 8px; background: #fff; padding: 0 10px;
}
.cc-day-filter input[type="date"] {
  border: none; background: transparent; padding: 9px 0; width: 100%; min-width: 0;
  font-family: 'Poppins', sans-serif; font-size: 16px; color: var(--ink);
}
.cc-day-filter-placeholder {
  position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
  color: var(--ink-soft); font-size: 14px; pointer-events: none; background: #fff;
}
.cc-day-filter-clear {
  border: none; background: transparent; color: var(--ink-soft); cursor: pointer;
  display: flex; align-items: center; padding: 4px;
}

.cc-tx-list { display: flex; flex-direction: column; gap: 8px; }
.cc-tx-row { display: flex; align-items: center; gap: 12px; background: var(--card); padding: 11px 14px; border-radius: 10px; border: 1px solid rgba(32,43,56,0.04); }
.cc-fixed-row { display: flex; flex-direction: column; gap: 10px; background: var(--card); padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(46,43,39,0.04); }
.cc-fixed-row-main { display: flex; align-items: flex-start; gap: 12px; }
.cc-fixed-row-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.cc-tx-cat { font-size: 13px; font-weight: 600; }
.cc-tx-note { font-size: 12px; color: var(--ink-soft); }
.cc-tx-date { font-size: 11.5px; color: var(--ink-soft); font-family: 'Poppins', sans-serif; }
.cc-tx-amount { font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 14px; margin-left: auto; }
.cc-tag { display: inline-block; font-size: 11px; padding: 3px 8px; border-radius: 6px; background: var(--paper); color: var(--ink-soft); font-family: 'Poppins', sans-serif; line-height: 1.4; max-width: 100%; }
.cc-tag-fixed { background: var(--debt-soft); color: var(--debt); }
.cc-tag-installment { background: var(--savings-soft); color: var(--savings); }
.cc-tx-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
.cc-checkbox-field { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--ink); font-weight: 500; }

.cc-statement {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--debt-soft); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;
}
.cc-statement-clear { background: var(--income-soft); }
.cc-statement-label { font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em; color: var(--ink-soft); font-weight: 600; }
.cc-statement-amount { font-size: 20px; font-weight: 600; color: var(--ink); }
.cc-statement-due { text-align: right; font-size: 12.5px; color: var(--ink-soft); line-height: 1.4; }

.cc-goal-card, .cc-debt-card { background: var(--card); border-radius: 14px; padding: 18px 20px; border: 1px solid rgba(32,43,56,0.04); box-shadow: 0 1px 2px rgba(32,43,56,.05); margin-bottom: 14px; }
.cc-goal-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.cc-goal-name { font-weight: 600; font-size: 15px; }
.cc-goal-meta { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
.cc-progress-track { width: 100%; height: 9px; border-radius: 99px; background: var(--paper-line); overflow: hidden; margin: 8px 0; }
.cc-progress-fill { height: 100%; border-radius: 99px; }
.cc-goal-nums { display: flex; justify-content: space-between; font-size: 12.5px; font-family: 'Poppins', sans-serif; color: var(--ink-soft); }
.cc-inline-form { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
.cc-inline-form input { max-width: 150px; }

.cc-commit-list { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.cc-commit-row {
  display: flex; align-items: baseline; gap: 10px; font-size: 12.5px;
  padding: 7px 10px; background: var(--paper); border-radius: 8px;
}
.cc-commit-month { font-weight: 600; min-width: 58px; flex-shrink: 0; }
.cc-commit-detail { color: var(--ink-soft); flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cc-commit-total { font-weight: 600; margin-left: auto; flex-shrink: 0; }

/*
 * La cascada del mes: concepto, planeado, lo que va y la diferencia. Columnas
 * fijas para que las cifras queden alineadas entre filas — leerlas en columna
 * es justo el punto de la pantalla.
 */
.cc-plan-row {
  display: grid; grid-template-columns: 1fr 108px 108px 132px;
  align-items: baseline; gap: 10px; font-size: 12.5px;
  padding: 7px 10px; background: var(--paper); border-radius: 8px;
}
.cc-plan-row > :not(:first-child) { text-align: right; }
.cc-plan-head {
  background: none; padding-top: 0; padding-bottom: 4px;
  font-size: 11px; letter-spacing: .04em; text-transform: uppercase;
  color: var(--ink-soft);
}
.cc-plan-concept { display: flex; align-items: center; gap: 8px; min-width: 0; }
@media (max-width: 620px) {
  .cc-plan-row { grid-template-columns: 1fr 84px 96px; }
  .cc-plan-row > :nth-child(2), .cc-plan-head > :nth-child(2) { display: none; }
}

.cc-empty { text-align: center; padding: 34px 16px; color: var(--ink-soft); }
.cc-empty svg { margin-bottom: 8px; opacity: 0.5; }
.cc-empty p { margin: 4px 0; font-size: 13.5px; }

.cc-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; width: 100%; gap: 10px; color: var(--ink-soft); }
@keyframes cc-spin { to { transform: rotate(360deg); } }
.cc-spin { animation: cc-spin 1s linear infinite; }

@media (max-width: 860px) {
  .cc-app { flex-direction: column; }
  .cc-sidebar { width: 100%; min-height: auto; flex-direction: column; align-items: stretch; border-right: none; border-bottom: 1px solid var(--paper-line); padding: 12px 14px; gap: 10px; }
  .cc-brand { display: flex; align-items: center; text-align: left; padding: 0 2px; }
  .cc-brand-sub { display: none; }
  .cc-nav { flex-direction: row; flex: none; overflow-x: auto; gap: 2px; }
  .cc-nav-item { border-left: none; border-bottom: 3px solid transparent; white-space: nowrap; }
  .cc-nav-item.active { border-left: none; border-bottom: 3px solid var(--brand); }
  .cc-sidebar-footer { display: none; }
  .cc-main { padding: 20px 16px; }
  .cc-charts-grid { grid-template-columns: 1fr; }
  .cc-form { grid-template-columns: minmax(0, 1fr); }
  .cc-field { min-width: 0; }
  .cc-input, .cc-select { min-width: 0; max-width: 100%; }
}

.cc-fab {
  position: fixed; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); right: 20px;
  width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--brand, #BB4B34); color: #fff; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 16px rgba(187,75,52,0.4); z-index: 40; transition: transform 0.15s ease;
}
.cc-fab:hover { transform: scale(1.06); }
.cc-fab:active { transform: scale(0.96); }

@media (prefers-reduced-motion: reduce) {
  .cc-btn, .cc-progress-fill { transition: none !important; }
}

.cc-print-report { display: none; }
.cc-print-sub { color: var(--ink-soft); font-size: 13px; margin: 0 0 20px 0; }
.cc-print-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
.cc-print-table td, .cc-print-table th { padding: 5px 8px; border-bottom: 1px solid #ddd; text-align: left; }
.cc-print-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--ink-soft); }
.cc-print-table td:last-child, .cc-print-table th:last-child { text-align: right; }
.cc-print-list { font-size: 13px; line-height: 1.6; padding-left: 18px; margin-bottom: 20px; }
@media print {
  body * { visibility: hidden; }
  .cc-print-report, .cc-print-report * { visibility: visible; }
  .cc-print-report { display: block; position: absolute; top: 0; left: 0; width: 100%; padding: 10mm; }
  .cc-print-report h1 { font-family: 'Poppins', sans-serif; font-size: 22px; margin: 0 0 4px 0; }
  .cc-print-report h2 { font-family: 'Poppins', sans-serif; font-size: 15px; margin: 22px 0 8px 0; }
}
`;

