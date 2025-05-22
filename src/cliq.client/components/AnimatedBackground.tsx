import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const Circle = ({ size, position, colors }) => {
  return (
    <Animated.View style={[styles.circle, { width: size, height: size, ...position }]}>
      <LinearGradient
        colors={colors}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
};

const AnimatedBackground = () => {
  const circle1 = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const circle2 = useRef(new Animated.ValueXY({ x: width - 250, y: height - 250 })).current;
  const circle3 = useRef(new Animated.ValueXY({ x: width / 2 - 100, y: height / 2 - 100 })).current;

  useEffect(() => {
    const animate = (circle, rangeX, rangeY, duration) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(circle, {
            toValue: { x: rangeX, y: rangeY },
            duration,
            useNativeDriver: false,
          }),
          Animated.timing(circle, {
            toValue: { x: 0, y: 0 },
            duration,
            useNativeDriver: false,
          }),
        ])
      ).start();
    };

    animate(circle1, width - 300, height - 300, 15000);
    animate(circle2, -width + 250, -height + 250, 18000);
    animate(circle3, -width / 2 + 100, -height / 2 + 100, 20000);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Circle
        size={300}
        position={circle1.getLayout()}
        colors={['#1E3A8A', '#3B82F6']}
      />
      <Circle
        size={250}
        position={circle2.getLayout()}
        colors={['#1E40AF', '#60A5FA']}
      />
      <Circle
        size={200}
        position={circle3.getLayout()}
        colors={['#2563EB', '#93C5FD']}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    borderRadius: 1000, // This ensures the container is circular
    overflow: 'hidden', // This ensures the gradient doesn't spill outside the circular container
    opacity: 0.3,
  },
});

export default AnimatedBackground;