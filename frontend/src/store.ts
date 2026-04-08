import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface HealthProfile {
  name: string;
  age: string;
  gender: string;
  location: string;
  conditions: string;
  allergies: string;
  medications: string;
  weight: string;
  height: string;
  bloodGroup: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string;
  isTyping: boolean;
  sidebarOpen: boolean;
  healthProfile: HealthProfile;
  createSession: () => void;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  addMessage: (msg: Message) => void;
  setTyping: (typing: boolean) => void;
  toggleSidebar: () => void;
  setHealthProfile: (profile: HealthProfile) => void;
}

const firstSessionId = 'session_1';
const welcomeMsg: Message = {
  id: '1',
  role: 'assistant',
  content: 'Welcome to **MediSonar** 👋\n\nI\'m your AI health assistant. I can help you:\n\n- 🔍 **Analyze symptoms** and suggest possible causes\n- 🏥 **Find specialists** near your location\n- 📋 **Generate health reports** from our conversation\n- 💊 **Provide personalized guidance** based on your health profile\n\nHow can I help you today?'
};

const defaultSession: ChatSession = {
  id: firstSessionId,
  title: 'New Chat',
  messages: [welcomeMsg],
  createdAt: Date.now(),
};

const emptyProfile: HealthProfile = {
  name: '',
  age: '',
  gender: '',
  location: '',
  conditions: '',
  allergies: '',
  medications: '',
  weight: '',
  height: '',
  bloodGroup: '',
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessions: [defaultSession],
      activeSessionId: firstSessionId,
      isTyping: false,
      sidebarOpen: true,
      healthProfile: emptyProfile,
      createSession: () => {
        const id = 'session_' + Date.now().toString();
        const newSession: ChatSession = {
          id,
          title: 'New Chat',
          messages: [{
            id: 'w_' + Date.now(),
            role: 'assistant',
            content: 'Welcome to **MediSonar** 👋\n\nHow can I help you today? Describe your symptoms or health concerns and I\'ll do my best to assist.'
          }],
          createdAt: Date.now(),
        };
        set((state) => ({
          sessions: [...state.sessions, newSession],
          activeSessionId: id,
        }));
      },
      setActiveSession: (id) => set({ activeSessionId: id }),
      deleteSession: (id) =>
        set((state) => {
          const remaining = state.sessions.filter((s) => s.id !== id);
          if (remaining.length === 0) {
            const newSession: ChatSession = {
              id: 'session_' + Date.now().toString(),
              title: 'New Chat',
              messages: [{
                id: 'w_' + Date.now(),
                role: 'assistant',
                content: 'Welcome to **MediSonar** 👋\n\nHow can I help you today? Describe your symptoms or health concerns and I\'ll do my best to assist.'
              }],
              createdAt: Date.now(),
            };
            return { sessions: [newSession], activeSessionId: newSession.id };
          }
          const nextActive =
            state.activeSessionId === id ? remaining[remaining.length - 1].id : state.activeSessionId;
          return { sessions: remaining, activeSessionId: nextActive };
        }),
      addMessage: (msg) =>
        set((state) => {
          const sessions = state.sessions.map((s) => {
            if (s.id === state.activeSessionId) {
              const updated = { ...s, messages: [...s.messages, msg] };
              if (s.title === 'New Chat' && msg.role === 'user') {
                updated.title = msg.content.length > 28 ? msg.content.slice(0, 28) + '...' : msg.content;
              }
              return updated;
            }
            return s;
          });
          return { sessions };
        }),
      setTyping: (typing) => set({ isTyping: typing }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setHealthProfile: (profile) => set({ healthProfile: profile }),
    }),
    {
      name: 'medisonar-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        healthProfile: state.healthProfile,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
