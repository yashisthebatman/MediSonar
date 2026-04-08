import { useState, useRef, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useChatStore } from './store';
import { sendChatMessage, sendChatWithFiles, generateReport, findSpecialists } from './api';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, HeartPulse, User, PanelLeftClose, PanelLeftOpen,
  Plus, MessageSquare, Copy, Check, Trash2, FileText,
  UserCircle, LayoutDashboard, Paperclip, Image as ImageIcon, File, X,
  MapPin, Phone, Star, Stethoscope
} from 'lucide-react';
import Dashboard from './Dashboard';
import ProfilePage from './ProfilePage';

/* ── Specialist Card ─────────────────────────────────────────────── */
function SpecialistCard({ specialist }: { specialist: Record<string, string> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="specialist-card"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-surfaceLight flex items-center justify-center shrink-0 border border-border">
          <Stethoscope className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-textMain">{specialist.name}</h4>
          <p className="text-xs text-primary mt-0.5">{specialist.specialty}</p>
          {specialist.address && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-textMuted">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{specialist.address}</span>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            {specialist.phone && (
              <div className="flex items-center gap-1 text-xs text-textMuted">
                <Phone className="w-3 h-3" />
                <span>{specialist.phone}</span>
              </div>
            )}
            {specialist.rating && (
              <div className="flex items-center gap-1 text-xs text-amber-400">
                <Star className="w-3 h-3" />
                <span>{specialist.rating}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────────── */
function Sidebar() {
  const {
    sessions, activeSessionId, healthProfile,
    createSession, deleteSession, setActiveSession,
    toggleSidebar,
  } = useChatStore();
  const navigate = useNavigate();

  const profileFilled = healthProfile.name || healthProfile.age || healthProfile.conditions;

  return (
    <aside className="w-72 h-full bg-surface border-r border-border flex flex-col shrink-0">
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <HeartPulse className="text-primary w-5 h-5" />
          <span className="font-semibold text-sm tracking-wide">MediSonar</span>
        </div>
        <button onClick={toggleSidebar} className="p-1 hover:bg-surfaceLight rounded transition-colors">
          <PanelLeftClose className="w-4 h-4 text-textMuted" />
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={createSession}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm hover:bg-surfaceLight transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-0.5">
        <p className="text-[11px] text-textMuted uppercase tracking-wider font-medium px-3 py-2">Previous Chats</p>
        {[...sessions].reverse().map((session) => (
          <div
            key={session.id}
            className={`group relative w-full rounded-lg transition-colors
              ${session.id === activeSessionId ? 'bg-surfaceLight' : 'hover:bg-surfaceLight/50'}`}
          >
            <button
              onClick={() => setActiveSession(session.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm truncate flex items-center gap-2"
            >
              <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${session.id === activeSessionId ? 'text-primary' : 'text-textMuted'}`} />
              <span className={`truncate flex-1 ${session.id === activeSessionId ? 'text-primary' : 'text-textMuted'}`}>
                {session.title}
              </span>
            </button>
            {sessions.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-border rounded"
                aria-label="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5 text-textMuted hover:text-red-400" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Profile link */}
      <div className="px-3 pb-2">
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm hover:bg-surfaceLight transition-colors"
        >
          <UserCircle className="w-4 h-4 text-textMuted" />
          <span className="text-textMuted truncate">{profileFilled ? (healthProfile.name || 'Edit Profile') : 'Fill Health Profile'}</span>
          {!profileFilled && <span className="ml-auto w-2 h-2 bg-red-400 rounded-full shrink-0" />}
        </button>
      </div>

      {/* Profile name footer */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surfaceLight border border-border flex items-center justify-center shrink-0">
            {profileFilled ? (
              <span className="text-sm font-medium text-primary">
                {(healthProfile.name || 'U').charAt(0).toUpperCase()}
              </span>
            ) : (
              <User className="w-4 h-4 text-textMuted" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-textMain text-sm font-medium truncate">
              {healthProfile.name || 'Set your name'}
            </span>
            <span className="text-[11px] text-textMuted truncate">
              {healthProfile.location || 'No location set'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Message Bubble ───────────────────────────────────────────────── */
function MessageBubble({ message }: { message: { id: string; role: 'user' | 'assistant'; content: string } }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {message.role === 'assistant' && (
        <div className="w-8 h-8 rounded-full bg-surfaceLight flex items-center justify-center mr-3 mt-1 shrink-0 border border-border">
          <HeartPulse className="text-primary w-4 h-4" />
        </div>
      )}
      <div className={`relative max-w-[85%] sm:max-w-[75%] px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed group
        ${message.role === 'user' ? 'bg-white text-black rounded-tr-sm' : 'bg-surface text-textMain rounded-tl-sm border border-border'}`}>
        {message.role === 'assistant' ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        )}
        {message.role === 'assistant' && (
          <button onClick={handleCopy}
            className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surfaceLight border border-border rounded p-1">
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-textMuted" />}
          </button>
        )}
      </div>
      {message.role === 'user' && (
        <div className="w-8 h-8 rounded-full bg-surfaceLight flex items-center justify-center ml-3 mt-1 shrink-0 border border-border">
          <User className="text-primary w-4 h-4" />
        </div>
      )}
    </motion.div>
  );
}

/* ── Specialist Results Block ─────────────────────────────────────── */
function SpecialistResults({ specialists }: { specialists: Record<string, string>[] }) {
  if (!specialists || specialists.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex w-full justify-start"
    >
      <div className="w-8 h-8 rounded-full bg-surfaceLight flex items-center justify-center mr-3 mt-1 shrink-0 border border-border">
        <Stethoscope className="text-primary w-4 h-4" />
      </div>
      <div className="max-w-[85%] sm:max-w-[75%] space-y-2">
        <p className="text-xs text-textMuted font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <MapPin className="w-3 h-3" /> Specialists Near You
        </p>
        {specialists.map((s, i) => (
          <SpecialistCard key={i} specialist={s} />
        ))}
        <p className="text-[11px] text-textMuted mt-2 italic">
          Results from Google Search. Please verify details before visiting.
        </p>
      </div>
    </motion.div>
  );
}

/* ── Chat Page ────────────────────────────────────────────────────── */
function ChatPage() {
  const {
    sessions, activeSessionId, addMessage, isTyping, setTyping,
    toggleSidebar, sidebarOpen, healthProfile,
  } = useChatStore();

  const navigate = useNavigate();
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];
  const userId = useChatStore((s) => s.healthProfile.name) || 'anonymous';

  const [input, setInput] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; type: string; data: string }[]>([]);
  const [specialistResults, setSpecialistResults] = useState<Record<string, string>[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, specialistResults, scrollToBottom]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setAttachments((prev) => [...prev, { name: file.name, type: file.type, data: base64 }]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSpecialistSearch = async (aiResponse: string) => {
    // Check if AI flagged a specialist search
    const match = aiResponse.match(/\[FIND_SPECIALIST\]\s*(.+)/i);
    if (!match) return;

    const specialistType = match[1].trim();
    const location = healthProfile.location;
    if (!location) return;

    try {
      const data = await findSpecialists(specialistType, location);
      if (data.specialists && data.specialists.length > 0) {
        setSpecialistResults(data.specialists);
      }
    } catch (err) {
      console.error('Specialist search failed:', err);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    const userMsg = input.trim();
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setSpecialistResults(null);

    const attachmentNames = currentAttachments.map((a) => a.name).join(', ');
    const displayContent = userMsg + (attachmentNames ? `\n📎 ${attachmentNames}` : '');
    addMessage({ id: Date.now().toString(), role: 'user', content: displayContent });

    setTyping(true);
    try {
      const profileForApi = {
        name: healthProfile.name,
        age: healthProfile.age,
        gender: healthProfile.gender,
        location: healthProfile.location,
        conditions: healthProfile.conditions,
        allergies: healthProfile.allergies,
        medications: healthProfile.medications,
        weight: healthProfile.weight,
        height: healthProfile.height,
        bloodGroup: healthProfile.bloodGroup,
      };

      // Build history from current session messages (excluding the welcome message and current user message)
      const history = messages
        .filter(m => m.id !== '1' && !m.id.startsWith('w_'))
        .map(m => ({ role: m.role, content: m.content }));

      let data;
      if (currentAttachments.length > 0) {
        data = await sendChatWithFiles(userId, userMsg, profileForApi, currentAttachments, history);
      } else {
        data = await sendChatMessage(userId, userMsg, profileForApi, history);
      }

      // Clean the [FIND_SPECIALIST] tag from visible response
      const cleanResponse = data.response.replace(/\[FIND_SPECIALIST\]\s*.+/gi, '').trim();
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', content: cleanResponse });

      // Trigger specialist search if flagged
      await handleSpecialistSearch(data.response);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Error connecting to MediSonar backend.';
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', content: msg });
    } finally {
      setTyping(false);
    }
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const blob = await generateReport(messages, {
        name: healthProfile.name,
        age: healthProfile.age,
        gender: healthProfile.gender,
        location: healthProfile.location,
        conditions: healthProfile.conditions,
        allergies: healthProfile.allergies,
        medications: healthProfile.medications,
        weight: healthProfile.weight,
        height: healthProfile.height,
        bloodGroup: healthProfile.bloodGroup,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'medisonar_report.txt';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-background text-textMain font-sans overflow-hidden">
      <div className={`shrink-0 overflow-hidden transition-[width] duration-300 ${sidebarOpen ? 'w-72' : 'w-0'}`}>
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Header */}
        <header className="flex items-center p-4 border-b border-border bg-surface shrink-0 h-[65px] justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 hover:bg-surfaceLight rounded-lg transition-colors" title="Dashboard">
              <LayoutDashboard className="w-5 h-5 text-textMuted" />
            </button>
            {!sidebarOpen && (
              <button onClick={toggleSidebar} className="p-1.5 hover:bg-surfaceLight rounded-lg transition-colors">
                <PanelLeftOpen className="w-5 h-5 text-textMuted" />
              </button>
            )}
            <h1 className="text-base font-medium text-textMain truncate">
              {activeSession?.title ?? 'MediSonar'}
            </h1>
          </div>
          <button
            onClick={handleDownloadReport}
            disabled={downloading || messages.length <= 1}
            className="flex items-center gap-1.5 text-[11px] text-textMuted bg-surfaceLight px-3 py-1.5 rounded-full border border-border hover:bg-border transition-colors disabled:opacity-40"
          >
            <FileText className="w-3.5 h-3.5" />
            {downloading ? 'Generating...' : 'Download Report'}
          </button>
        </header>

        {/* Chat Area — scrollable, fills remaining space */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          <div className="w-full max-w-3xl mx-auto space-y-6 pb-4">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </AnimatePresence>

            {/* Specialist results */}
            {specialistResults && specialistResults.length > 0 && (
              <SpecialistResults specialists={specialistResults} />
            )}

            {isTyping && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full justify-start mt-4">
                <div className="w-8 h-8 rounded-full bg-surfaceLight flex items-center justify-center mr-3 mt-1 shrink-0 border border-border">
                  <HeartPulse className="text-primary w-4 h-4" />
                </div>
                <div className="bg-surface border border-border px-5 py-4 rounded-2xl rounded-tl-sm flex items-center space-x-2">
                  <motion.div className="w-2 h-2 bg-textMuted rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                  <motion.div className="w-2 h-2 bg-textMuted rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                  <motion.div className="w-2 h-2 bg-textMuted rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </main>

        {/* Input Area — fixed at bottom of flex column, NOT absolute */}
        <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-4">
          <div className="max-w-3xl mx-auto">
            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="w-3 h-3 text-textMuted" />
                    ) : (
                      <File className="w-3 h-3 text-textMuted" />
                    )}
                    <span className="text-textMuted truncate max-w-[120px]">{file.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-textMuted hover:text-textMain">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="relative flex items-center group">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-2 p-2 hover:bg-surfaceLight rounded-full transition-colors text-textMuted hover:text-textMain"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message MediSonar..."
                className="w-full bg-surface focus:bg-surfaceLight hover:bg-surfaceLight/50 transition-colors duration-200 border border-border focus:border-border rounded-full pl-12 pr-14 py-4 text-[15px] outline-none text-textMain placeholder-textMuted"
              />
              <button
                type="submit"
                disabled={(!input.trim() && attachments.length === 0) || isTyping}
                className="absolute right-2 p-2.5 bg-white hover:bg-gray-200 disabled:bg-surfaceLight disabled:text-textMuted transition-all duration-200 rounded-full text-black active:scale-95 flex items-center justify-center"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
            <div className="text-center mt-3 flex justify-center">
              <p className="text-[11px] text-textMuted font-medium tracking-wide">
                MediSonar can make mistakes. Always verify critical medical advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── App Router ────────────────────────────────────────────────────── */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/chat" element={<ChatPage />} />
    </Routes>
  );
}
