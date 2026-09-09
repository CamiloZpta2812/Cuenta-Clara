import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { COLORS } from '../lib/constants.js';
import { fmtCOP, fmtShort } from '../lib/money.js';

/*
 * Las dos gráficas de Resumen, en su propio archivo.
 *
 * No es una separación de diseño sino de peso: recharts son 108 KB
 * comprimidos, más que todo el resto de la app junta. Estando aquí, el bundle
 * de arranque no los trae y Resumen puede pintar el saldo y los cuatro números
 * —que es lo que uno viene a mirar— mientras las gráficas todavía viajan.
 *
 * Ver App.jsx y Resumen.jsx: las dos se cargan con lazy().
 */

const ejeFecha = (d) => {
  const [, m, dia] = String(d).split('-');
  return `${parseInt(dia, 10)}/${parseInt(m, 10)}`;
};

const tooltipStyle = {
  fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}`,
};

function PulsoTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="cc-card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ fontWeight: 600 }}>{p.date}</div>
      <div className="cc-mono">{fmtCOP(p.saldo)}</div>
      {p.label && <div style={{ color: COLORS.inkSoft }}>{p.label}</div>}
    </div>
  );
}

export function Pulso({ data }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="pulso" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.income} stopOpacity={0.28} />
            <stop offset="100%" stopColor={COLORS.income} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
        <XAxis
          dataKey="date" tickFormatter={ejeFecha} minTickGap={28}
          tick={{ fontSize: 11, fill: COLORS.inkSoft }}
          axisLine={{ stroke: COLORS.line }} tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false}
          tickLine={false} tickFormatter={fmtShort} width={46}
        />
        <ReferenceLine y={0} stroke={COLORS.inkSoft} strokeDasharray="4 4" />
        <Tooltip content={<PulsoTooltip />} />
        <Area
          type="monotone" dataKey="saldo" stroke={COLORS.income}
          strokeWidth={2.5} fill="url(#pulso)" dot={false} activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Reparto({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name"
          innerRadius={60} outerRadius={98} paddingAngle={2}
        >
          {data.map((e) => <Cell key={e.name} fill={e.color} />)}
        </Pie>
        <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
