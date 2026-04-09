import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

const Dashboard = lazy(() => import('./Dashboard'));
const ProfilePage = lazy(() => import('./ProfilePage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AutismScreeningPage = lazy(() => import('./pages/AutismScreeningPage'));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col h-screen w-screen items-center justify-center bg-[#F5F5F7] text-[15px] font-medium text-[#86868B] font-sans">
          <div className="w-8 h-8 rounded-full border-2 border-black/[0.05] border-t-blue-500 animate-spin mb-4" />
          Loading MediSonar...
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/autism-screening" element={<AutismScreeningPage />} />
      </Routes>
    </Suspense>
  );
}
