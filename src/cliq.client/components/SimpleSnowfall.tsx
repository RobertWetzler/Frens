import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { useSnowCollision } from '../contexts/SnowCollisionContext';

const PILE_PERCENTAGE = 0.5; // 50% of snowflakes can pile
interface Snowflake {
  x: Animated.Value;
  y: Animated.Value;
  initialX: number;
  size: number;
  speed: number;
  swingSpeed: number;
  swingAmount: number;
  opacity: number;
  hasLanded: boolean;
  landedY: number;
  animationId?: any; // Store animation reference
  canPile: boolean; // Whether this snowflake can pile up or falls through
}

interface SimpleSnowfallProps {
  count?: number;
  minSize?: number;
  maxSize?: number;
}

const SimpleSnowfall: React.FC<SimpleSnowfallProps> = ({ 
  count = 100,
  minSize = 2,
  maxSize = 6 
}) => {
  const snowflakesRef = useRef<Snowflake[]>([]);
  const { width, height } = Dimensions.get('window');
  const { topPostBoundary, isPilingActive } = useSnowCollision();
  
  // Use ref to always have the latest boundary value in the collision check
  const boundaryRef = useRef(topPostBoundary);
  const isPilingActiveRef = useRef(isPilingActive);
  
  useEffect(() => {
    boundaryRef.current = topPostBoundary;
    // if (topPostBoundary) {
    //   // console.log('Snow: Post boundary detected:', topPostBoundary);
    // } else {
    //   // console.log('Snow: No post boundary');
    // }
  }, [topPostBoundary]);
  
  // Track piling active state and reset landed snowflakes when deactivated
  useEffect(() => {
    const wasActive = isPilingActiveRef.current;
    isPilingActiveRef.current = isPilingActive;
    
    // When piling becomes inactive, restart all landed snowflakes
    if (wasActive && !isPilingActive) {
      // console.log('Snow: Piling deactivated - resetting landed snowflakes');
      snowflakesRef.current.forEach(snowflake => {
        if (snowflake.hasLanded) {
          snowflake.hasLanded = false;
          
          // Restart animations for this snowflake
          const fallDuration = (height + 100) / snowflake.speed * 20;
          
          // Restart X swing
          const newXAnimation = Animated.loop(
            Animated.sequence([
              Animated.timing(snowflake.x, {
                toValue: snowflake.initialX + snowflake.swingAmount,
                duration: 2000 / snowflake.swingSpeed,
                useNativeDriver: true,
              }),
              Animated.timing(snowflake.x, {
                toValue: snowflake.initialX - snowflake.swingAmount,
                duration: 2000 / snowflake.swingSpeed,
                useNativeDriver: true,
              }),
            ])
          );
          newXAnimation.start();
          
          // Restart Y fall (continue from current position)
          const newYAnimation = Animated.loop(
            Animated.sequence([
              Animated.timing(snowflake.y, {
                toValue: height + 100,
                duration: fallDuration,
                useNativeDriver: true,
              }),
              Animated.timing(snowflake.y, {
                toValue: -20,
                duration: 0,
                useNativeDriver: true,
              }),
            ])
          );
          newYAnimation.start();
        }
      });
    }
  }, [isPilingActive, height]);

  useEffect(() => {
    // Initialize snowflakes
    snowflakesRef.current = Array.from({ length: count }, () => {
      const initialX = Math.random() * width;
      const x = new Animated.Value(initialX);
      const y = new Animated.Value(-20 - Math.random() * height);
      const size = minSize + Math.random() * (maxSize - minSize);
      const speed = 1 + Math.random() * 2;
      const swingSpeed = 0.5 + Math.random() * 0.5;
      const swingAmount = 20 + Math.random() * 30;
      const opacity = 0.4 + Math.random() * 0.6;
      const canPile = Math.random() < PILE_PERCENTAGE; // 50% chance to pile

      return { x, y, initialX, size, speed, swingSpeed, swingAmount, opacity, hasLanded: false, landedY: 0, canPile };
    });

    // Animate snowflakes with collision detection
    const timeouts: NodeJS.Timeout[] = [];
    const intervals: NodeJS.Timeout[] = [];
    const animations: { x: any; y: any }[] = [];
    
    snowflakesRef.current.forEach((snowflake, index) => {
      const startDelay = Math.random() * 5000;
      const fallDuration = (height + 100) / snowflake.speed * 20;
      
      // Start X-axis swing immediately (independent of Y)
      const xAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(snowflake.x, {
            toValue: snowflake.initialX + snowflake.swingAmount,
            duration: 2000 / snowflake.swingSpeed,
            useNativeDriver: true,
          }),
          Animated.timing(snowflake.x, {
            toValue: snowflake.initialX - snowflake.swingAmount,
            duration: 2000 / snowflake.swingSpeed,
            useNativeDriver: true,
          }),
        ])
      );
      xAnimation.start();
      snowflake.animationId = animations.length;
      animations.push({ x: xAnimation, y: null });

      // Start Y-axis fall with delay and collision detection
      const timeout = setTimeout(() => {
        // Start continuous falling animation (loop with reset)
        const yAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(snowflake.y, {
              toValue: height + 100,
              duration: fallDuration,
              useNativeDriver: true,
            }),
            Animated.timing(snowflake.y, {
              toValue: -20,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
        yAnimation.start();
        
        // Update the animations array with the Y animation
        if (snowflake.animationId !== undefined) {
          animations[snowflake.animationId].y = yAnimation;
        }
        
        // Check for collision periodically
        const collisionCheck = setInterval(() => {
          if (snowflake.hasLanded) return;
          
          // Get current boundary from ref (always latest)
          const boundary = boundaryRef.current;
          const pilingActive = isPilingActiveRef.current;
          
          // Get current Y position (using private API - not ideal but necessary)
          const currentY = (snowflake.y as any)._value || 0;
          const currentX = (snowflake.x as any)._value || snowflake.initialX;
          
          // Check if snowflake has hit the top post (only if piling is active AND this snowflake can pile)
          // Also check that snowflake is approaching from above (not already past)
          if (snowflake.canPile && pilingActive && boundary && currentY >= boundary.top - snowflake.size && currentY < boundary.top + 20) {
            // Check if X position is within post bounds
            if (currentX >= boundary.left && currentX <= boundary.right) {
              // console.log(`🎉 Snow #${index} LANDED at Y=${currentY.toFixed(0)}, X=${currentX.toFixed(0)}`);
              
              // Stop the animation and land
              snowflake.hasLanded = true;
              snowflake.landedY = boundary.top - snowflake.size;
              
              // Stop both X and Y animations
              if (snowflake.animationId !== undefined && animations[snowflake.animationId]) {
                if (animations[snowflake.animationId].x) {
                  animations[snowflake.animationId].x.stop();
                }
                if (animations[snowflake.animationId].y) {
                  animations[snowflake.animationId].y.stop();
                }
              }
              
              snowflake.y.setValue(snowflake.landedY);
              snowflake.x.setValue(currentX); // Freeze X position
              clearInterval(collisionCheck);
              
              // After 3 seconds, respawn the snowflake at the top
              const respawnSnowflake = () => {
                snowflake.hasLanded = false;
                snowflake.y.setValue(-20 - Math.random() * 100);
                snowflake.x.setValue(snowflake.initialX);
                
                // Restart animations
                if (snowflake.animationId !== undefined) {
                  // Restart X swing
                  const newXAnimation = Animated.loop(
                    Animated.sequence([
                      Animated.timing(snowflake.x, {
                        toValue: snowflake.initialX + snowflake.swingAmount,
                        duration: 2000 / snowflake.swingSpeed,
                        useNativeDriver: true,
                      }),
                      Animated.timing(snowflake.x, {
                        toValue: snowflake.initialX - snowflake.swingAmount,
                        duration: 2000 / snowflake.swingSpeed,
                        useNativeDriver: true,
                      }),
                    ])
                  );
                  newXAnimation.start();
                  animations[snowflake.animationId].x = newXAnimation;
                  
                  // Restart Y fall
                  const newYAnimation = Animated.loop(
                    Animated.sequence([
                      Animated.timing(snowflake.y, {
                        toValue: height + 100,
                        duration: fallDuration,
                        useNativeDriver: true,
                      }),
                      Animated.timing(snowflake.y, {
                        toValue: -20,
                        duration: 0,
                        useNativeDriver: true,
                      }),
                    ])
                  );
                  newYAnimation.start();
                  animations[snowflake.animationId].y = newYAnimation;
                }
                
                // Restart collision detection
                const newCollisionCheck = setInterval(() => {
                  if (snowflake.hasLanded) return;
                  
                  const boundary = boundaryRef.current;
                  const pilingActive = isPilingActiveRef.current;
                  const currentY = (snowflake.y as any)._value || 0;
                  const currentX = (snowflake.x as any)._value || snowflake.initialX;
                  
                  // Only check collision if this snowflake can pile, piling is active and snowflake is at the right position
                  if (snowflake.canPile && pilingActive && boundary && currentY >= boundary.top - snowflake.size && currentY < boundary.top + 20) {
                    if (currentX >= boundary.left && currentX <= boundary.right) {
                      // Land the snowflake
                      snowflake.hasLanded = true;
                      snowflake.landedY = boundary.top - snowflake.size;
                      
                      if (snowflake.animationId !== undefined && animations[snowflake.animationId]) {
                        if (animations[snowflake.animationId].x) animations[snowflake.animationId].x.stop();
                        if (animations[snowflake.animationId].y) animations[snowflake.animationId].y.stop();
                      }
                      
                      snowflake.y.setValue(snowflake.landedY);
                      snowflake.x.setValue(currentX);
                      clearInterval(newCollisionCheck);
                      
                      // Schedule respawn again
                      setTimeout(respawnSnowflake, 20000); // respawn piled snowflake after 20 seconds
                    }
                  }
                }, 16);
                
                intervals.push(newCollisionCheck);
              };
              
              setTimeout(respawnSnowflake, 20000); // Respawn after 3 seconds
            }
          }
        }, 16); // Check every frame (~60fps)
        
        intervals.push(collisionCheck);
      }, startDelay);
      
      timeouts.push(timeout);
    });

    return () => {
      // Cleanup timeouts
      timeouts.forEach(timeout => clearTimeout(timeout));
      
      // Cleanup intervals
      intervals.forEach(interval => clearInterval(interval));
      
      // Cleanup animations
      animations.forEach(anim => {
        if (anim.x) anim.x.stop();
        if (anim.y) anim.y.stop();
      });
      
      snowflakesRef.current.forEach(snowflake => {
        snowflake.x.stopAnimation();
        snowflake.y.stopAnimation();
      });
    };
    // Don't include topPostBoundary in deps - we want collision detection to work with the live value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, minSize, maxSize, width, height]);

  return (
    <View style={styles.container} pointerEvents="none">
      {snowflakesRef.current.map((snowflake, index) => (
        <Animated.View
          key={index}
          style={[
            styles.snowflake,
            {
              width: snowflake.size,
              height: snowflake.size,
              opacity: snowflake.opacity,
              transform: [
                { translateX: snowflake.x },
                { translateY: snowflake.y },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1, // Ensure snowflakes are above the GL view
  },
  snowflake: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
});

export default SimpleSnowfall;
