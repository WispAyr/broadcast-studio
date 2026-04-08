import React, { createContext, useContext } from 'react';
import useWorkspace from './useWorkspace';

const WorkspaceContext = createContext(null);

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspaceContext must be used within WorkspaceProvider');
  return ctx;
}

export function WorkspaceProvider({ children }) {
  const workspace = useWorkspace();
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  );
}
