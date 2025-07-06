import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import ShaderBackground from './ShaderBackground';
import { useShaderBackground } from '../contexts/ShaderBackgroundContext';

const GlobalShaderBackground: React.FC = () => {
  const { shaderRef, isExpanded } = useShaderBackground();

  return (
    <View style={[styles.container, isExpanded && styles.expanded]}>
      <ShaderBackground ref={shaderRef} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -10, // Much lower z-index to ensure it stays behind everything
    pointerEvents: 'none',
    backgroundColor: 'transparent',
  },
  expanded: {
    zIndex: -10, // Consistent with container
    pointerEvents: 'none',
    backgroundColor: 'transparent',
  },
});

export default GlobalShaderBackground;
