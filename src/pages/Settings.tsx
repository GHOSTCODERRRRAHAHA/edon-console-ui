import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { edonApi } from "@/lib/api";
import { Globe, KeyRound, UserRound, Wifi, WifiOff, FlaskConical, Save } from "lucide-react";
import { runGovernanceSmokeTest, type SmokeStep } from "@/lib/smokeTest";
import { runGovernanceVerificationTest, type VerificationResult } from "@/lib/verificationTest";
import { getVerificationHistory, appendVerificationRecord, type VerificationHistoryRecord } from "@/lib/verificationHistory";

type ConnStatus = "unknown" | "connected" | "disconnected" | "failed";

const BASE_URL_KEY = "edon_api_base";
const TOKEN_KEY = "edon_token";
const AGENT_ID_KEY = "edon_agent_id";
const MOCK_KEY = "edon_mock_mode";
const ADMIN_KEY = "edon_admin_mode";
const LLM_PROVIDER_KEY = "edon_llm_provider";
const LLM_MODEL_KEY = "edon_llm_model";
const LLM_API_KEY = "edon_llm_api_key";
const LLM_CUSTOM_URL = "edon_llm_custom_url";
const PLAN_KEY = "edon_plan";
const EMAIL_KEY = "edon_user_email";
const LLM_LIST_KEY = "edon_llm_list";
const AGENT_LIST_KEY = "edon_agent_list";
const MANAGED_BILLING_KEY = "edon_llm_managed_billing";
const CHAT_TOOL_KEY = "edon_chat_tool";
const CHAT_ACTION_KEY = "edon_chat_action";
const CHAT_CREDENTIAL_KEY = "edon_chat_credential_id";

const LEGACY_BASE_KEYS = ["EDON_BASE_URL", "edon_api_base", "edon_base_url"] as const;

const isHexToken = (s: string) => /^(?:[a-f0-9]{64}|[a-f0-9]{128})$/i.test(s);
const isLikelyToken = (s: string) =>
  /^(edon_[A-Za-z0-9._-]{16,}|[a-f0-9]{64}|[a-f0-9]{128}|[A-Za-z0-9._-]{24,})$/i.test(s);

const normalizeBaseUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.origin;
  } catch {
    return "";
  }
};

function getStoredBaseUrl(envUrl?: string, isProd?: boolean) {
  const v =
    LEGACY_BASE_KEYS.map((k) => localStorage.getItem(k))
      .find((x) => (x ?? "").trim().length > 0) ||
    envUrl ||
    (isProd ? "https://api.edoncore.com" : "http://127.0.0.1:8000");

  return v.trim();
}

function getStoredToken(envToken?: string) {
  const v = envToken || localStorage.getItem("edon_token") || "";
  return (v || "").trim();
}

async function safeText(res: Response) {
  try {
    return (await res.text()) || "";
  } catch {
    return "";
  }
}

export default function Settings() {
  const { toast } = useToast();
  const isProd = import.meta.env.MODE === "production";

  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8000");
  const [token, setToken] = useState("");
  const [agentId, setAgentId] = useState("default-agent");
  const [mockMode, setMockMode] = useState(false);
  const [testing, setTesting] = useState(false);
  const [llmProvider, setLlmProvider] = useState("anthropic");
  const [llmModel, setLlmModel] = useState("Claude Sonnet");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmCustomUrl, setLlmCustomUrl] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnStatus>("unknown");
  const [savedTokenInfo, setSavedTokenInfo] = useState<{ length: number; last4: string } | null>(null);
  const [smokeTestRunning, setSmokeTestRunning] = useState(false);
  const [smokeTestResult, setSmokeTestResult] = useState<{ steps: SmokeStep[]; ok: boolean } | null>(null);
  const [policyPack, setPolicyPack] = useState("clawdbot_safe");
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);
  const [verificationRunning, setVerificationRunning] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [allowPack, setAllowPack] = useState("clawdbot_safe");
  const [blockPack, setBlockPack] = useState("personal_safe");
  const [toolOp, setToolOp] = useState("clawdbot.sessions_list");
  const [verificationHistory, setVerificationHistory] = useState<VerificationHistoryRecord[]>(() => getVerificationHistory());
  const [adminMode, setAdminMode] = useState(false);
  const [planName, setPlanName] = useState("pro");
  const [userEmail, setUserEmail] = useState("unknown");
  const [managedBilling, setManagedBilling] = useState(false);
  const [llmList, setLlmList] = useState<string[]>([]);
  const [agentList, setAgentList] = useState<string[]>([]);
  const [newModelName, setNewModelName] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [billingStatus, setBillingStatus] = useState<{ status: string; plan: string } | null>(null);
  const [chatToolName, setChatToolName] = useState("chat");
  const [chatToolAction, setChatToolAction] = useState("json");
  const [chatCredentialId, setChatCredentialId] = useState("");

  const refreshSavedTokenInfo = () => {
    const stored = getStoredToken();
    setSavedTokenInfo(stored ? { length: stored.length, last4: stored.slice(-4) } : null);
  };

useEffect(() => {
  const CANON = "edon_token";
  const LEGACY = ["edon_api_token", "EDON_TOKEN", "EDON_API_TOKEN"];
  for (const k of LEGACY) {
    const v = (localStorage.getItem(k) || "").trim();
    if (v && !localStorage.getItem(CANON)) {
      localStorage.setItem(CANON, v);
    }
  }
  const envUrl = import.meta.env.VITE_EDON_GATEWAY_URL as string | undefined;
  const envToken = import.meta.env.VITE_EDON_API_TOKEN as string | undefined;
  setBaseUrl(getStoredBaseUrl(envUrl, isProd));
  setToken(getStoredToken(envToken));
  setAgentId(localStorage.getItem(AGENT_ID_KEY) || "default-agent");
  setMockMode(localStorage.getItem(MOCK_KEY) === "true");
  setAdminMode(localStorage.getItem(ADMIN_KEY) === "true");
  setLlmProvider(localStorage.getItem(LLM_PROVIDER_KEY) || "anthropic");
  setLlmModel(localStorage.getItem(LLM_MODEL_KEY) || "Claude Sonnet");
  setLlmApiKey(localStorage.getItem(LLM_API_KEY) || "");
  setLlmCustomUrl(localStorage.getItem(LLM_CUSTOM_URL) || "");
  setPlanName(localStorage.getItem(PLAN_KEY) || "pro");
  setUserEmail(localStorage.getItem(EMAIL_KEY) || "unknown");
  setManagedBilling(localStorage.getItem(MANAGED_BILLING_KEY) === "true");
  try {
    const storedModels = JSON.parse(localStorage.getItem(LLM_LIST_KEY) || "[]");
    if (Array.isArray(storedModels)) setLlmList(storedModels);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Failed to parse stored LLM list", error);
    }
  }
  try {
    const storedAgents = JSON.parse(localStorage.getItem(AGENT_LIST_KEY) || "[]");
    if (Array.isArray(storedAgents)) setAgentList(storedAgents);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Failed to parse stored agent list", error);
    }
  }
  setChatToolName(localStorage.getItem(CHAT_TOOL_KEY) || "chat");
  setChatToolAction(localStorage.getItem(CHAT_ACTION_KEY) || "json");
  setChatCredentialId(localStorage.getItem(CHAT_CREDENTIAL_KEY) || "");
  refreshSavedTokenInfo();

  const handleStorage = () => {
    setPlanName(localStorage.getItem(PLAN_KEY) || "pro");
    setUserEmail(localStorage.getItem(EMAIL_KEY) || "unknown");
    setManagedBilling(localStorage.getItem(MANAGED_BILLING_KEY) === "true");
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}, [isProd]);


  const persist = (trimmedBase: string, trimmedToken: string) => {
    localStorage.setItem(BASE_URL_KEY, trimmedBase);
    localStorage.setItem(TOKEN_KEY, trimmedToken);
    localStorage.setItem("EDON_BASE_URL", trimmedBase);
    localStorage.setItem("edon_base_url", trimmedBase);
    localStorage.setItem(AGENT_ID_KEY, agentId.trim() || "default-agent");
    localStorage.setItem(MOCK_KEY, mockMode.toString());
    localStorage.setItem(ADMIN_KEY, adminMode.toString());
  };

  const saveSettings = () => {
    const trimmedBase = baseUrl.trim();
    const trimmedToken = token.trim();
    const safeBase = normalizeBaseUrl(trimmedBase);

    if (/PASTE_YOUR_|NEW_GATEWAY_TOKEN_|TOKEN_HERE/i.test(trimmedToken)) {
      toast({
        title: "Invalid token",
        description: "You pasted a placeholder token. Paste your real EDON token.",
        variant: "destructive",
      });
      return;
    }

    if (!safeBase) {
      toast({
        title: "Invalid base URL",
        description: "Enter a valid http(s) URL (e.g. https://api.edoncore.com).",
        variant: "destructive",
      });
      return;
    }

    if (!isLikelyToken(trimmedToken)) {
      toast({
        title: "Invalid token",
        description: "Token format looks invalid. Paste your full EDON token.",
        variant: "destructive",
      });
      return;
    }

    persist(safeBase, trimmedToken);
    refreshSavedTokenInfo();

    if (!isHexToken(trimmedToken) && !trimmedToken.startsWith("edon_")) {
      toast({
        title: "Token saved",
        description: "Note: token is not hex; some gateways expect hex format.",
      });
    } else {
      toast({
        title: "Settings Saved",
        description: "Your configuration has been saved",
      });
    }
  };

  const planAllowsManaged = (planName || "").toLowerCase().includes("pro+");

  const persistList = (key: string, list: string[], setter: (items: string[]) => void) => {
    const cleaned = list.map((item) => item.trim()).filter(Boolean);
    setter(cleaned);
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
  };

  const addModel = () => {
    if (!newModelName.trim()) return;
    if (llmList.includes(newModelName.trim())) return;
    persistList(LLM_LIST_KEY, [...llmList, newModelName.trim()], setLlmList);
    setNewModelName("");
  };

  const removeModel = (name: string) => {
    persistList(LLM_LIST_KEY, llmList.filter((item) => item !== name), setLlmList);
  };

  const addAgent = () => {
    if (!newAgentName.trim()) return;
    if (agentList.includes(newAgentName.trim())) return;
    persistList(AGENT_LIST_KEY, [...agentList, newAgentName.trim()], setAgentList);
    setNewAgentName("");
  };

  const removeAgent = (name: string) => {
    persistList(AGENT_LIST_KEY, agentList.filter((item) => item !== name), setAgentList);
  };

  const loadAccount = async () => {
    try {
      const session = await edonApi.getSession();
      if (session?.plan) {
        setPlanName(session.plan);
        localStorage.setItem(PLAN_KEY, session.plan);
      }
      if (session?.email) {
        setUserEmail(session.email);
        localStorage.setItem(EMAIL_KEY, session.email);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Failed to load session data", error);
      }
    }

    try {
      const billing = await edonApi.getBillingStatus();
      if (billing?.plan) {
        setPlanName(billing.plan);
        setBillingStatus({ status: billing.status, plan: billing.plan });
        localStorage.setItem(PLAN_KEY, billing.plan);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Failed to load billing status", error);
      }
    }
  };

  useEffect(() => {
    if (!token) return;
    loadAccount();
  }, [token]);

  const saveLlmSettings = () => {
    const provider = llmProvider.trim();
    const model = llmModel.trim();
    const apiKey = llmApiKey.trim();
    const customUrl = llmCustomUrl.trim();

    if (!model) {
      toast({
        title: "Missing model",
        description: "Select an LLM model before saving.",
        variant: "destructive",
      });
      return;
    }

    if (provider === "custom" && !normalizeBaseUrl(customUrl)) {
      toast({
        title: "Invalid custom endpoint",
        description: "Enter a valid http(s) URL for your custom model.",
        variant: "destructive",
      });
      return;
    }

    if (provider !== "custom" && provider !== "local" && !isLikelyToken(apiKey)) {
      toast({
        title: "Invalid API key",
        description: "Paste a valid API key for your selected provider.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem(LLM_PROVIDER_KEY, provider);
    localStorage.setItem(LLM_MODEL_KEY, model);
    localStorage.setItem(LLM_API_KEY, apiKey);
    localStorage.setItem(LLM_CUSTOM_URL, customUrl);

    toast({
      title: "LLM settings saved",
      description: "Your model and provider credentials are saved.",
    });
  };

  const providerLinks: Record<string, string> = {
    anthropic: "https://console.anthropic.com/settings/keys",
    openai: "https://platform.openai.com/api-keys",
    google: "https://aistudio.google.com/app/apikey",
    mistral: "https://console.mistral.ai/api-keys",
  };

  /**
   * IMPORTANT:
   * This test does NOT rely on any singleton state.
   * It hits the gateway directly using the exact header EDON expects.
   */
  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus("unknown");

    const trimmedBase = baseUrl.trim();
    const trimmedToken = token.trim();

    try {
      // Always test with mock disabled
      localStorage.setItem(MOCK_KEY, "false");
      setMockMode(false);

      // Validate input token (don’t validate storage)
      if (!safeBase) {
        throw new Error("Base URL must be a valid http(s) URL.");
      }

      if (!isLikelyToken(trimmedToken)) {
        throw new Error("Token format looks invalid.");
      }

      // Persist first so the rest of the app uses the same base+token
      persist(safeBase, trimmedToken);
      refreshSavedTokenInfo();

      const base = safeBase.replace(/\/$/, "");

      // 1) /health
      const healthUrl = `${base}/health`;
      const res = await fetch(healthUrl, {
        method: "GET",
        headers: { "X-EDON-TOKEN": trimmedToken },
      });

      if (res.status === 401) {
        throw new Error("401 Unauthorized — token not accepted by gateway.");
      }
      if (!res.ok) {
        const txt = await safeText(res);
        throw new Error(`Gateway error ${res.status}. ${txt}`.trim());
      }

      // 2) authenticated endpoint
      const integrationsUrl = `${base}/integrations/account/integrations`;
      const res2 = await fetch(integrationsUrl, {
        method: "GET",
        headers: { "X-EDON-TOKEN": trimmedToken },
      });

      if (res2.status === 401) {
        throw new Error("401 Unauthorized on integrations — token accepted for /health but not for protected routes.");
      }
      if (!res2.ok) {
        const txt = await safeText(res2);
        throw new Error(`Integrations error ${res2.status}. ${txt}`.trim());
      }

      setConnectionStatus("connected");
      toast({
        title: "Connected",
        description: "Gateway reachable and authenticated.",
      });

      // Keep mock off after success
      localStorage.setItem(MOCK_KEY, "false");
      setMockMode(false);
    } catch (err: unknown) {
      setConnectionStatus("failed");
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const runSmokeTest = async () => {
    const trimmedBase = baseUrl.trim();
    const trimmedToken = token.trim();
    const safeBase = normalizeBaseUrl(trimmedBase);
    if (/PASTE_YOUR_|NEW_GATEWAY_TOKEN_|TOKEN_HERE/i.test(trimmedToken)) {
      toast({
        title: "Placeholder token",
        description: "Replace with your real EDON token before running the smoke test.",
        variant: "destructive",
      });
      return;
    }
    if (!safeBase) {
      toast({
        title: "Invalid base URL",
        description: "Enter a valid http(s) URL before running the smoke test.",
        variant: "destructive",
      });
      return;
    }
    if (!isLikelyToken(trimmedToken)) {
      toast({
        title: "Invalid token",
        description: "Token format looks invalid.",
        variant: "destructive",
      });
      return;
    }
    setSmokeTestRunning(true);
    setSmokeTestResult(null);
    try {
      const result = await runGovernanceSmokeTest({
        baseUrl: safeBase,
        token: trimmedToken,
        packName: policyPack.trim() || "clawdbot_safe",
      });
      setSmokeTestResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSmokeTestResult({
        steps: [],
        ok: false,
      });
      toast({
        title: "Smoke test failed",
        description: msg.slice(0, 200),
        variant: "destructive",
      });
    } finally {
      setSmokeTestRunning(false);
    }
  };

  function getSmokeTestCause(steps: SmokeStep[]): string | null {
    if (steps.length === 0) return "Gateway unreachable or CORS blocked.";
    const health = steps[0];
    const healthOk = health?.ok === true;
    const some401 = steps.some((s) => s.status === 401);
    const some404 = steps.some((s) => s.status === 404);
    const hasNetworkError = steps.some((s) => s.status === 0 || s.status == null);
    if (healthOk && some401) return "Token accepted by /health but rejected by protected routes (wrong token in UI or gateway expects different token).";
    if (some404) return "UI expects endpoints not present in this gateway build.";
    if (hasNetworkError) return "Gateway unreachable or CORS blocked.";
    return null;
  }

  const hasActiveIntent =
    typeof window !== "undefined" &&
    (localStorage.getItem("edon_active_intent_id") ?? "").trim().length > 0;

  const canRunVerification =
    (smokeTestResult?.ok === true || connectionStatus === "connected") &&
    !verificationRunning &&
    !mockMode &&
    isLikelyToken(token.trim()) &&
    !!normalizeBaseUrl(baseUrl.trim()) &&
    hasActiveIntent;

  const runVerification = async () => {
    const trimmedBase = baseUrl.trim();
    const trimmedToken = token.trim();
    const safeBase = normalizeBaseUrl(trimmedBase);
    if (/PASTE_YOUR_|NEW_GATEWAY_TOKEN_|TOKEN_HERE/i.test(trimmedToken)) {
      toast({
        title: "Placeholder token",
        description: "Replace with your real EDON token before running the verification test.",
        variant: "destructive",
      });
      return;
    }
    if (!safeBase) {
      toast({
        title: "Invalid base URL",
        description: "Enter a valid http(s) URL before running the verification test.",
        variant: "destructive",
      });
      return;
    }
    if (!isLikelyToken(trimmedToken)) {
      toast({
        title: "Invalid token",
        description: "Token format looks invalid.",
        variant: "destructive",
      });
      return;
    }
    setVerificationRunning(true);
    setVerificationResult(null);
    try {
      const result = await runGovernanceVerificationTest({
        baseUrl: safeBase,
        token: trimmedToken,
        allowPack: allowPack.trim() || "clawdbot_safe",
        blockPack: blockPack.trim() || "personal_safe",
        toolOp: toolOp.trim() || "clawdbot.sessions_list",
        agentId: agentId.trim() || "default-agent",
      });
      setVerificationResult(result);

      try {
        let gateway_version: string | undefined;
        try {
          const healthRes = await fetch(`${safeBase.replace(/\/$/, "")}/health`, {
            headers: { "X-EDON-TOKEN": trimmedToken },
          });
          if (healthRes.ok) {
            const healthJson = await healthRes.json();
            gateway_version = healthJson?.version;
          }
        } catch {
          // ignore
        }
        const record: VerificationHistoryRecord = {
          timestamp: new Date().toISOString(),
          allow_pack: allowPack.trim() || "clawdbot_safe",
          block_pack: blockPack.trim() || "personal_safe",
          tool_op: toolOp.trim() || "clawdbot.sessions_list",
          agent_id: agentId.trim() || "default-agent",
          verdict_allow: result.rowA.verdict,
          verdict_block: result.rowB.verdict,
          pass: result.pass,
          intent_id_allow: undefined,
          intent_id_block: undefined,
          latency_allow_ms: result.rowA.latency_ms,
          latency_block_ms: result.rowB.latency_ms,
          gateway_version,
        };
        appendVerificationRecord(record);
        setVerificationHistory(getVerificationHistory());
      } catch (e) {
        console.warn("Verification history persistence failed", e);
      }

      if (!result.pass && !result.inconclusive && (result.rowA.error || result.rowB.error)) {
        const firstError = result.rowA.error || result.rowB.error || "";
        toast({
          title: "Verification failed",
          description: firstError.slice(0, 150),
          variant: "destructive",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Verification failed",
        description: msg.slice(0, 200),
        variant: "destructive",
      });
    } finally {
      setVerificationRunning(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="container mx-auto px-6 py-8 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1">Settings</h1>
            <p className="text-muted-foreground">Configure EDON Console connection and preferences</p>
          </div>

          <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
            <div className="glass-card p-6 h-fit">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Account Overview</h2>
                  <p className="text-sm text-muted-foreground">
                    Key details at a glance without leaving the page.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs uppercase">
                  {planName || "pro"}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Email</p>
                  <p className="mt-2 truncate font-medium">{userEmail || "unknown"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Plan</p>
                  <p className="mt-2 font-medium uppercase">{planName || "pro"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">LLM</p>
                  <p className="mt-2 truncate font-medium">{llmModel} · {llmProvider}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Gateway</p>
                  <p className="mt-2 truncate font-medium">{baseUrl || "not set"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Token</p>
                  <p className="mt-2 font-medium">
                    {savedTokenInfo ? `len ${savedTokenInfo.length}, …${savedTokenInfo.last4}` : "not set"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Connection</p>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        connectionStatus === "connected"
                          ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                          : connectionStatus === "failed"
                            ? "border-red-500/50 text-red-400 bg-red-500/10"
                            : "border-white/10 text-muted-foreground"
                      }`}
                    >
                      {connectionStatus === "connected"
                        ? "Connected"
                        : connectionStatus === "failed"
                          ? "Failed"
                          : "Unknown"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 space-y-8">
            {/* Mock Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" />
                  Mock Mode (Development Only)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use simulated data instead of live EDON Gateway. Disabled by default for production.
                </p>
              </div>
              <Switch
                checked={mockMode}
                onCheckedChange={(checked) => {
                  setMockMode(checked);
                  localStorage.setItem(MOCK_KEY, checked.toString());
                  if (!checked) {
                    toast({
                      title: "Production Mode Enabled",
                      description: "Now connecting to EDON Gateway",
                    });
                  }
                }}
                disabled={isProd}
              />
            </div>
            {isProd && (
              <p className="text-xs text-muted-foreground">Mock mode is disabled in production to ensure live data.</p>
            )}

            <Separator className="bg-white/10" />

            {/* Admin Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Admin Mode (Advanced Tools)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Shows governance smoke tests and verification tools intended for operators.
                </p>
              </div>
              <Switch
                checked={adminMode}
                onCheckedChange={(checked) => {
                  setAdminMode(checked);
                  localStorage.setItem(ADMIN_KEY, checked.toString());
                  toast({
                    title: checked ? "Admin Mode Enabled" : "Admin Mode Disabled",
                    description: checked ? "Advanced tools are now visible." : "Advanced tools are now hidden.",
                  });
                }}
              />
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Connection</p>
                <p className="text-sm text-muted-foreground">Connect your EDON Gateway and credentials.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Base URL */}
                <div className="space-y-3">
                  <Label htmlFor="baseUrl" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    EDON Gateway URL
                  </Label>
                  <Input
                    id="baseUrl"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://127.0.0.1:8000"
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">The base URL of your EDON Gateway instance</p>
                </div>

                {/* API Token */}
                <div className="space-y-3">
                  <Label htmlFor="token" className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    API Token
                  </Label>
                  <Input
                    id="token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter your X-EDON-TOKEN"
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">Paste your EDON API token (minimum 16 characters).</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Saved token: {savedTokenInfo ? `len ${savedTokenInfo.length}, …${savedTokenInfo.last4}` : "not set"}
                    </span>
                    <button type="button" className="hover:text-foreground transition-colors" onClick={refreshSavedTokenInfo}>
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">LLM & Agents</p>
                <p className="text-sm text-muted-foreground">Choose providers, models, and manage agent list.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    LLM Provider
                  </Label>
                  <Select value={llmProvider} onValueChange={setLlmProvider}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                      <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                      <SelectItem value="google">Google (Gemini)</SelectItem>
                      <SelectItem value="mistral">Mistral</SelectItem>
                      <SelectItem value="local">Local / Bring Your Own</SelectItem>
                      <SelectItem value="custom">Custom Endpoint</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the provider your agent will use for LLM calls.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="llmModel" className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Model Name
                  </Label>
                  <Input
                    id="llmModel"
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="Claude Sonnet, GPT-5.2, Gemini 1.5 Pro"
                    className="bg-secondary/50"
                  />
                </div>
              </div>
            </div>

            {(llmProvider === "custom" || llmProvider === "local") && (
              <div className="space-y-3">
                <Label htmlFor="llmCustomUrl" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Custom Model Endpoint
                </Label>
                <Input
                  id="llmCustomUrl"
                  value={llmCustomUrl}
                  onChange={(e) => setLlmCustomUrl(e.target.value)}
                  placeholder="https://your-llm-endpoint"
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Provide a hosted endpoint for your custom or local model.
                </p>
              </div>
            )}

            {llmProvider !== "custom" && llmProvider !== "local" && (
              <div className="space-y-3">
                <Label htmlFor="llmApiKey" className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Provider API Key
                </Label>
                <Input
                  id="llmApiKey"
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder="Paste your provider API key"
                  className="bg-secondary/50"
                />
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Button variant="outline" size="sm" onClick={saveLlmSettings}>
                    Save LLM Settings
                  </Button>
                  {providerLinks[llmProvider] && (
                    <a href={providerLinks[llmProvider]} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="sm">
                        Get API key
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            )}

            {(llmProvider === "custom" || llmProvider === "local") && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Button variant="outline" size="sm" onClick={saveLlmSettings}>
                  Save LLM Settings
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  EDON Managed LLM Billing
                </Label>
                <div className="flex items-center gap-2">
                  {!planAllowsManaged && (
                    <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground">Pro+ users only</Badge>
                  )}
                  <Switch
                    checked={managedBilling}
                    onCheckedChange={(checked) => {
                      if (!planAllowsManaged && checked) {
                        toast({
                          title: "Upgrade required",
                          description: "EDON-managed billing is available on Pro+.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setManagedBilling(checked);
                      localStorage.setItem(MANAGED_BILLING_KEY, checked.toString());
                    }}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, EDON handles LLM usage and billing; provider keys are not required.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="agentId" className="flex items-center gap-2">
                  <UserRound className="w-4 h-4" />
                  Default Agent ID
                </Label>
                <Input
                  id="agentId"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="default-agent"
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">The default agent identifier for API requests</p>
              </div>
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <UserRound className="w-4 h-4" />
                  Add Agent
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="ops-agent"
                    className="bg-secondary/50"
                  />
                  <Button variant="outline" onClick={addAgent}>Add</Button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Chat Tool Name
                </Label>
                <Input
                  value={chatToolName}
                  onChange={(e) => {
                    setChatToolName(e.target.value);
                    localStorage.setItem(CHAT_TOOL_KEY, e.target.value);
                  }}
                  placeholder="chat"
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">Clawdbot tool name used for chat (e.g. llm.chat).</p>
              </div>
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Chat Action
                </Label>
                <Input
                  value={chatToolAction}
                  onChange={(e) => {
                    setChatToolAction(e.target.value);
                    localStorage.setItem(CHAT_ACTION_KEY, e.target.value);
                  }}
                  placeholder="json"
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">Action for the tool (default: json).</p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Chat Credential ID (optional)
              </Label>
              <Input
                value={chatCredentialId}
                onChange={(e) => {
                  setChatCredentialId(e.target.value);
                  localStorage.setItem(CHAT_CREDENTIAL_KEY, e.target.value);
                }}
                placeholder="clawdbot_gateway"
                className="bg-secondary/50"
              />
              <p className="text-xs text-muted-foreground">Use a specific Clawdbot credential if needed.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Add LLM Model
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="Custom Model"
                    className="bg-secondary/50"
                  />
                  <Button variant="outline" onClick={addModel}>Add</Button>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <UserRound className="w-4 h-4" />
                  Agent List
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(agentList.length ? agentList : ["default-agent"]).map((name) => (
                    <Badge key={name} variant="outline" className="text-xs border-white/10">
                      {name}
                      {agentList.includes(name) && (
                        <button type="button" className="ml-2 opacity-60 hover:opacity-100" onClick={() => removeAgent(name)}>
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                LLM List
              </Label>
              <div className="flex flex-wrap gap-2">
                {(llmList.length ? llmList : [llmModel]).map((name) => (
                  <Badge key={name} variant="outline" className="text-xs border-white/10">
                    {name}
                    {llmList.includes(name) && (
                      <button type="button" className="ml-2 opacity-60 hover:opacity-100" onClick={() => removeModel(name)}>
                        ×
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Billing & API Keys</p>
                  <p className="text-sm text-muted-foreground">Get keys directly from your provider.</p>
                </div>
                {billingStatus && (
                  <Badge variant="outline" className="text-xs uppercase">
                    {billingStatus.status}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {providerLinks.anthropic && (
                  <a href={providerLinks.anthropic} target="_blank" rel="noreferrer">
                    <Button variant="outline">Anthropic API Keys</Button>
                  </a>
                )}
                {providerLinks.openai && (
                  <a href={providerLinks.openai} target="_blank" rel="noreferrer">
                    <Button variant="outline">OpenAI API Keys</Button>
                  </a>
                )}
                {providerLinks.google && (
                  <a href={providerLinks.google} target="_blank" rel="noreferrer">
                    <Button variant="outline">Google API Keys</Button>
                  </a>
                )}
                {providerLinks.mistral && (
                  <a href={providerLinks.mistral} target="_blank" rel="noreferrer">
                    <Button variant="outline">Mistral API Keys</Button>
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                EDON does not generate provider keys in production. Use the links above to create keys directly.
              </p>
            </div>

            <Separator className="bg-white/10" />

            {!adminMode ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                Advanced governance tests are hidden. Enable Admin Mode to access smoke tests and verification tools.
              </div>
            ) : (
              <>
                {/* Connection Test */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Connection Status</Label>
                    <Badge
                      variant="outline"
                      className={
                        connectionStatus === "connected"
                          ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                          : connectionStatus === "disconnected" || connectionStatus === "failed"
                          ? "border-red-500/50 text-red-400 bg-red-500/10"
                          : "border-muted-foreground/50 text-muted-foreground"
                      }
                    >
                      {connectionStatus === "connected" ? (
                        <>
                          <Wifi className="w-3 h-3 mr-1" /> Connected
                        </>
                      ) : connectionStatus === "disconnected" || connectionStatus === "failed" ? (
                        <>
                          <WifiOff className="w-3 h-3 mr-1" /> Disconnected
                        </>
                      ) : (
                        "Not Tested"
                      )}
                    </Badge>
                  </div>

                  <Button onClick={testConnection} disabled={testing || mockMode} variant="outline" className="w-full gap-2">
                    {testing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4" />
                        Test Connection
                      </>
                    )}
                  </Button>

                  {mockMode && (
                    <p className="text-xs text-center text-muted-foreground">Disable mock mode to test real connection</p>
                  )}
                </div>

                <Separator className="bg-white/10" />

                {/* Governance Smoke Test */}
                <div className="space-y-4">
                  <Label className="text-base">Governance Smoke Test</Label>
                  <p className="text-sm text-muted-foreground">
                    Verifies gateway connectivity and governance path end-to-end (health, integrations, policy-packs, apply, decisions).
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="policyPack" className="text-sm text-muted-foreground">
                      Policy Pack
                    </Label>
                    <Input
                      id="policyPack"
                      value={policyPack}
                      onChange={(e) => setPolicyPack(e.target.value)}
                      placeholder="clawdbot_safe"
                      className="bg-secondary/50 max-w-xs"
                    />
                  </div>
                  <Button
                    onClick={runSmokeTest}
                    disabled={testing || smokeTestRunning || mockMode || !token.trim() || !baseUrl.trim()}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    {smokeTestRunning ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Running...
                      </>
                    ) : (
                      "Run Smoke Test"
                    )}
                  </Button>

                  {smokeTestResult && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Result:</span>
                        <Badge
                          variant="outline"
                          className={
                            smokeTestResult.ok
                              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                              : "border-red-500/50 text-red-400 bg-red-500/10"
                          }
                        >
                          {smokeTestResult.ok ? "PASS" : "FAIL"}
                        </Badge>
                      </div>
                      {!smokeTestResult.ok && getSmokeTestCause(smokeTestResult.steps) && (
                        <p className="text-xs text-muted-foreground">
                          Most likely cause: {getSmokeTestCause(smokeTestResult.steps)}
                        </p>
                      )}
                      <div className="space-y-2">
                        {smokeTestResult.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="border-b border-white/5 pb-2 last:border-0 last:pb-0 space-y-1"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-mono text-muted-foreground shrink-0">{step.name}</span>
                              <Badge
                                variant="outline"
                                className={
                                  step.ok
                                    ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-xs"
                                    : "border-red-500/50 text-red-400 bg-red-500/10 text-xs"
                                }
                              >
                                {step.ok ? "PASS" : "FAIL"}
                              </Badge>
                              {step.status != null && step.status > 0 && (
                                <span className="text-muted-foreground">{step.status}</span>
                              )}
                              <span className="text-muted-foreground">{step.ms} ms</span>
                              {step.details && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => setExpandedStepIndex(expandedStepIndex === idx ? null : idx)}
                                >
                                  {expandedStepIndex === idx ? "Hide" : "Show"}
                                </Button>
                              )}
                            </div>
                            {step.details && expandedStepIndex === idx && (
                              <pre className="w-full p-2 rounded bg-black/20 text-xs text-muted-foreground overflow-auto max-h-24">
                                {step.details}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Separator className="bg-white/10" />

                {/* Governance Verification Test */}
                <div className="space-y-4">
                  <Label className="text-base">Governance Verification Test</Label>
                  {!hasActiveIntent && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                      No active intent. Apply a policy pack first.
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Proves EDON changes behavior across policy packs: same action → ALLOW under one pack, BLOCK under another.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="allowPack" className="text-sm text-muted-foreground">
                        Allow Policy Pack
                      </Label>
                      <Input
                        id="allowPack"
                        value={allowPack}
                        onChange={(e) => setAllowPack(e.target.value)}
                        placeholder="clawdbot_safe"
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="blockPack" className="text-sm text-muted-foreground">
                        Block Policy Pack
                      </Label>
                      <Input
                        id="blockPack"
                        value={blockPack}
                        onChange={(e) => setBlockPack(e.target.value)}
                        placeholder="personal_safe"
                        className="bg-secondary/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        Pack not found? Choose one from GET /policy-packs.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="toolOp" className="text-sm text-muted-foreground">
                        Test Intent Tool Op
                      </Label>
                      <Input
                        id="toolOp"
                        value={toolOp}
                        onChange={(e) => setToolOp(e.target.value)}
                        placeholder="clawdbot.sessions_list"
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="verificationAgentId" className="text-sm text-muted-foreground">
                        Agent ID
                      </Label>
                      <Input
                        id="verificationAgentId"
                        value={agentId}
                        onChange={(e) => setAgentId(e.target.value)}
                        placeholder="default-agent"
                        className="bg-secondary/50"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={runVerification}
                    disabled={!canRunVerification}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    {verificationRunning ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Running...
                      </>
                    ) : (
                      "Run Verification"
                    )}
                  </Button>
                  {!canRunVerification && (
                    <p className="text-xs text-muted-foreground">
                      {!hasActiveIntent
                        ? "Apply a policy pack on the Policies page first."
                        : "Run Connection Test or pass the Governance Smoke Test first, and ensure token and base URL are set."}
                    </p>
                  )}

                  {verificationResult && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Result:</span>
                        <Badge
                          variant="outline"
                          className={
                            verificationResult.pass
                              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                              : verificationResult.inconclusive
                                ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                                : "border-red-500/50 text-red-400 bg-red-500/10"
                          }
                        >
                          {verificationResult.pass ? "PASS" : verificationResult.inconclusive ? "INCONCLUSIVE" : "FAIL"}
                        </Badge>
                        {verificationResult.inconclusive && (
                          <span className="text-xs text-muted-foreground">
                            {["CONFIRM", "confirm"].some((c) => verificationResult.rowA.verdict?.toUpperCase().includes(c) || verificationResult.rowB.verdict?.toUpperCase().includes(c))
                              ? "One or both verdicts are CONFIRM; expected ALLOW then BLOCK."
                              : `Both packs returned ${verificationResult.rowA.verdict} / ${verificationResult.rowB.verdict}. Expected ALLOW then BLOCK.`}
                          </span>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Pack</th>
                              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Verdict</th>
                              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Decision ID</th>
                              <th className="text-left py-2 text-muted-foreground font-medium">Latency (ms)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-white/5">
                              <td className="py-2 pr-4 font-mono">{verificationResult.rowA.pack}</td>
                              <td className="py-2 pr-4">{verificationResult.rowA.verdict || "—"}</td>
                              <td className="py-2 pr-4 font-mono text-muted-foreground">{verificationResult.rowA.decision_id ?? "—"}</td>
                              <td className="py-2">{verificationResult.rowA.latency_ms ?? "—"}</td>
                            </tr>
                            <tr className="border-b border-white/5">
                              <td className="py-2 pr-4 font-mono">{verificationResult.rowB.pack}</td>
                              <td className="py-2 pr-4">{verificationResult.rowB.verdict || "—"}</td>
                              <td className="py-2 pr-4 font-mono text-muted-foreground">{verificationResult.rowB.decision_id ?? "—"}</td>
                              <td className="py-2">{verificationResult.rowB.latency_ms ?? "—"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {(verificationResult.rowA.error || verificationResult.rowB.error) && (
                        <div className="space-y-1">
                          {(verificationResult.rowA.error?.includes("404") || verificationResult.rowB.error?.includes("404") || verificationResult.rowA.error?.toLowerCase().includes("not found") || verificationResult.rowB.error?.toLowerCase().includes("not found")) && (
                            <p className="text-xs text-amber-500">Pack not found; choose one from GET /policy-packs.</p>
                          )}
                          {verificationResult.rowA.error && (
                            <p className="text-xs text-destructive">Row A: {verificationResult.rowA.error}</p>
                          )}
                          {verificationResult.rowB.error && (
                            <p className="text-xs text-destructive">Row B: {verificationResult.rowB.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Recent Governance Verifications
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                        {verificationHistory.length === 0 ? (
                          <p className="p-4 text-xs text-muted-foreground">No verification runs yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="border-b border-white/10 bg-white/5">
                                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Timestamp</th>
                                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Allow pack → verdict</th>
                                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Block pack → verdict</th>
                                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Result</th>
                                </tr>
                              </thead>
                              <tbody>
                                {verificationHistory.map((r, idx) => (
                                  <tr key={`${r.timestamp}-${idx}`} className="border-b border-white/5 last:border-0">
                                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                                    <td className="py-2 px-3 font-mono">{r.allow_pack} → {r.verdict_allow || "—"}</td>
                                    <td className="py-2 px-3 font-mono">{r.block_pack} → {r.verdict_block || "—"}</td>
                                    <td className="py-2 px-3">
                                      <Badge
                                        variant="outline"
                                        className={r.pass ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-xs" : "border-red-500/50 text-red-400 bg-red-500/10 text-xs"}
                                      >
                                        {r.pass ? "PASS" : "FAIL"}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </>
            )}

            <Separator className="bg-white/10" />

            {/* Save Button */}
            <Button onClick={saveSettings} className="w-full gap-2">
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
