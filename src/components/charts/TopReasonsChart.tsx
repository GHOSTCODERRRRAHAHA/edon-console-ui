import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { edonApi, BlockReason } from '@/lib/api';

type TopReasonsChartProps = { supported?: boolean };

export function TopReasonsChart({ supported = true }: TopReasonsChartProps) {
  const [data, setData] = useState<BlockReason[] | null>(supported ? [] : null);
  const [loading, setLoading] = useState(supported);
  const [error, setError] = useState<string | null>(null);
  const didRun = useRef(false);

  useEffect(() => {
    if (!supported) {
      setData(null);
      setLoading(false);
      setError(null);
      didRun.current = false;
      return;
    }
    setData([]);
    setLoading(true);
    setError(null);
    didRun.current = false;
  }, [supported]);

  useEffect(() => {
    if (!supported || didRun.current) return;
    didRun.current = true;

    const fetchData = async () => {
      try {
        setError(null);
        const result = await edonApi.getBlockReasons(7);
        setData(Array.isArray(result) ? result : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load block reasons');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [supported]);

  const colors = [
    'hsl(280 100% 70%)',
    'hsl(300 100% 65%)',
    'hsl(320 100% 60%)',
    'hsl(340 100% 55%)',
    'hsl(0 100% 50%)',
    'hsl(20 100% 50%)',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card p-6"
    >
      <h3 className="font-semibold mb-6">Top Block Reasons (7d)</h3>

      {!supported || data === null ? (
        <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
          Not supported by this gateway build.
        </div>
      ) : loading ? (
        <div className="h-[250px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
          No blocked decisions found in the last 7 days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart 
            data={data} 
            layout="vertical" 
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <XAxis 
              type="number" 
              stroke="rgba(255,255,255,0.4)"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis 
              type="category" 
              dataKey="reason" 
              width={150}
              stroke="rgba(255,255,255,0.4)"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(240 10% 12% / 0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar 
              dataKey="count" 
              radius={[0, 6, 6, 0]}
              name="Count"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
