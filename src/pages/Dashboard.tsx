import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Ban, AlertTriangle, Timer } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatCard } from '@/components/StatCard';
import { DecisionStreamTable } from '@/components/DecisionStreamTable';
import { DecisionDrawer } from '@/components/DecisionDrawer';
import { DecisionsOverTimeChart } from '@/components/charts/DecisionsOverTimeChart';
import { TopReasonsChart } from '@/components/charts/TopReasonsChart';
import { PolicyModeCard } from '@/components/PolicyModeCard';
import { edonApi, Decision } from '@/lib/api';
import { detectCapabilities, type CapabilityKey } from '@/lib/capabilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<{
    allowed_24h?: number;
    blocked_24h?: number;
    confirm_24h?: number;
    latency_p50?: number;
    latency_p95?: number;
    latency_p99?: number;
  }>({});
  const [capabilities, setCapabilities] = useState<Record<CapabilityKey, boolean> | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [planName, setPlanName] = useState("pro");

  useEffect(() => {
    const baseUrl = (typeof window !== 'undefined' && localStorage.getItem('edon_api_base')) || '';
    const token = (typeof window !== 'undefined' && localStorage.getItem('edon_token')) || '';
    if (baseUrl && token) {
      detectCapabilities(baseUrl, token).then(setCapabilities);
    } else {
      setCapabilities({ timeseries: false, blockReasons: false });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const readPlan = () => setPlanName(localStorage.getItem('edon_plan') || 'pro');
    readPlan();
    window.addEventListener('storage', readPlan);
    return () => window.removeEventListener('storage', readPlan);
  }, []);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await edonApi.getMetrics();
        setMetrics(data);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to fetch metrics:', error);
        }
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectDecision = (decision: Decision) => {
    setSelectedDecision(decision);
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      
      <main className="container mx-auto px-6 py-8">
        {/* KPI Cards */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <StatCard
            title="Allowed (24h)"
            value={metrics?.allowed_24h != null ? metrics.allowed_24h.toLocaleString() : "—"}
            icon={ShieldCheck}
            variant="success"
            delay={0}
          />
          <StatCard
            title="Blocked (24h)"
            value={metrics?.blocked_24h != null ? metrics.blocked_24h.toLocaleString() : "—"}
            icon={Ban}
            variant="danger"
            delay={1}
          />
          <StatCard
            title="Confirm Needed (24h)"
            value={metrics?.confirm_24h != null ? metrics.confirm_24h.toLocaleString() : "—"}
            icon={AlertTriangle}
            variant="warning"
            delay={2}
          />
          <StatCard
            title="Latency p50"
            value={metrics?.latency_p50 != null ? `${metrics.latency_p50}ms` : "—"}
            icon={Timer}
            change={metrics?.latency_p95 != null && metrics.latency_p95 > 0 ? `p95: ${metrics.latency_p95}ms, p99: ${metrics.latency_p99 ?? 0}ms` : undefined}
            changeType="neutral"
            variant="default"
            delay={3}
          />
        </motion.div>

        {/* Quickstart */}
        <Card className="glass-card mb-8">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Quickstart</CardTitle>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Plan: {planName}</span>
            </div>
          </CardHeader>
          <CardContent className="grid md:grid-cols-[1.5fr_1fr] gap-6 text-sm text-muted-foreground">
            <div className="space-y-3">
              <div>1) Pick your AI model</div>
              <div>2) Add LLM + agent tokens</div>
              <div>3) Connect a channel (Slack, email, API)</div>
              <div>4) Choose governance mode</div>
              <div>5) Send a test command</div>
            </div>
            <div className="flex flex-col gap-3">
              <Link to="/quickstart">
                <Button className="rounded-full w-full">Open Quickstart</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Chart */}
          <div className="lg:col-span-2">
            <DecisionsOverTimeChart supported={capabilities?.timeseries ?? false} />
          </div>
          
          {/* Policy Mode Card */}
          <div>
            <PolicyModeCard />
          </div>
        </div>

        {/* Lower Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Decision Stream */}
          <DecisionStreamTable 
            onSelectDecision={handleSelectDecision}
            limit={20}
          />
          
          {/* Top Block Reasons */}
          <TopReasonsChart supported={capabilities?.blockReasons ?? false} />
        </div>
      </main>

      {/* Decision Drawer */}
      <DecisionDrawer
        decision={selectedDecision}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
