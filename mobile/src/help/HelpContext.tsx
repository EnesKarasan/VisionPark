import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import HelpBottomSheet from '../../components/HelpBottomSheet';
import { helpContent, helpFallback, type HelpEntry, type HelpKey } from './helpContent';

type HelpContextValue = {
  openHelp: (key: HelpKey) => void;
  closeHelp: () => void;
};

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [activeKey, setActiveKey] = useState<HelpKey | null>(null);

  const openHelp = useCallback((key: HelpKey) => setActiveKey(key), []);
  const closeHelp = useCallback(() => setActiveKey(null), []);

  const entry: HelpEntry | null = activeKey ? helpContent[activeKey] ?? helpFallback : null;

  const ctx = useMemo(() => ({ openHelp, closeHelp }), [openHelp, closeHelp]);

  return (
    <HelpContext.Provider value={ctx}>
      {children}
      <HelpBottomSheet visible={activeKey != null} onClose={closeHelp} entry={entry} />
    </HelpContext.Provider>
  );
}

export function useHelp(): HelpContextValue {
  const ctx = useContext(HelpContext);
  if (!ctx) {
    throw new Error('useHelp must be used within HelpProvider');
  }
  return ctx;
}
