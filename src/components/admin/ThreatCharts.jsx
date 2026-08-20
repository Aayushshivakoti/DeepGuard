import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Sector
} from 'recharts';
import { BarChart2, PieChart as PieIcon } from 'lucide-react';

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomLineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="glass-strong rounded-xl p-3 text-xs"
      style={{ border: '1px solid rgba(6,182,212,0.2)', minWidth: '160px' }}
    >
      <p className="text-slate-400 font-semibold mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-slate-400 capitalize">{entry.dataKey}</span>
          </div>
          <span className="font-bold" style={{ color: entry.color }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div
      className="glass-strong rounded-xl p-3 text-xs"
      style={{ border: `1px solid ${item.payload.color}40` }}
    >
      <p className="font-bold" style={{ color: item.payload.color }}>{item.name}</p>
      <p className="text-slate-400">{item.value.toLocaleString()} scans</p>
      <p className="text-slate-500">{item.payload.percent?.toFixed(1)}%</p>
    </div>
  );
};

// ─── Active Pie Shape ──────────────────────────────────────────────────────────
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
  return (
    <g>
      <text x={cx} y={cy - 8} dy={8} textAnchor="middle" fill={fill} fontSize={18} fontWeight="bold">
        {payload.name}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        {payload.value.toLocaleString()} scans
      </text>
      <text x={cx} y={cy + 32} textAnchor="middle" fill={fill} fontSize={12} fontWeight="600">
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
      />
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={innerRadius - 2}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
      />
    </g>
  );
};

export default function ThreatCharts({ metrics }) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  if (!metrics) return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="skeleton h-72 rounded-2xl" />
      <div className="skeleton h-72 rounded-2xl" />
    </div>
  );

  const pieData = metrics.media_distribution?.map((d, i) => ({
    ...d,
    percent: (d.value / metrics.media_distribution.reduce((a, b) => a + b.value, 0)) * 100,
  })) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Line Chart — Weekly Threats */}
      <div className="glass rounded-2xl p-5 card-hover" style={{ border: '1px solid rgba(6,182,212,0.1)' }}>
        <div className="flex items-center gap-2 mb-5">
          <BarChart2 size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-200">Weekly Threat Volume</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={metrics.weekly_threats || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomLineTooltip />} />
            <Line
              type="monotone"
              dataKey="deepfakes"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#ef4444', filter: 'drop-shadow(0 0 4px #ef444480)' }}
            />
            <Line
              type="monotone"
              dataKey="phishing"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#f59e0b', filter: 'drop-shadow(0 0 4px #f59e0b80)' }}
            />
            <Line
              type="monotone"
              dataKey="authentic"
              stroke="#22c55e"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#22c55e' }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 justify-center">
          {[
            { label: 'Deepfakes', color: '#ef4444' },
            { label: 'Phishing', color: '#f59e0b' },
            { label: 'Authentic', color: '#22c55e' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-1 rounded-full" style={{ background: color }} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Donut Chart — Media Distribution */}
      <div className="glass rounded-2xl p-5 card-hover" style={{ border: '1px solid rgba(6,182,212,0.1)' }}>
        <div className="flex items-center gap-2 mb-5">
          <PieIcon size={16} className="text-purple-400" />
          <h3 className="text-sm font-bold text-slate-200">Media Type Distribution</h3>
        </div>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="60%" height={200}>
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="rgba(15,23,42,0.8)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2 flex-1">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: item.color }} />
                <span className="text-xs text-slate-400 flex-1 truncate">{item.name}</span>
                <span className="text-xs font-bold text-slate-300">{item.percent.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
