import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import ConfirmHost from './components/ConfirmHost';

// Eagerly loaded (always needed)
import Login from './pages/Login';
import ControlLayout from './pages/control/ControlLayout';
import Dashboard from './pages/control/Dashboard';

// Lazy-loaded (loaded on demand)
const Landing = React.lazy(() => import('./pages/Landing'));
const GodView = React.lazy(() => import('./pages/GodView'));
const ScreenDisplay = React.lazy(() => import('./pages/screen/ScreenDisplay'));
const Shows = React.lazy(() => import('./pages/control/Shows'));
const Layouts = React.lazy(() => import('./pages/control/Layouts'));
const Screens = React.lazy(() => import('./pages/control/Screens'));
const Timeline = React.lazy(() => import('./pages/control/Timeline'));
const Media = React.lazy(() => import('./pages/control/Media'));
const Settings = React.lazy(() => import('./pages/control/Settings'));
const Templates = React.lazy(() => import('./pages/control/Templates'));
const TemplateEditor = React.lazy(() => import('./pages/control/TemplateEditor'));
const Admin = React.lazy(() => import('./pages/control/Admin'));
const EgpkScenes = React.lazy(() => import("./pages/control/EgpkScenes"));
const AutocueController = React.lazy(() => import('./pages/control/AutocueController'));
const Deploy = React.lazy(() => import('./pages/control/Deploy'));
const Variables = React.lazy(() => import('./pages/control/Variables'));
const Displays = React.lazy(() => import('./pages/control/Displays'));

// Minimal loading fallback
function LoadingFallback() {
  return (
    <div className="flex h-screen bg-gray-950 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-gray-500 text-sm">Loading...</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('broadcast_token');
  if (!token) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
    <Suspense fallback={<LoadingFallback />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/control/*"
        element={
          <ProtectedRoute>
            <ControlLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="shows" element={<Shows />} />
        <Route path="layouts" element={<Layouts />} />
        <Route path="screens" element={<Screens />} />
        <Route path="media" element={<Media />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="templates" element={<Templates />} />
        <Route path="templates/:id/edit" element={<TemplateEditor />} />
        <Route path="settings" element={<Settings />} />
        <Route path="autocue" element={<AutocueController />} />
        <Route path="variables" element={<Variables />} />
        <Route path="displays" element={<Displays />} />
        <Route path="admin" element={<Admin />} />
        <Route path="egpk" element={<EgpkScenes />} />
      </Route>
      <Route path="/screen/:id" element={<ScreenDisplay />} />
      <Route path="/deploy" element={<Deploy />} />
      <Route path="/god" element={<ProtectedRoute><GodView /></ProtectedRoute>} />
    </Routes>
    </Suspense>
    <ConfirmHost />
    </ToastProvider>
  );
}
