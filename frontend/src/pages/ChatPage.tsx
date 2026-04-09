import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText,
  HeartPulse,
  Image as ImageIcon,
  ChevronLeft,
  PanelLeftOpen,
  Paperclip,
  ArrowUp,
  X,
  Lock,
} from 'lucide-react';

import { findSpecialists, generateReport, sendChatMessage, sendChatWithFiles } from '../api';
import { MessageBubble } from '../components/chat/MessageBubble';
import { Sidebar } from '../components/chat/Sidebar';
import { SpecialistResults, type Specialist } from '../components/chat/SpecialistResults';
import { useChatStore } from '../store';

export default function ChatPage() {
  const { sessions, activeSessionId, addMessage, isTyping, setTyping, toggleSidebar, sidebarOpen, healthProfile } = useChatStore();
  const navigate = useNavigate();
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const messages = activeSession?.messages ?? [];
  const userId = healthProfile.name || 'anonymous';

  const [input, setInput] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; type: string; data: string }[]>([]);
  const [specialistResults, setSpecialistResults] = useState<Specialist[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const inferSpecialistFallback = (message: string, aiReply: string) => {
    const loweredMessage = message.toLowerCase();
    const actionRequested = /(connect me|find me|show me|give me|recommend|refer me|book me|help me find|can you connect me|can you find me|i need|i want|can you get me)/i.test(message);
    const providerRequested =
      /(specialist|doctor|physician|clinic|hospital|practitioner)/i.test(message) ||
      /(skin|rash|acne|dermat|heart|chest pain|cardio|lung|breath|asthma|pulmon|brain|seizure|migraine|neuro|child|kid|pediatric|bone|joint|fracture|ortho|stomach|abdomen|liver|gastric|mental|anxiety|depress|psychi|eye|vision|ophthal|ear|nose|throat|ent|general practitioner|primary care|family doctor)/i.test(message);
    const locationHint = /(near me|nearby|in my area)/i.test(message);
    if (!((actionRequested && providerRequested) || (providerRequested && locationHint))) {
      return '';
    }
    const combined = `${loweredMessage} ${aiReply.toLowerCase()}`;

    const specialties: Array<[RegExp, string]> = [
      [/(skin|rash|acne|dermat)/, 'dermatologist'],
      [/(heart|chest pain|cardio)/, 'cardiologist'],
      [/(lung|breath|asthma|pulmon)/, 'pulmonologist'],
      [/(brain|seizure|migraine|neuro)/, 'neurologist'],
      [/(child|kid|pediatric)/, 'pediatrician'],
      [/(bone|joint|fracture|ortho)/, 'orthopedic specialist'],
      [/(stomach|abdomen|liver|gastric)/, 'gastroenterologist'],
      [/(mental|anxiety|depress|psychi)/, 'psychiatrist'],
      [/(eye|vision|ophthal)/, 'ophthalmologist'],
      [/(ear|nose|throat|ent)/, 'ENT specialist'],
      [/(general practitioner|primary care|family doctor)/, 'general practitioner'],
    ];

    for (const [pattern, specialty] of specialties) {
      if (pattern.test(combined)) {
        return specialty;
      }
    }
    return 'general practitioner';
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, specialistResults, scrollToBottom]);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setAttachments((current) => [...current, { name: file.name, type: file.type, data: base64 }]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSpecialistSearch = async (query: string) => {
    if (!query || !healthProfile.location) return;

    try {
      const data = await findSpecialists(query.trim(), healthProfile.location);
      setSpecialistResults(data.specialists ?? []);
      if (data.error && (!data.specialists || data.specialists.length === 0)) {
        addMessage({
          id: (Date.now() + 3).toString(),
          role: 'assistant',
          content: data.error,
        });
      }
    } catch (error) {
      console.error('Specialist search failed:', error);
      addMessage({
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: 'Specialist lookup is unavailable right now. Please try again shortly.',
      });
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    const messageText = input.trim();
    const queuedAttachments = [...attachments];

    setInput('');
    setAttachments([]);
    setSpecialistResults([]);

    const attachmentNames = queuedAttachments.map((file) => file.name).join(', ');
    const displayContent = messageText + (attachmentNames ? `\nAttached: ${attachmentNames}` : '');
    addMessage({ id: Date.now().toString(), role: 'user', content: displayContent });

    setTyping(true);
    try {
      const profileForApi = { ...healthProfile };
      const history = messages
        .filter((message) => message.id !== '1' && !message.id.startsWith('w_'))
        .map((message) => ({ role: message.role, content: message.content }));

      const data =
        queuedAttachments.length > 0
          ? await sendChatWithFiles(userId, messageText, profileForApi, queuedAttachments, history)
          : await sendChatMessage(userId, messageText, profileForApi, history);

      const cleanResponse = data.response.trim();
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', content: cleanResponse });
      const specialistQuery = (data.specialist_query || inferSpecialistFallback(messageText, cleanResponse)).trim();
      if (specialistQuery && !healthProfile.location) {
        addMessage({
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: 'Add your location in the health profile so I can find nearby specialists tailored to you.',
        });
      } else {
        await handleSpecialistSearch(specialistQuery);
      }
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Connection lost. Please try again.';
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', content: message });
    } finally {
      setTyping(false);
    }
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const blob = await generateReport(messages, { ...healthProfile });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'MediSonar_Health_Report.txt';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Report export is unavailable right now. Please try again.';
      addMessage({ id: (Date.now() + 4).toString(), role: 'assistant', content: message });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-background font-sans text-textMain overflow-hidden selection:bg-primary/20">
      <div className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-spring ${sidebarOpen ? 'w-72 border-r border-black/[0.06]' : 'w-0'}`}>
        <Sidebar />
      </div>

      <div className="flex h-screen min-w-0 flex-1 flex-col relative z-0">
        
        <header className="glass-header flex shrink-0 items-center justify-between px-4 sm:px-8 py-3 z-10 transition-all">
          <div className="flex items-center gap-1.5">
            {!sidebarOpen && (
               <button onClick={toggleSidebar} className="p-2 -ml-2 rounded-full hover:bg-black/[0.06] text-primary transition-colors active:scale-95">
                 <PanelLeftOpen className="h-5 w-5" strokeWidth={2.5} />
               </button>
            )}
            <button onClick={() => navigate('/')} className={`flex items-center gap-1 text-primary font-medium hover:opacity-80 transition-all ${!sidebarOpen ? 'ml-0' : '-ml-2'}`}>
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              <span className="hidden sm:inline text-base">Dashboard</span>
            </button>
          </div>

          <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
             <div className="flex items-center gap-1.5">
                <h1 className="font-semibold text-[15px]">{activeSession?.title ?? 'Consultation'}</h1>
             </div>
             <div className="flex items-center gap-1 text-[11px] text-textMuted font-medium">
               <Lock className="w-3 h-3" />
               End-to-End Encrypted
             </div>
          </div>

          <button
            onClick={handleDownloadReport}
            disabled={downloading || messages.length <= 1}
            className="flex items-center gap-1.5 bg-black/[0.05] hover:bg-black/[0.08] text-primary px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{downloading ? 'Extracting...' : 'Export'}</span>
          </button>
        </header>

        <main className="custom-scrollbar flex-1 overflow-y-auto px-4 sm:px-8 pb-4 pt-8">
          <div className="mx-auto w-full max-w-3xl space-y-2 pb-4">
            <div className="mb-12 text-center flex flex-col items-center">
               <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-apple-sm mb-4">
                 <HeartPulse className="h-10 w-10 text-primary" strokeWidth={2} />
               </div>
               <h2 className="text-xl font-semibold mb-1">MediSonar Connect</h2>
               <p className="text-[13px] text-textMuted font-medium">Your private AI care companion.</p>
            </div>

            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>

            <SpecialistResults specialists={specialistResults} />

            {isTyping && (
               <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="flex w-full justify-start mb-6 mt-4">
                <div className="bg-white rounded-[22px] rounded-bl-[6px] border border-black/[0.04] shadow-sm px-4 py-3.5 flex items-center gap-1.5">
                  {[0, 0.2, 0.4].map((delay) => (
                    <motion.div
                      key={delay}
                      className="h-2 w-2 bg-textMuted/40 rounded-full"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay, ease: "easeInOut" }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} className="h-12" />
          </div>
        </main>

        <div className="shrink-0 bg-transparent relative z-10 px-4 py-4 sm:px-8 mb-4">
          <div className="mx-auto max-w-3xl relative">
            
            {attachments.length > 0 && (
              <div className="absolute bottom-full mb-3 flex flex-wrap gap-2 w-full px-2">
                {attachments.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-2 bg-white/90 backdrop-blur-md shadow-apple-sm border border-black/[0.04] rounded-xl px-3 py-2 text-[12px] font-medium transition-all">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button onClick={() => removeAttachment(index)} className="ml-1 text-textMuted hover:bg-black/[0.05] rounded-full p-1 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-white rounded-3xl shadow-apple border border-black/[0.04] p-1.5 transition-all focus-within:shadow-apple-lg focus-within:border-black/[0.08]">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.05] text-textMuted transition-colors active:scale-95"
              >
                <Paperclip className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
              
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Message MediSonar..."
                  className="w-full bg-transparent px-2 py-3 text-[15px] font-medium text-textMain outline-none placeholder:text-textMuted placeholder:font-normal leading-relaxed"
                />
              </div>
              
               <button
                  type="submit"
                  disabled={(!input.trim() && attachments.length === 0) || isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-600 active:scale-95"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
               </button>
            </form>

            <div className="mt-3 text-center opacity-60 text-[11px] text-textMuted font-medium tracking-wide">
                 MediSonar AI can make mistakes. Consider verifying important information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
