import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
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

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/* En rangos cortos el eje dice el día; en uno largo, el mes. */
const ejeFecha = (largo) => (d) => {
  const [, m, dia] = String(d).split('-').map(Number);
  return largo ? `${MESES[m - 1]}` : `${dia} ${MESES[m - 1]}`;
};

const fechaTooltip = (d) => {
  const [y, m, x] = String(d).split('-').map(Number);
  return new Date(y, m - 1, x).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
};

const tooltipStyle = {
  fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}`,
};

function PulsoTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="cc-card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: COLORS.inkSoft }}>{fechaTooltip(p.date)}</div>
      <div className="cc-mono" style={{ fontWeight: 700, fontSize: 15 }}>{fmtCOP(p.saldo)}</div>
      {p.ajuste ? (
        <div style={{ color: COLORS.inkSoft }}>
          Cuadraste con el banco: {p.ajuste > 0 ? '+' : ''}{fmtCOP(p.ajuste)} que no estaban registrados
        </div>
      ) : (p.label && p.kind !== 'borde' && <div style={{ color: COLORS.inkSoft }}>{p.label}</div>)}
    </div>
  );
}

/*
 * Un ajuste se marca con un punto: es el brinco de la línea, y sin el punto
 * parecería un gasto o un ingreso que nunca existió.
 */
function PuntoAjuste({ cx, cy, payload }) {
  if (!payload || !payload.ajuste) return null;
  return (
    <circle cx={cx} cy={cy} r={5} fill={COLORS.card || '#fff'} stroke={COLORS.ink} strokeWidth={2} />
  );
}

/*
 * El saldo en el rango elegido. Como la del dólar: la línea es verde si en el
 * rango subiste y roja si bajaste, para que el veredicto se lea antes que los
 * números. La línea del cero solo aparece si la curva se le acerca: si siempre
 * estás en positivo, una raya punteada abajo es ruido.
 */
export function Pulso({ data, subio = true, largo = false }) {
  const color = subio ? COLORS.income : COLORS.expense;
  const min = Math.min(...data.map((p) => p.saldo));
  const id = subio ? 'pulso-sube' : 'pulso-baja';
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.24} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
        <XAxis
          dataKey="date" tickFormatter={ejeFecha(largo)} minTickGap={36}
          tick={{ fontSize: 11, fill: COLORS.inkSoft }}
          axisLine={{ stroke: COLORS.line }} tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false}
          tickLine={false} tickFormatter={fmtShort} width={48} domain={['auto', 'auto']}
        />
        {min < 0 && <ReferenceLine y={0} stroke={COLORS.inkSoft} strokeDasharray="4 4" />}
        <Tooltip content={<PulsoTooltip />} cursor={{ stroke: COLORS.inkSoft, strokeDasharray: '3 3' }} />
        <Area
          type="monotone" dataKey="saldo" stroke={color}
          strokeWidth={2} fill={`url(#${id})`} dot={<PuntoAjuste />}
          activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/*
 * El ritmo del gasto variable: lo que llevas contra la recta del plan.
 *
 * Dos series, así que no basta el color para distinguirlas: lo real es una
 * línea sólida y gruesa, el plan una punteada y gris. El color de lo real
 * dice el veredicto —rojo si vas por encima de la recta, verde si no—, igual
 * que en el saldo.
 */
function RitmoTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="cc-card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: COLORS.inkSoft }}>Día {p.day}</div>
      {p.real !== null && <div><strong className="cc-mono">{fmtCOP(p.real)}</strong> gastado</div>}
      <div style={{ color: COLORS.inkSoft }}>{fmtCOP(p.plan)} si fueras parejo</div>
    </div>
  );
}

export function Ritmo({ data, pasado = false, hoyDia }) {
  const color = pasado ? COLORS.expense : COLORS.income;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
        <XAxis
          dataKey="day" tick={{ fontSize: 11, fill: COLORS.inkSoft }} interval="preserveStartEnd"
          axisLine={{ stroke: COLORS.line }} tickLine={false} minTickGap={20}
        />
        <YAxis
          tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false}
          tickLine={false} tickFormatter={fmtShort} width={48}
        />
        {hoyDia > 0 && hoyDia < data.length && (
          <ReferenceLine x={hoyDia} stroke={COLORS.ink} strokeDasharray="2 3"
            label={{ value: 'hoy', position: 'insideTopRight', fontSize: 11, fill: COLORS.inkSoft }} />
        )}
        <Tooltip content={<RitmoTooltip />} cursor={{ stroke: COLORS.inkSoft, strokeDasharray: '3 3' }} />
        <Line type="linear" dataKey="plan" stroke={COLORS.inkSoft} strokeWidth={1.5}
          strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="real" stroke={color} strokeWidth={2.5}
          dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
          connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Reparto({ data, alto = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name"
          innerRadius={alto * 0.27} outerRadius={alto * 0.42} paddingAngle={2}
        >
          {data.map((e) => <Cell key={e.name} fill={e.color} />)}
        </Pie>
        <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
