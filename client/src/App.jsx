import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Landing from './pages/Landing';
import Login from './pages/Login';
import ControlLayout from './pages/control/ControlLayout';
import Dashboard from './pages/control/Dashboard';
import Shows from './pages/control/Shows';
import Layouts from './pages/control/Layouts';
import Screens from './pages/control/Screens';
import Timeline from './pages/control/Timeline';
import Media from './pages/control/Media';
import Settings from './pages/control/Settings';
import Templates from './pages/control/Templates';
import TemplateEditor from './pages/control/TemplateEditor';
import Admin from './pages/control/Admin';
import AutocueController from './pages/control/AutocueController';
import ScreenDisplay from './pages/screen/ScreenDisplay';
import GodView from './pages/GodView';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('broadcast_token');
  if (!token) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
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
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="/screen/:id" element={<ScreenDisplay />} />
      <Route path="/god" element={<GodView />} />
    </Routes>
    </ToastProvider>
  );
}
