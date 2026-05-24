import { createContext, useContext, type ReactNode } from 'react';

import { useParkingSpotFlow, type UseParkingSpotFlowResult } from './useParkingSpotFlow';

const ParkingSpotFlowContext = createContext<UseParkingSpotFlowResult | null>(null);

export function ParkingSpotFlowProvider({ children }: { children: ReactNode }) {
  const value = useParkingSpotFlow();
  return <ParkingSpotFlowContext.Provider value={value}>{children}</ParkingSpotFlowContext.Provider>;
}

export function useParkingSpotFlowContext(): UseParkingSpotFlowResult {
  const ctx = useContext(ParkingSpotFlowContext);
  if (!ctx) {
    throw new Error('ParkingSpotFlowProvider gerekli');
  }
  return ctx;
}
