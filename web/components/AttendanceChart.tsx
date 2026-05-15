"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export default function AttendanceChart({ data }: { data: { session_period: number; count: number }[] }) {
  const cleaned = data.map((d) => ({ session: `第${d.session_period}會期`, count: Number(d.count) }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={cleaned}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="session" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
