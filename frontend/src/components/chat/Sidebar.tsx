import { useNavigate } from 'react-router-dom';
import {
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  Plus,
  ScanFace,
  Trash2,
  Settings,
  User,
} from 'lucide-react';

import { useChatStore } from '../../store';

export function Sidebar() {
  const {
    sessions,
    activeSessionId,
    healthProfile,
    createSession,
    deleteSession,
    setActiveSession,
    toggleSidebar,
  } = useChatStore();
  const navigate = useNavigate();
  const profileFilled = healthProfile.name || healthProfile.age || healthProfile.conditions;

  return (
    <aside className="bg-surfaceLight/80 backdrop-blur-xl border-r border-black/[0.06] flex h-full w-72 shrink-0 flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.02)_inset]">
      <div className="flex shrink-0 items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
           <div className="bg-primary text-white p-1.5 rounded-xl shadow-sm">
             <HeartPulse className="h-4 w-4" strokeWidth={2} />
           </div>
          <span className="text-[17px] font-semibold tracking-tight text-textMain">MediSonar</span>
        </div>
        <button onClick={toggleSidebar} className="p-1.5 rounded-full hover:bg-black/[0.06] text-textMuted transition-colors active:scale-95">
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={createSession}
          className="flex w-full items-center gap-3 bg-white border border-black/[0.04] shadow-sm rounded-[14px] px-4 py-2.5 text-[15px] font-medium text-textMain transition-all hover:shadow-apple-sm active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 text-primary" />
          New Consultation
        </button>
      </div>

      <div className="px-3 pb-3 space-y-0.5">
        <button
          onClick={() => navigate('/')}
          className="flex w-full items-center gap-3 rounded-[12px] px-4 py-2 text-[15px] font-medium text-textMain hover:bg-black/[0.04] transition-colors"
        >
          <LayoutDashboard className="h-4 w-4 text-textMuted" />
          Dashboard
        </button>
        <button
          onClick={() => navigate('/autism-screening')}
          className="flex w-full items-center gap-3 rounded-[12px] px-4 py-2 text-[15px] font-medium text-textMain hover:bg-black/[0.04] transition-colors"
        >
          <ScanFace className="h-4 w-4 text-textMuted" />
          Vision Module
        </button>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-3">
        <p className="px-4 py-2 text-[12px] font-semibold text-textMuted/70 uppercase tracking-wider">Recents</p>
        <div className="space-y-0.5">
          {[...sessions].reverse().map((session) => (
            <div key={session.id} className="group relative w-full">
              <button
                onClick={() => setActiveSession(session.id)}
                className={`flex w-full items-center gap-3 rounded-[12px] px-4 py-2 text-left text-[14px] font-medium transition-colors ${
                  session.id === activeSessionId ? 'bg-primary text-white shadow-sm' : 'text-textMain hover:bg-black/[0.04]'
                }`}
              >
                <MessageSquare
                  className={`h-4 w-4 shrink-0 ${session.id === activeSessionId ? 'text-white/80' : 'text-textMuted'}`}
                />
                <span className="flex-1 truncate">
                  {session.title}
                </span>
              </button>
              {sessions.length > 1 && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all active:scale-95 ${session.id === activeSessionId ? 'text-white/80 hover:bg-white/20' : 'opacity-0 group-hover:opacity-100 text-textMuted hover:bg-black/[0.06] hover:text-red-500'}`}
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 p-4 border-t border-black/[0.04] bg-surfaceLight/50">
        <button
          onClick={() => navigate('/profile')}
          className="flex w-full items-center gap-3 bg-white p-3 rounded-[16px] shadow-sm border border-black/[0.04] hover:shadow-apple-sm transition-all active:scale-[0.98]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary">
            {profileFilled ? (
              <span className="text-[17px] font-semibold">{(healthProfile.name || 'U').charAt(0).toUpperCase()}</span>
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[14px] font-semibold text-textMain">{healthProfile.name || 'Set Up Profile'}</span>
            <span className="block truncate text-[12px] text-textMuted font-medium">{profileFilled ? 'Apple Health ID' : 'Action Required'}</span>
          </div>
          <Settings className="h-4 w-4 text-textMuted mr-1" />
        </button>
      </div>
    </aside>
  );
}
