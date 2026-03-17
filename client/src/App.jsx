import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import ControlLayout from './pages/control/ControlLayout';
import Dashboard from './pages/control/Dashboard';
import Shows from './pages/control/Shows';
import Layouts from './pages/control/Layouts';
import Screens from './pages/control/Screens';
import Timeline from './pages/control/Timeline';
import Settings from './pages/control/Settings';
import ScreenDisplay from './pages/screen/ScreenDisplay';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('broadcast_token');
  if (!token) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
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
        <Route path="timeline" element={<Timeline />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/screen/:id" element={<ScreenDisplay />} />
    </Routes>
  );
}
