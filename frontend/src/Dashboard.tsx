import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from './store';
import { getAdvisories } from './api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartPulse, ArrowRight, MessageSquare,
  MapPin, Calendar, AlertTriangle, AlertCircle, Info, Shield,
  UserCircle, Activity
} from 'lucide-react';

/* ── Advisory Card ────────────────────────────────────────────────── */
const severityConfig: Record<string, { color: string; bg: string; icon: ReactNode; border: string }> = {
  high: { color: 'text-red-400', bg: 'bg-red-400/10', icon: <AlertTriangle className="w-4 h-4" />, border: 'border-red-400/20' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-400/10', icon: <AlertCircle className="w-4 h-4" />, border: 'border-amber-400/20' },
  low: { color: 'text-blue-400', bg: 'bg-blue-400/10', icon: <Info className="w-4 h-4" />, border: 'border-blue-400/20' },
  info: { color: 'text-textMuted', bg: 'bg-surfaceLight', icon: <Shield className="w-4 h-4" />, border: 'border-border' },
};

function AdvisoryCard({ advisory, index }: { advisory: { title: string; severity: string; description: string }; index: number }) {
  const config = severityConfig[advisory.severity] || severityConfig.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className={`bg-surface border rounded-xl p-4 hover:bg-surfaceLight/50 transition-colors ${config.border}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-lg ${config.bg} ${config.color} shrink-0`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-textMain">{advisory.title}</h4>
            <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
              {advisory.severity}
            </span>
          </div>
          <p className="text-xs text-textMuted leading-relaxed">{advisory.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Dashboard ────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const { healthProfile, sessions } = useChatStore();
  const [advisories, setAdvisories] = useState<{ title: string; severity: string; description: string }[]>([]);
  const [loadingAdvisories, setLoadingAdvisories] = useState(true);

  useEffect(() => {
    getAdvisories(healthProfile.location, healthProfile.conditions)
      .then((data) => setAdvisories(data.advisories))
      .finally(() => setLoadingAdvisories(false));
  }, [healthProfile.location, healthProfile.conditions]);

  const profileFilled = healthProfile.name || healthProfile.age || healthProfile.conditions;
  const totalChats = sessions.length;

  const healthTags = [
    ...(healthProfile.conditions ? healthProfile.conditions.split(',').map((c) => c.trim()) : []),
    ...(healthProfile.allergies ? healthProfile.allergies.split(',').map((a) => a.trim()) : []),
  ];

  return (
    <div className="flex h-screen w-screen bg-background text-textMain font-sans overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between p-5 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <HeartPulse className="text-primary w-5 h-5" />
            <h1 className="text-base font-medium tracking-wide">MediSonar</h1>
          </div>
          <div className="text-[11px] text-textMuted flex items-center bg-surfaceLight px-3 py-1.5 rounded-full border border-border">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
            AI Active
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Welcome */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-2xl font-light tracking-wide">
                Welcome back{healthProfile.name ? `, ${healthProfile.name}` : ''}
              </h2>
              <p className="text-sm text-textMuted mt-1">Your health dashboard</p>
            </motion.div>

            {/* Top Row: Profile Tile + Chat Tile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Profile Tile - clickable to /profile */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface border border-border rounded-2xl p-6 cursor-pointer group hover:bg-surfaceLight/30 transition-all"
                onClick={() => navigate('/profile')}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-medium text-textMuted uppercase tracking-wider">Your Profile</h3>
                  <ArrowRight className="w-4 h-4 text-textMuted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>

                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-surfaceLight border border-border flex items-center justify-center shrink-0">
                    {profileFilled ? (
                      <span className="text-lg font-medium text-primary">
                        {(healthProfile.name || 'U').charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <UserCircle className="w-6 h-6 text-textMuted" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-medium truncate">
                      {healthProfile.name || 'Set your name'}
                    </p>
                    <p className="text-xs text-textMuted mt-0.5">
                      {profileFilled ? 'Profile active' : 'Tap to complete'}
                    </p>
                  </div>
                </div>

                {/* Info Row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Age', value: healthProfile.age },
                    { label: 'Gender', value: healthProfile.gender },
                    { label: 'Location', value: healthProfile.location },
                  ].map((f) => (
                    <div key={f.label} className="bg-background rounded-lg p-2.5 border border-border">
                      <p className="text-[10px] text-textMuted uppercase tracking-wider mb-0.5">{f.label}</p>
                      <p className="text-xs font-medium truncate">{f.value || '—'}</p>
                    </div>
                  ))}
                </div>

                {/* Health Tags */}
                {healthTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {healthTags.slice(0, 4).map((tag, i) => (
                      <span key={i} className="text-[11px] bg-surfaceLight border border-border px-2 py-0.5 rounded-full text-textMuted">
                        {tag}
                      </span>
                    ))}
                    {healthTags.length > 4 && (
                      <span className="text-[11px] text-textMuted">+{healthTags.length - 4} more</span>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-textMuted">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{totalChats} chats</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-textMuted">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{profileFilled ? 'Active' : 'Incomplete'}</span>
                  </div>
                </div>
              </motion.div>

              {/* Chat Tile */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="bg-surface border border-border rounded-2xl p-6 cursor-pointer group hover:bg-surfaceLight/30 transition-all flex flex-col justify-between"
                onClick={() => navigate('/chat')}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xs font-medium text-textMuted uppercase tracking-wider">AI Consultation</h3>
                    <ArrowRight className="w-4 h-4 text-textMuted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>

                  <div className="mb-5">
                    <HeartPulse className="w-9 h-9 text-primary mb-3" />
                    <h4 className="text-lg font-medium mb-2">Start a Consultation</h4>
                    <p className="text-sm text-textMuted leading-relaxed">
                      Describe your symptoms or health concerns. MediSonar will analyze them,
                      recommend specialists, and provide personalized guidance.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { icon: <MessageSquare className="w-3.5 h-3.5" />, text: 'AI-powered symptom analysis' },
                    { icon: <UserCircle className="w-3.5 h-3.5" />, text: 'Personalized with your health profile' },
                    { icon: <Shield className="w-3.5 h-3.5" />, text: 'Specialist recommendations included' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs text-textMuted bg-background rounded-lg p-2.5 border border-border">
                      <span className="text-primary">{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Health Advisories Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="bg-surface border border-border rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-textMuted" />
                  <h3 className="text-xs font-medium text-textMuted uppercase tracking-wider">
                    Health Advisories
                    {healthProfile.location && (
                      <span className="text-[11px] font-normal text-textMuted ml-1">
                        — {healthProfile.location}
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-textMuted">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>

              {loadingAdvisories ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2 text-textMuted text-sm">
                    <motion.div className="w-2 h-2 bg-textMuted rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                    <motion.div className="w-2 h-2 bg-textMuted rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                    <motion.div className="w-2 h-2 bg-textMuted rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                  </div>
                </div>
              ) : advisories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <AnimatePresence>
                    {advisories.map((advisory, i) => (
                      <AdvisoryCard key={i} advisory={advisory} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-12 text-textMuted text-sm">
                  <p>Fill in your location in your health profile for personalized advisories.</p>
                </div>
              )}
            </motion.div>

            {/* Disclaimer */}
            <p className="text-center text-[11px] text-textMuted font-medium tracking-wide pb-4">
              MediSonar can make mistakes. Always verify critical medical advice.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
