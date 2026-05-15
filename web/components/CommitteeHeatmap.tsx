"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function CommitteeBar({ data }: { data: { committee: string; count: number }[] }) {
  const cleaned = data.map((d) => ({ committee: d.committee, count: Number(d.count) }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={cleaned} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="committee" width={100} />
          <Tooltip />
          <Bar dataKey="count" fill="#0891b2" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
