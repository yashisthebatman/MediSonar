import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  HeartPulse,
  Info,
  MapPin,
  MessageSquare,
  RefreshCw,
  ScanFace,
  Shield,
  UserCircle,
} from 'lucide-react';

import { getAdvisories, type Advisory, type AdvisoriesResponse } from './api';
import { useChatStore } from './store';

const severityConfig: Record<string, { color: string; bg: string; icon: ReactNode; border: string }> = {
  high: { color: 'text-red-400', bg: 'bg-red-400/10', icon: <AlertTriangle className="h-4 w-4" />, border: 'border-red-400/20' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-400/10', icon: <AlertCircle className="h-4 w-4" />, border: 'border-amber-400/20' },
  low: { color: 'text-blue-400', bg: 'bg-blue-400/10', icon: <Info className="h-4 w-4" />, border: 'border-blue-400/20' },
  info: { color: 'text-textMuted', bg: 'bg-surfaceLight', icon: <Shield className="h-4 w-4" />, border: 'border-border' },
};

function AdvisoryCard({ advisory, index }: { advisory: Advisory; index: number }) {
  const config = severityConfig[advisory.severity] || severityConfig.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className={`rounded-xl border bg-surface p-4 transition-colors hover:bg-surfaceLight/50 ${config.border}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${config.bg} ${config.color}`}>{config.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium text-textMain">{advisory.title}</h4>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${config.bg} ${config.color}`}>
              {advisory.severity}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-textMuted">{advisory.description}</p>
          {(advisory.source || advisory.url) && (
            <div className="mt-3 text-[11px] text-textMuted">
              {advisory.source && <span>{advisory.source}</span>}
              {advisory.url && (
                <a href={advisory.url} target="_blank" rel="noreferrer" className="ml-2 text-primary underline underline-offset-2">
                  Source
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DashboardCard({
  title,
  description,
  icon,
  onClick,
  features,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  features: string[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex cursor-pointer flex-col justify-between rounded-2xl border border-border bg-surface p-6 transition-all hover:bg-surfaceLight/30"
      onClick={onClick}
    >
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-textMuted">{title}</h3>
          <ArrowRight className="h-4 w-4 text-textMuted transition-all hover:translate-x-1 hover:text-primary" />
        </div>
        <div className="mb-5">
          <div className="mb-3 text-primary">{icon}</div>
          <p className="text-sm leading-relaxed text-textMuted">{description}</p>
        </div>
      </div>
      <div className="space-y-2">
        {features.map((feature) => (
          <div key={feature} className="rounded-lg border border-border bg-background p-2.5 text-xs text-textMuted">
            {feature}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { healthProfile, sessions } = useChatStore();
  const [advisoryState, setAdvisoryState] = useState<AdvisoriesResponse>({
    advisories: [],
    cached: false,
    fetched_at: undefined,
    expires_at: undefined,
  });
  const [loadingAdvisories, setLoadingAdvisories] = useState(true);

  const loadAdvisories = async (forceRefresh = false) => {
    setLoadingAdvisories(true);
    try {
      const data = await getAdvisories(healthProfile.location, healthProfile.conditions, forceRefresh);
      setAdvisoryState(data);
    } finally {
      setLoadingAdvisories(false);
    }
  };

  useEffect(() => {
    loadAdvisories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthProfile.location, healthProfile.conditions]);

  const profileFilled = healthProfile.name || healthProfile.age || healthProfile.conditions;
  const totalChats = sessions.length;
  const healthTags = [
    ...(healthProfile.conditions ? healthProfile.conditions.split(',').map((value) => value.trim()).filter(Boolean) : []),
    ...(healthProfile.allergies ? healthProfile.allergies.split(',').map((value) => value.trim()).filter(Boolean) : []),
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-textMain">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <HeartPulse className="h-5 w-5 text-primary" />
            <h1 className="text-base font-medium tracking-wide">MediSonar</h1>
          </div>
          <div className="flex items-center rounded-full border border-border bg-surfaceLight px-3 py-1.5 text-[11px] text-textMuted">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-green-500" />
            AI Active
          </div>
        </header>

        <main className="custom-scrollbar flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mx-auto max-w-6xl space-y-8">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-2xl font-light tracking-wide">Welcome back{healthProfile.name ? `, ${healthProfile.name}` : ''}</h2>
              <p className="mt-1 text-sm text-textMuted">Your health dashboard, grounded advisories, and vision tools.</p>
            </motion.div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_1fr_1fr]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="cursor-pointer rounded-2xl border border-border bg-surface p-6 transition-all hover:bg-surfaceLight/30"
                onClick={() => navigate('/profile')}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-textMuted">Your Profile</h3>
                  <ArrowRight className="h-4 w-4 text-textMuted transition-all hover:translate-x-1 hover:text-primary" />
                </div>

                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-surfaceLight">
                    {profileFilled ? (
                      <span className="text-lg font-medium text-primary">{(healthProfile.name || 'U').charAt(0).toUpperCase()}</span>
                    ) : (
                      <UserCircle className="h-6 w-6 text-textMuted" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{healthProfile.name || 'Set your name'}</p>
                    <p className="mt-0.5 text-xs text-textMuted">{profileFilled ? 'Profile active' : 'Tap to complete'}</p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Age', value: healthProfile.age },
                    { label: 'Gender', value: healthProfile.gender },
                    { label: 'Location', value: healthProfile.location },
                  ].map((field) => (
                    <div key={field.label} className="rounded-lg border border-border bg-background p-2.5">
                      <p className="mb-0.5 text-[10px] uppercase tracking-wider text-textMuted">{field.label}</p>
                      <p className="truncate text-xs font-medium">{field.value || '-'}</p>
                    </div>
                  ))}
                </div>

                {healthTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {healthTags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full border border-border bg-surfaceLight px-2 py-0.5 text-[11px] text-textMuted">
                        {tag}
                      </span>
                    ))}
                    {healthTags.length > 4 && <span className="text-[11px] text-textMuted">+{healthTags.length - 4} more</span>}
                  </div>
                )}

                <div className="mt-5 flex items-center gap-4 border-t border-border pt-4">
                  <div className="flex items-center gap-1.5 text-xs text-textMuted">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{totalChats} chats</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-textMuted">
                    <Activity className="h-3.5 w-3.5" />
                    <span>{profileFilled ? 'Active' : 'Incomplete'}</span>
                  </div>
                </div>
              </motion.div>

              <DashboardCard
                title="AI Consultation"
                description="Describe symptoms, attach images, get grounded responses, and pull specialist recommendations into the chat flow."
                icon={<HeartPulse className="h-9 w-9" />}
                onClick={() => navigate('/chat')}
                features={[
                  'AI-powered symptom analysis',
                  'Profile-aware replies and chat memory',
                  'Grounded specialist search results',
                ]}
              />

              <DashboardCard
                title="Autism Vision"
                description="Run the provided ResNet50 checkpoint on webcam or uploaded face images through a dedicated browser camera workflow."
                icon={<ScanFace className="h-9 w-9" />}
                onClick={() => navigate('/autism-screening')}
                features={[
                  'Laptop webcam capture',
                  'External camera / Photon selection',
                  'Research-only model confidence view',
                ]}
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-textMuted" />
                  <h3 className="text-xs font-medium uppercase tracking-wider text-textMuted">
                    Health Advisories
                    {healthProfile.location && <span className="ml-1 text-[11px] font-normal text-textMuted">for {healthProfile.location}</span>}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-textMuted">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <span>{advisoryState.cached ? 'Cached result' : 'Fresh search'}</span>
                  <button
                    onClick={() => loadAdvisories(true)}
                    className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 transition-colors hover:bg-surfaceLight"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh now
                  </button>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-border bg-background/50 p-4 text-sm text-textMuted">
                Advisories are cached for 20 minutes to keep the dashboard fast and resilient when grounded search is slow or temporarily inconsistent.
              </div>

              {loadingAdvisories ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2 text-sm text-textMuted">
                    {[0, 0.2, 0.4].map((delay) => (
                      <motion.div
                        key={delay}
                        className="h-2 w-2 rounded-full bg-textMuted"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay }}
                      />
                    ))}
                  </div>
                </div>
              ) : advisoryState.advisories.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <AnimatePresence>
                    {advisoryState.advisories.map((advisory, index) => (
                      <AdvisoryCard key={`${advisory.title}-${index}`} advisory={advisory} index={index} />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-textMuted">
                  <p>Fill in your location in your health profile for personalized advisories.</p>
                </div>
              )}
            </motion.div>

            <p className="pb-4 text-center text-[11px] font-medium tracking-wide text-textMuted">
              MediSonar can make mistakes. Always verify critical medical advice.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
