import React, { createContext, useContext, useRef, useState, ReactNode } from 'react';
import { ShaderBackgroundRef } from '../components/ShaderBackground';

interface ShaderBackgroundContextType {
  shaderRef: React.RefObject<ShaderBackgroundRef>;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  animateToExpanded: () => void;
  animateToCollapsed: () => void;
}

const ShaderBackgroundContext = createContext<ShaderBackgroundContextType | undefined>(undefined);

interface ShaderBackgroundProviderProps {
  children: ReactNode;
}

export const ShaderBackgroundProvider: React.FC<ShaderBackgroundProviderProps> = ({ children }) => {
  const shaderRef = useRef<ShaderBackgroundRef>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const animateToExpanded = () => {
    console.log('ShaderBackgroundContext: animateToExpanded called');
    shaderRef.current?.animateRadius(0.85, 300000); // Match SignInScreen animation
    setIsExpanded(true);
  };

  const animateToCollapsed = () => {
    console.log('ShaderBackgroundContext: animateToCollapsed called');
    shaderRef.current?.animateRadius(0.18, 10000); // Match SignInScreen animation
    setIsExpanded(false);
  };

  return (
    <ShaderBackgroundContext.Provider
      value={{
        shaderRef,
        isExpanded,
        setIsExpanded,
        animateToExpanded,
        animateToCollapsed,
      }}
    >
      {children}
    </ShaderBackgroundContext.Provider>
  );
};

export const useShaderBackground = (): ShaderBackgroundContextType => {
  const context = useContext(ShaderBackgroundContext);
  if (!context) {
    throw new Error('useShaderBackground must be used within a ShaderBackgroundProvider');
  }
  return context;
};
