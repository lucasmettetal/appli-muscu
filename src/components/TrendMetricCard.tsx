import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import type { LucideIcon } from 'lucide-react';

interface TrendMetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  data: number[];
  color: string; // couleur hex du trait/dégradé
  gradientId: string;
}

/**
 * Carte KPI avec mini-graphe d'aire. Inspirée du Progress Metric Card de
 * 21st.dev (makviesainte), réimplémentée à la main avec Recharts.
 */
export function TrendMetricCard({ label, value, icon: Icon, data, color, gradientId }: TrendMetricCardProps) {
  const chartData = (data.length > 0 ? data : [0, 0]).map((v, i) => ({ i, v }));

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 overflow-hidden">
      <div className="flex items-center gap-1.5 text-gray-400 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <div className="text-2xl font-extrabold text-gray-900 tabular-nums leading-none">{value}</div>
      <div className="h-12 -mx-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
