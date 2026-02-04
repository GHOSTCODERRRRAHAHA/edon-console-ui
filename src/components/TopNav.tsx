import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Gauge, ListChecks, FileSearch, Settings2, Wifi, WifiOff, PlugZap, KeyRound, Sparkles, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { edonApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChatSidebar } from '@/components/ChatSidebar';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/quickstart', label: 'Quickstart', icon: Sparkles },
  { to: '/decisions', label: 'Decisions', icon: ListChecks },
  { to: '/audit', label: 'Audit', icon: FileSearch },
  { to: '/policies', label: 'Policies', icon: ShieldCheck },
  { to: '/integrations', label: 'Integrations', icon: PlugZap },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

export function TopNav() {
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(true);
  const [hasToken, setHasToken] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem('edon_token'));
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const health = await edonApi.getHealth();
        setIsConnected(true);
        
      } catch {
        setIsConnected(false);
      }
    };

    checkConnection();
    
    // Listen for storage changes (when mock mode is toggled in Settings)
    const handleStorageChange = () => {
      setHasToken(typeof window !== 'undefined' && !!localStorage.getItem('edon_token'));
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('edon-auth-updated', handleStorageChange as EventListener);
    const handleChatOpen = () => setChatOpen(true);
    window.addEventListener('edon-chat-open', handleChatOpen as EventListener);
    window.addEventListener('edon-chat-command', handleChatOpen as EventListener);
    
    const interval = setInterval(() => {
      checkConnection();
      setHasToken(typeof window !== 'undefined' && !!localStorage.getItem('edon_token'));
    }, 30000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('edon-auth-updated', handleStorageChange as EventListener);
      window.removeEventListener('edon-chat-open', handleChatOpen as EventListener);
      window.removeEventListener('edon-chat-command', handleChatOpen as EventListener);
    };
  }, []);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-background/70"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* Wordmark */}
            <div className="flex items-center">
              <span className="edon-brand text-lg font-semibold tracking-[0.3em] text-foreground/90">
                EDON
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`nav-item flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
                      isActive ? 'nav-item-active' : ''
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden md:inline">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="absolute inset-x-2 -bottom-1 h-0.5 bg-primary/80 rounded-full"
                      />
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Status Badges */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="border border-white/10 bg-white/5 text-foreground/80 hover:text-foreground"
                onClick={() => setChatOpen(true)}
                aria-label="Open agent chat sidebar"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              {hasToken && (
                <Badge variant="outline" className="border-cyan-500/50 text-cyan-300 bg-cyan-500/10 flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" />
                  Signed in
                </Badge>
              )}
              <Badge
                variant="outline"
                className={`flex items-center gap-1.5 ${
                  isConnected
                    ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                    : 'border-red-500/50 text-red-400 bg-red-500/10'
                }`}
              >
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </div>
        </div>
      </motion.header>
      <ChatSidebar open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
