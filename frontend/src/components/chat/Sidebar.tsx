import { useNavigate } from 'react-router-dom';
import {
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  Plus,
  ScanFace,
  Trash2,
  User,
  UserCircle,
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
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-wide">MediSonar</span>
        </div>
        <button onClick={toggleSidebar} className="rounded p-1 transition-colors hover:bg-surfaceLight">
          <PanelLeftClose className="h-4 w-4 text-textMuted" />
        </button>
      </div>

      <div className="space-y-2 p-3">
        <button
          onClick={createSession}
          className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-surfaceLight"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-surfaceLight"
        >
          <LayoutDashboard className="h-4 w-4 text-textMuted" />
          Dashboard
        </button>
        <button
          onClick={() => navigate('/autism-screening')}
          className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-surfaceLight"
        >
          <ScanFace className="h-4 w-4 text-textMuted" />
          Autism Vision
        </button>
      </div>

      <div className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-textMuted">Previous Chats</p>
        {[...sessions].reverse().map((session) => (
          <div
            key={session.id}
            className={`group relative w-full rounded-lg transition-colors ${
              session.id === activeSessionId ? 'bg-surfaceLight' : 'hover:bg-surfaceLight/50'
            }`}
          >
            <button
              onClick={() => setActiveSession(session.id)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm"
            >
              <MessageSquare
                className={`h-3.5 w-3.5 shrink-0 ${session.id === activeSessionId ? 'text-primary' : 'text-textMuted'}`}
              />
              <span className={`flex-1 truncate ${session.id === activeSessionId ? 'text-primary' : 'text-textMuted'}`}>
                {session.title}
              </span>
            </button>
            {sessions.length > 1 && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  deleteSession(session.id);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-border"
                aria-label="Delete chat"
              >
                <Trash2 className="h-3.5 w-3.5 text-textMuted hover:text-red-400" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={() => navigate('/profile')}
          className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-surfaceLight"
        >
          <UserCircle className="h-4 w-4 text-textMuted" />
          <span className="truncate text-textMuted">{profileFilled ? (healthProfile.name || 'Edit Profile') : 'Fill Health Profile'}</span>
          {!profileFilled && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-400" />}
        </button>
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surfaceLight">
            {profileFilled ? (
              <span className="text-sm font-medium text-primary">{(healthProfile.name || 'U').charAt(0).toUpperCase()}</span>
            ) : (
              <User className="h-4 w-4 text-textMuted" />
            )}
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-textMain">{healthProfile.name || 'Set your name'}</span>
            <span className="block truncate text-[11px] text-textMuted">{healthProfile.location || 'No location set'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
