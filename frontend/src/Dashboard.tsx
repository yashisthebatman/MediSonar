import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  HeartPulse,
  Info,
  MapPin,
  MessageSquare,
  RefreshCw,
  ScanFace,
  Shield,
  User,
} from 'lucide-react';

import { getAdvisories, type Advisory, type AdvisoriesResponse } from './api';
import { useChatStore } from './store';

const ADVISORY_STORAGE_PREFIX = 'medisonar-advisories::';

const severityConfig: Record<string, { color: string; bg: string; icon: ReactNode }> = {
  high: { color: 'text-destructive', bg: 'bg-red-50', icon: <AlertTriangle className="h-5 w-5 text-destructive" /> },
  medium: { color: 'text-orange-600', bg: 'bg-orange-50', icon: <AlertCircle className="h-5 w-5 text-orange-500" /> },
  low: { color: 'text-amber-600', bg: 'bg-amber-50', icon: <Info className="h-5 w-5 text-amber-500" /> },
  info: { color: 'text-primary', bg: 'bg-blue-50', icon: <Shield className="h-5 w-5 text-primary" /> },
};

function AdvisoryCard({ advisory, index }: { advisory: Advisory; index: number }) {
  const config = severityConfig[advisory.severity] || severityConfig.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="cupertino-card"
    >
      <div className="flex items-start gap-4">
        <div className={`shrink-0 p-3 rounded-2xl ${config.bg}`}>{config.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-base font-semibold text-textMain">{advisory.title}</h4>
          </div>
          <p className="text-[15px] leading-relaxed text-textMuted">{advisory.description}</p>
          {(advisory.source || advisory.url) && (
             <div className="mt-4 flex items-center gap-3 text-sm text-textMuted">
              {advisory.source && <span className="font-medium">{advisory.source}</span>}
              {advisory.url && (
                <>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <a href={advisory.url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                    Learn more
                  </a>
                </>
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
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="cupertino-card cupertino-card-hoverable"
      onClick={onClick}
    >
      <div className="flex flex-col h-full">
         <div className="mb-4 text-primary bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center">
            {icon}
         </div>
         <h3 className="text-xl font-semibold text-textMain mb-2">{title}</h3>
         <p className="text-[15px] leading-relaxed text-textMuted flex-1">{description}</p>
         
         <div className="mt-6 flex items-center text-primary font-medium text-[15px] group">
            Open tool
            <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
         </div>
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
  const [advisoryError, setAdvisoryError] = useState('');

  const advisoryStorageKey = `${ADVISORY_STORAGE_PREFIX}${healthProfile.location?.trim().toLowerCase() || 'none'}::${healthProfile.conditions?.trim().toLowerCase() || 'none'}`;

  const readStoredAdvisories = (): AdvisoriesResponse | null => {
    const raw = localStorage.getItem(advisoryStorageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AdvisoriesResponse;
    } catch {
      return null;
    }
  };

  const writeStoredAdvisories = (data: AdvisoriesResponse) => {
    if (data.advisories.length === 0) return;
    localStorage.setItem(advisoryStorageKey, JSON.stringify(data));
  };

  const loadAdvisories = async (forceRefresh = false) => {
    setLoadingAdvisories(true);
    setAdvisoryError('');
    if (!forceRefresh) {
      const stored = readStoredAdvisories();
      if (stored) {
        setAdvisoryState(stored);
      }
    }
    try {
      const data = await getAdvisories(healthProfile.location, healthProfile.conditions, forceRefresh);
      setAdvisoryError(data.error || '');
      if (data.advisories.length > 0) {
        setAdvisoryState(data);
        writeStoredAdvisories(data);
      } else {
        const stored = readStoredAdvisories();
        if (stored) {
          setAdvisoryState(stored);
        } else {
          setAdvisoryState(data);
        }
      }
    } catch (error) {
      console.error('Advisory loading failed:', error);
      setAdvisoryError('Local advisories unavailable at this time.');
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-textMain font-sans select-none">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="glass-header flex shrink-0 items-center justify-between px-6 lg:px-10 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-white p-2 rounded-2xl shadow-sm">
              <HeartPulse className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight leading-none mb-0.5">MediSonar</h1>
              <p className="text-[13px] text-textMuted font-medium">Health Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="hidden sm:inline text-sm font-medium text-textMuted">System Active</span>
          </div>
        </header>

        <main className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
          <div className="mx-auto max-w-6xl space-y-12">
            
            {/* Greeting Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="pt-4">
              <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-textMain">
                Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
                {healthProfile.name ? `, ${healthProfile.name.split(' ')[0]}` : ''}.
              </h2>
              <p className="mt-3 text-lg text-textMuted font-medium max-w-2xl">
                Here's your regional health update and tool access.
              </p>
            </motion.div>

            {/* Main Cards Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              
              {/* Profile Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="cupertino-card cupertino-card-hoverable flex flex-col"
                onClick={() => navigate('/profile')}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary data-[filled=true]:bg-primary data-[filled=true]:text-white">
                    {profileFilled ? (
                      <span className="text-2xl font-semibold">{(healthProfile.name || 'U').charAt(0).toUpperCase()}</span>
                    ) : (
                       <User className="h-6 w-6" strokeWidth={2} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{healthProfile.name || 'Set up profile'}</h3>
                    <p className="text-sm text-textMuted">{profileFilled ? 'All systems nominal' : 'Action required'}</p>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="flex justify-between items-center py-2 border-b border-black/[0.04]">
                     <span className="text-sm text-textMuted">Location</span>
                     <span className="text-sm font-medium">{healthProfile.location || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-black/[0.04]">
                     <span className="text-sm text-textMuted">Vitals Base</span>
                     <span className="text-sm font-medium">
                       {healthProfile.age ? `${healthProfile.age}y` : '--'} - {healthProfile.gender || '--'}
                     </span>
                  </div>
                   <div className="flex justify-between items-center py-2">
                     <span className="text-sm text-textMuted">Consultations</span>
                     <span className="text-sm font-medium">{totalChats} logs</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center text-primary font-medium text-[15px] group">
                    View settings
                    <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.div>

              <DashboardCard
                title="Consultation"
                description="Securely chat about symptoms, get AI triage advice, and find local specialists grounded by live data."
                icon={<MessageSquare className="h-6 w-6" strokeWidth={2} />}
                onClick={() => navigate('/chat')}
              />

              <DashboardCard
                title="Autism Vision Check"
                description="Use your device's camera for an advanced ResNet50 vision checkpoint analyzing facial expressions."
                icon={<ScanFace className="h-6 w-6" strokeWidth={2} />}
                onClick={() => navigate('/autism-screening')}
              />
            </div>

            {/* Advisories Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-6 flex flex-wrap items-end justify-between gap-6 px-2">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-textMain">Local Health Advisories</h3>
                  <p className="mt-1 flex items-center gap-2 text-sm text-textMuted">
                    <MapPin className="h-4 w-4" />
                    {healthProfile.location || 'Location not set'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-textMuted font-medium bg-black/[0.04] px-3 py-1.5 rounded-full">
                    {advisoryState.cached ? 'Cached' : 'Live updates'}
                  </span>
                  <button
                    onClick={() => loadAdvisories(true)}
                    className="apple-button-secondary py-1.5"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>

              {loadingAdvisories ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-4 text-textMuted">
                    <RefreshCw className="h-8 w-8 animate-spin opacity-50" />
                    <span className="text-[15px] font-medium">Fetching advisories...</span>
                  </div>
                </div>
              ) : advisoryState.advisories.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <AnimatePresence>
                    {advisoryState.advisories.map((advisory, index) => (
                      <AdvisoryCard key={`${advisory.title}-${index}`} advisory={advisory} index={index} />
                    ))}
                  </AnimatePresence>
                </div>
              ) : advisoryError ? (
                <div className="bg-red-50 rounded-3xl p-8 text-center">
                  <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
                  <p className="text-[15px] font-medium text-destructive">{advisoryError}</p>
                </div>
              ) : (
                <div className="bg-white/50 border border-black/[0.04] rounded-[24px] p-16 text-center">
                  <Shield className="mx-auto mb-4 h-10 w-10 text-primary opacity-50" />
                  <h4 className="text-lg font-semibold text-textMain mb-2">No active advisories</h4>
                  <p className="text-[15px] text-textMuted max-w-md mx-auto">
                    There are no current health advisories matching your location and profile data. 
                    Set a location in your profile to enable live tracking.
                  </p>
                  <button onClick={() => navigate('/profile')} className="apple-button mt-6">
                    Update Profile
                  </button>
                </div>
              )}
            </motion.div>

            <p className="pb-10 pt-4 text-center text-[13px] font-medium text-textMuted opacity-70">
              Not for clinical diagnosis. Consult a verified physician.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
