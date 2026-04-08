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
        <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-textMuted">
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
