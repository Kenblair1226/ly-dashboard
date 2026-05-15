"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export default function NewsTimeline({ data }: { data: { day: string; count: number }[] }) {
  const cleaned = data.map((d) => ({ day: d.day, count: Number(d.count) }));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={cleaned}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Area type="monotone" dataKey="count" stroke="#dc2626" fill="#fecaca" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
