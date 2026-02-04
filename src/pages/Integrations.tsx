import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TopNav } from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { edonApi, isMockMode, getToken } from '@/lib/api';
import { PlugZap, CheckCircle2, XCircle, AlertTriangle, RefreshCcw, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface IntegrationStatus {
  connected: boolean;
  base_url?: string;
  auth_mode?: 'password' | 'token';
  last_ok_at?: string;
  last_error?: string | null;
  active_policy_pack?: string | null;
  default_intent_id?: string | null;
  network_gating_enabled?: boolean;
  clawdbot_reachability?: 'loopback' | 'private' | 'public' | 'unknown';
  bypass_risk?: 'low' | 'high';
  recommendation?: string | null;
}

export default function Integrations() {
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:18789');
  const [authMode, setAuthMode] = useState<'password' | 'token'>('password');
  const [secret, setSecret] = useState('');
  const [connecting, setConnecting] = useState(false);

  const normalizeBaseUrl = (value: string) => {
    try {
      const url = new URL(value.trim());
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return url.origin;
    } catch {
      return '';
    }
  };
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    if (isMockMode()) {
      setStatus({
        connected: false,
        base_url: undefined,
        auth_mode: undefined,
        last_ok_at: undefined,
        last_error: null,
        active_policy_pack: null,
        default_intent_id: null,
      });
      setLoading(false);
      return;
    }

    if (!isMockMode() && !getToken()) {
      setStatus({
        connected: false,
        last_error: 'Access key required. Set your key in Settings.',
      });
      setLoading(false);
      return;
    }

    try {
      const response = await edonApi.getIntegrationStatus();
      setStatus(response.clawdbot);
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
      setStatus({
        connected: false,
        last_error: 'Failed to fetch status',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    const safeBase = normalizeBaseUrl(baseUrl);
    if (!safeBase || !secret) {
      toast({
        title: 'Validation Error',
        description: 'Enter a valid http(s) base URL and secret.',
        variant: 'destructive',
      });
      return;
    }
    if (!isMockMode() && !getToken()) {
      toast({
        title: 'Sign-in Required',
        description: 'Set your EDON access key in Settings before connecting.',
        variant: 'destructive',
      });
      return;
    }

    setConnecting(true);
    try {
      const response = await edonApi.connectClawdbot({
        base_url: safeBase,
        auth_mode: authMode,
        secret: secret,
        probe: true,
      });

      toast({
        title: 'Connected Successfully',
        description: response.message,
      });
      
      // Refresh status
      await fetchStatus();
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        console.error('Failed to connect to gateway:', error);
      }
      toast({
        title: 'Connection Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to connect. Check the base URL and secret.',
        variant: 'destructive',
      });
    } finally {
      // Clear secret field for security
      setSecret('');
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1">Integrations</h1>
            <p className="text-muted-foreground">Connect and manage your assistant integration</p>
          </div>

          {/* Clawdbot Integration Card */}
          <div className="glass-card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/20">
                  <PlugZap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Assistant Connection</h2>
                  <p className="text-sm text-muted-foreground">
                    Connect your assistant to enable safety controls
                  </p>
                </div>
              </div>
              {status && (
                <Badge
                  variant="outline"
                  className={
                    status.connected
                      ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                      : 'border-red-500/50 text-red-400 bg-red-500/10'
                  }
                >
                  {status.connected ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Connected
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      Not Connected
                    </>
                  )}
                </Badge>
              )}
            </div>

            <Separator className="bg-white/10" />

            {/* Connection Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:18789"
                  className="bg-secondary/50"
                  disabled={connecting || isMockMode()}
                />
                <p className="text-xs text-muted-foreground">
                  Connection base URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="authMode">Sign-in method</Label>
                <Select
                  value={authMode}
                  onValueChange={(value: 'password' | 'token') => setAuthMode(value)}
                  disabled={connecting || isMockMode()}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="password">Password</SelectItem>
                    <SelectItem value="token">Access key</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Sign-in method used for this connection
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret">Secret</Label>
                <Input
                  id="secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={authMode === 'password' ? 'local' : 'api-token'}
                  className="bg-secondary/50"
                  disabled={connecting || isMockMode()}
                />
                <p className="text-xs text-muted-foreground">
                  {authMode === 'password' ? 'Connection password' : 'Access key'}
                </p>
              </div>

              <Button
                onClick={handleConnect}
                disabled={connecting || isMockMode() || !baseUrl || !secret}
                className="w-full gap-2"
              >
                {connecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <PlugZap className="w-4 h-4" />
                    Connect & Verify
                  </>
                )}
              </Button>

            </div>

            {/* Status Information */}
            {status && status.connected && (
              <>
                <Separator className="bg-white/10" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Connection Details</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchStatus}
                      disabled={loading}
                    >
                      <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Base URL</p>
                      <p className="font-mono">{status.base_url || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sign-in method</p>
                      <p className="capitalize">{status.auth_mode || 'N/A'}</p>
                    </div>
                    {status.last_ok_at && (
                      <div>
                        <p className="text-muted-foreground">Last Success</p>
                        <p>{new Date(status.last_ok_at).toLocaleString()}</p>
                      </div>
                    )}
                    {status.last_error && (
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Last Error
                        </p>
                        <p className="text-red-400">{status.last_error}</p>
                      </div>
                    )}
                  </div>

                  {/* Network Gating Status */}
                  {(status.network_gating_enabled !== undefined || status.bypass_risk !== undefined) && (
                    <div className="space-y-2 pt-2">
                      <Separator className="bg-white/10" />
                      <div className="flex items-center justify-between">
                        <Label className="text-base flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4" />
                          Network Security
                        </Label>
                        {status.bypass_risk && (
                          <Badge
                            variant="outline"
                            className={
                              status.bypass_risk === 'high'
                                ? 'border-red-500/50 text-red-400 bg-red-500/10'
                                : 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                            }
                          >
                            {status.bypass_risk === 'high' ? (
                              <>
                                <ShieldAlert className="w-3 h-3 mr-1" />
                                High Risk
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                Low Risk
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Network protection</p>
                          <Badge variant="outline" className={status.network_gating_enabled ? 'border-emerald-500/50' : ''}>
                            {status.network_gating_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        {status.clawdbot_reachability && (
                          <div>
                            <p className="text-muted-foreground">Reachability</p>
                            <Badge variant="outline" className="capitalize">
                              {status.clawdbot_reachability}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* High Risk Callout */}
                      {status.bypass_risk === 'high' && status.recommendation && (
                        <Alert className="border-red-500/50 bg-red-500/10">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          <AlertTitle className="text-red-400">Security Risk Detected</AlertTitle>
                          <AlertDescription className="text-sm text-red-300/90 mt-2 whitespace-pre-line">
                            {status.recommendation}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  {status.active_policy_pack && (
                    <div className="pt-2">
                      <p className="text-muted-foreground text-sm mb-1">Active Safety Pack</p>
                      <Badge variant="outline">{status.active_policy_pack}</Badge>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
