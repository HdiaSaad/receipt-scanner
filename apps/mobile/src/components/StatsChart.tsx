import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint { week: string; total: number }
interface Props { data: DataPoint[]; currency: string }

const StatsChart: React.FC<Props> = ({ data, currency }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="week"
        tickFormatter={(v: string) => v.slice(5)} // Show MM-DD
        tick={{ fontSize: 11 }}
      />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip formatter={(v: number) => [`${v.toFixed(2)} ${currency}`, 'Total']} />
      <Bar dataKey="total" fill="#3880ff" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

export default StatsChart;
