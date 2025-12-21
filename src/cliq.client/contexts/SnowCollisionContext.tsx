import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CollisionBoundary {
  top: number;
  left: number;
  right: number;
  height: number;
}

interface SnowCollisionContextType {
  topPostBoundary: CollisionBoundary | null;
  setTopPostBoundary: (boundary: CollisionBoundary | null) => void;
  isPilingActive: boolean;
  setIsPilingActive: (active: boolean) => void;
}

const SnowCollisionContext = createContext<SnowCollisionContextType | undefined>(undefined);

export const SnowCollisionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [topPostBoundary, setTopPostBoundary] = useState<CollisionBoundary | null>(null);
  const [isPilingActive, setIsPilingActive] = useState(true);

  return (
    <SnowCollisionContext.Provider value={{ topPostBoundary, setTopPostBoundary, isPilingActive, setIsPilingActive }}>
      {children}
    </SnowCollisionContext.Provider>
  );
};

export const useSnowCollision = () => {
  const context = useContext(SnowCollisionContext);
  if (context === undefined) {
    // Return a default context instead of throwing to prevent crashes
    console.warn('useSnowCollision used outside of SnowCollisionProvider');
    return {
      topPostBoundary: null,
      setTopPostBoundary: () => {},
      isPilingActive: false,
      setIsPilingActive: () => {},
    };
  }
  return context;
};
