import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  File,
  FileText,
  HeartPulse,
  Image as ImageIcon,
  LayoutDashboard,
  PanelLeftOpen,
  Paperclip,
  Send,
  X,
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

  const handleSpecialistSearch = async (aiResponse: string) => {
    const match = aiResponse.match(/\[FIND_SPECIALIST\]\s*(.+)/i);
    if (!match || !healthProfile.location) return;

    try {
      const data = await findSpecialists(match[1].trim(), healthProfile.location);
      setSpecialistResults(data.specialists ?? []);
    } catch (error) {
      console.error('Specialist search failed:', error);
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

      const cleanResponse = data.response.replace(/\[FIND_SPECIALIST\]\s*.+/gi, '').trim();
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', content: cleanResponse });
      await handleSpecialistSearch(data.response);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Error connecting to the MediSonar backend.';
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
      anchor.download = 'medisonar_report.txt';
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-textMain">
      <div className={`shrink-0 overflow-hidden transition-[width] duration-300 ${sidebarOpen ? 'w-72' : 'w-0'}`}>
        <Sidebar />
      </div>

      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-[65px] shrink-0 items-center justify-between border-b border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="rounded-lg p-1.5 transition-colors hover:bg-surfaceLight" title="Dashboard">
              <LayoutDashboard className="h-5 w-5 text-textMuted" />
            </button>
            {!sidebarOpen && (
              <button onClick={toggleSidebar} className="rounded-lg p-1.5 transition-colors hover:bg-surfaceLight">
                <PanelLeftOpen className="h-5 w-5 text-textMuted" />
              </button>
            )}
            <h1 className="truncate text-base font-medium text-textMain">{activeSession?.title ?? 'MediSonar'}</h1>
          </div>

          <button
            onClick={handleDownloadReport}
            disabled={downloading || messages.length <= 1}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surfaceLight px-3 py-1.5 text-[11px] text-textMuted transition-colors hover:bg-border disabled:opacity-40"
          >
            <FileText className="h-3.5 w-3.5" />
            {downloading ? 'Generating...' : 'Download Report'}
          </button>
        </header>

        <main className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-3xl space-y-6 pb-4">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>

            <SpecialistResults specialists={specialistResults} />

            {isTyping && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex w-full justify-start">
                <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surfaceLight">
                  <HeartPulse className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center space-x-2 rounded-2xl rounded-tl-sm border border-border bg-surface px-5 py-4">
                  {[0, 0.2, 0.4].map((delay) => (
                    <motion.div
                      key={delay}
                      className="h-2 w-2 rounded-full bg-textMuted"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </main>

        <div className="shrink-0 border-t border-border bg-background px-4 pb-4 pt-3">
          <div className="mx-auto max-w-3xl">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="h-3 w-3 text-textMuted" />
                    ) : (
                      <File className="h-3 w-3 text-textMuted" />
                    )}
                    <span className="max-w-[120px] truncate text-textMuted">{file.name}</span>
                    <button onClick={() => removeAttachment(index)} className="text-textMuted transition-colors hover:text-textMain">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="group relative flex items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-2 rounded-full p-2 text-textMuted transition-colors hover:bg-surfaceLight hover:text-textMain"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message MediSonar..."
                className="w-full rounded-full border border-border bg-surface py-4 pl-12 pr-14 text-[15px] text-textMain outline-none transition-colors duration-200 placeholder-textMuted hover:bg-surfaceLight/50 focus:border-border focus:bg-surfaceLight"
              />
              <button
                type="submit"
                disabled={(!input.trim() && attachments.length === 0) || isTyping}
                className="absolute right-2 flex items-center justify-center rounded-full bg-white p-2.5 text-black transition-all duration-200 hover:bg-gray-200 disabled:bg-surfaceLight disabled:text-textMuted"
              >
                <Send className="ml-0.5 h-4 w-4" />
              </button>
            </form>

            <div className="mt-3 flex justify-center text-center">
              <p className="text-[11px] font-medium tracking-wide text-textMuted">
                MediSonar can make mistakes. Always verify critical medical advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
