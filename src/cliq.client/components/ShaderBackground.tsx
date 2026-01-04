import React, { useRef, useImperativeHandle, forwardRef, useEffect, useMemo } from 'react';
import { GLView } from 'expo-gl';
import { Dimensions, StyleSheet, Platform, View } from 'react-native'
import { useTheme } from '../theme/ThemeContext';
import SimpleSnowfall from './SimpleSnowfall';

// Check if today is January 1st (New Year's Day)
const isNewYearsDay = () => {
    return true
    const today = new Date();
    return today.getMonth() === 0 && today.getDate() === 1;
};

// Basic vertex shader - passes texture coordinates to fragment shader
const vertexShader = `
  attribute vec4 position;
  attribute vec2 texCoord;
  varying vec2 vUv;
  
  void main() {
    vUv = texCoord;
    gl_Position = position;
  }
`;

// Fireworks shader for New Year's Day with lava colors - OPTIMIZED
const fireworksFragmentShader = `
precision mediump float;
uniform float time;
uniform vec2 resolution;
uniform vec3 uBgColor;
varying vec2 vUv;

// Lava colors
const vec3 LAVA_RED = vec3(1.0, 0.2, 0.0);
const vec3 LAVA_ORANGE = vec3(1.0, 0.5, 0.0);
const vec3 LAVA_YELLOW = vec3(1.0, 0.8, 0.2);
const vec3 LAVA_WHITE = vec3(1.0, 0.95, 0.8);

float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
}

// Simplified firework - fewer particles, no trail loop
float firework(vec2 uv, vec2 center, float seed) {
    float t = mod(time + seed * 7.0, 3.5);
    
    if (t < 0.8) {
        // Rising phase - simple trail
        vec2 risePos = vec2(center.x, -0.6 + t * (center.y + 0.6) / 0.8);
        float d = length(uv - risePos);
        return smoothstep(0.025, 0.0, d) * (1.0 - t / 0.8);
    } else if (t < 3.0) {
        // Explosion phase - reduced to 12 particles, no inner trail loop
        float explodeProgress = (t - 0.8) / 2.2;
        float brightness = 0.0;
        float particleLife = 1.0 - explodeProgress;
        float life2 = particleLife * particleLife;
        
        // Only 12 particles instead of 24
        for (float i = 0.0; i < 12.0; i++) {
            float angle = i * 0.5236 + seed * 3.14159; // 0.5236 = 2PI/12
            float speed = 0.25 + random(vec2(seed, i)) * 0.2;
            
            vec2 particlePos = center + vec2(
                cos(angle) * speed * explodeProgress,
                sin(angle) * speed * explodeProgress - explodeProgress * explodeProgress * 0.12
            );
            
            float dist = length(uv - particlePos);
            brightness += smoothstep(0.035, 0.0, dist) * life2;
        }
        
        // Central flash
        float flash = smoothstep(0.25, 0.0, explodeProgress) * smoothstep(0.12, 0.0, length(uv - center));
        brightness += flash * 1.5;
        
        return brightness;
    }
    
    return 0.0;
}

vec3 getLavaColor(float seed) {
    float colorPhase = fract(seed * 3.7);
    if (colorPhase < 0.33) {
        return LAVA_RED;
    } else if (colorPhase < 0.66) {
        return LAVA_ORANGE;
    } else {
        return LAVA_YELLOW;
    }
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;
    
    vec3 color = uBgColor * 0.25;
    
    // Reduced to 4 fireworks instead of 8
    float fw1 = firework(uv, vec2(-0.4, 0.35), 0.0);
    float fw2 = firework(uv, vec2(0.35, 0.5), 0.5);
    float fw3 = firework(uv, vec2(0.5, 0.25), 1.0);
    float fw4 = firework(uv, vec2(-0.25, 0.55), 1.5);
    
    color += getLavaColor(0.0) * fw1 * 1.4;
    color += getLavaColor(0.5) * fw2 * 1.4;
    color += getLavaColor(1.0) * fw3 * 1.4;
    color += getLavaColor(1.5) * fw4 * 1.4;
    
    // Simple tone mapping
    color = color / (color + 1.0);
    
    gl_FragColor = vec4(color, 1.0);
}
`;

const fragmentShader = `
precision highp float;
uniform float time;
uniform vec2 resolution;
uniform float metaballRadius;  // Changed from const to uniform
uniform vec3 uBlob1;
uniform vec3 uBlob2;
uniform vec3 uBlob3;
uniform vec3 uBgColor; // Theme background color
varying vec2 vUv;

// Adjustable parameters
const float FIELD_THRESHOLD = 0.99;      // When to start blending with background
const float COLOR_VARIANCE = 0.1;        // How much colors can vary (0.0 - 1.0)
const float MOVEMENT_SPEED = 0.5;        // Speed of blob movement
const float TIME_OFFSET = 20.38;          // Starting time offset
const float NOISE_SCALE = 2.0;           // Scale of the noise pattern
const float MOVEMENT_RANGE = 0.5;        // How far blobs move from center
const float COLOR_CLAMP = 0.2;           // Max color variation from base
const float ANGLE_SPEED = 0.4;           // Speed of angle-based color change
const float DIST_SPEED = 2.0;            // Speed of distance-based color change
const float COLOR_SATURATION = 1.7;      // Boost color saturation
const float EDGE_SOFTNESS = 0.15;        // Softness of blob edges
const float SPECULAR_POWER = 3.0;        // Power of specular highlight
const float SPECULAR_INTENSITY = 0.09;   // Intensity of specular highlight
const float FRESNEL_POWER = 0.1;         // Power of fresnel (edge lighting) effect
const vec3 LIGHT_DIR = normalize(vec3(0.5, 0.5, 1.0)); // Light direction

struct Metaball {
    float field;
    vec3 color;
    vec3 normal;
};

vec2 random2(vec2 p) {
    return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
}

// Calculate normal for 3D effect
vec3 calculateNormal(vec2 pos, vec2 center, float field) {
    vec2 dir = pos - center;
    float dist = length(dir);
    float z = sqrt(max(0.0, 1.0 - dist * dist));
    return normalize(vec3(dir, z));
}

float metaball(vec2 p, vec2 center, float radius) {
    float d = length(p - center);
    return pow(min(radius / d, 1.5), 1.5);
}

vec3 saturate(vec3 color, float saturation) {
    float brightness = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(vec3(brightness), color, saturation);
}

// Enhanced color variation with 3D lighting
vec3 getVariedColor(vec3 baseColor, vec2 pos, vec2 center, float time, vec3 normal) {
    vec2 dir = pos - center;
    float angle = atan(dir.y, dir.x);
    float dist = length(dir);
    
    // Scale down color variation near the center
    float centerFade = smoothstep(0.0, 0.2, dist);
    
    vec2 noisePos = pos + vec2(cos(time * 0.000002), sin(time * 0.000003)) * 0.5;
    vec2 noise = random2(noisePos * NOISE_SCALE) * 2.0 - 1.0;
    
    vec3 colorVar;
    colorVar.r = baseColor.r + sin(angle + time * ANGLE_SPEED) * COLOR_VARIANCE * centerFade;
    colorVar.g = baseColor.g + cos(dist * 4.0 + time * DIST_SPEED) * COLOR_VARIANCE * centerFade;
    colorVar.b = baseColor.b + sin(dist * 3.0 - time * (ANGLE_SPEED - 0.1)) * COLOR_VARIANCE * centerFade;
    
    colorVar = clamp(colorVar, baseColor - COLOR_CLAMP, baseColor + COLOR_CLAMP);
    colorVar = saturate(colorVar, COLOR_SATURATION);

    // Add lighting effects
    float diffuse = max(0.0, dot(normal, LIGHT_DIR));
    float specular = pow(max(0.0, dot(reflect(-LIGHT_DIR, normal), vec3(0.0, 0.0, 1.0))), SPECULAR_POWER);
    float fresnel = pow(1.0 - max(0.0, dot(normal, vec3(0.0, 0.0, 1.0))), FRESNEL_POWER);

    // Blend lighting with color
    colorVar = colorVar * (0.7 + 0.3 * diffuse);  // Diffuse lighting
    colorVar += vec3(1.0) * specular * SPECULAR_INTENSITY;  // Specular highlight
    colorVar += colorVar * fresnel * 0.3;  // Fresnel edge lighting

    return colorVar;
}

void main() {
    vec2 uv = vUv;
    uv = uv * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;
    float t = time * MOVEMENT_SPEED + TIME_OFFSET;

    vec2 positions[3];
    positions[0] = vec2(sin(t * 0.7) * MOVEMENT_RANGE, cos(t * 0.8) * MOVEMENT_RANGE);
    positions[1] = vec2(cos(t * 0.5) * (MOVEMENT_RANGE + 0.1), sin(t * 0.9) * (MOVEMENT_RANGE - 0.1));
    positions[2] = vec2(sin(t * 0.9) * (MOVEMENT_RANGE - 0.2), cos(t * 0.6) * (MOVEMENT_RANGE + 0.1));

    vec3 baseColors[3];
    baseColors[0] = uBlob1;
    baseColors[1] = uBlob2;
    baseColors[2] = uBlob3;

    Metaball balls[3];
    float totalField = 0.0;
    vec3 totalColor = vec3(0.0);
    vec3 totalNormal = vec3(0.0, 0.0, 1.0);
    
    // First pass: calculate fields and normals - now using uniform metaballRadius
    for(int i = 0; i < 3; i++) {
        float field = metaball(uv, positions[i], metaballRadius);
        balls[i].field = field;
        balls[i].normal = calculateNormal(uv, positions[i], field);
        totalField += field;
    }

    // Second pass: blend colors with lighting
    for(int i = 0; i < 3; i++) {
        float weight = balls[i].field / totalField;
        vec3 normal = mix(totalNormal, balls[i].normal, weight);
        balls[i].color = getVariedColor(baseColors[i], uv, positions[i], t, normal);
        totalColor += balls[i].color * weight;
    }

    float alpha = smoothstep(FIELD_THRESHOLD, 1.0, totalField);
    vec3 finalColor = mix(uBgColor, totalColor, alpha);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export interface ShaderBackgroundRef {
    animateRadius: (targetRadius: number, duration?: number) => void;
}

const ShaderBackground = forwardRef<ShaderBackgroundRef>((props, ref) => {
    console.log('ShaderBackground: Component rendering, Platform.OS:', Platform.OS);
    const { theme } = useTheme();
    
    // Check if it's New Year's Day - use fireworks mode
    const isFireworksMode = useMemo(() => isNewYearsDay(), []);
    
    let gl = null;
    let program = null;
    let positionLocation = null;
    let texCoordLocation = null;
    let timeLocation = null;
    let resolutionLocation = null;
    let metaballRadiusLocation = null;
    let startTime = null;
    let blob1Location = null;
    let blob2Location = null;
    let blob3Location = null;
    let bgColorLocation = null;
    
    // Animation state
    const animationRef = useRef({
        currentRadius: 0.18,
        targetRadius: 0.18,
        animationStartTime: null,
        animationDuration: 1000, // 1 second default
        isAnimating: false
    });

    useEffect(() => {
        console.log('ShaderBackground: Component mounted');
        return () => {
            console.log('ShaderBackground: Component unmounting');
        };
    }, []);

    const createShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const animateRadius = (targetRadius: number, duration: number = 1000) => {
        animationRef.current.targetRadius = targetRadius;
        animationRef.current.animationStartTime = Date.now();
        animationRef.current.animationDuration = duration;
        animationRef.current.isAnimating = true;
    };

    useImperativeHandle(ref, () => ({
        animateRadius
    }));

    const updateRadius = () => {
        if (!animationRef.current.isAnimating) return;

        const now = Date.now();
        const elapsed = now - animationRef.current.animationStartTime;
        const progress = Math.min(elapsed / animationRef.current.animationDuration, 1);
        
        // Smooth easing function (ease-out)
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        const startRadius = animationRef.current.currentRadius;
        const targetRadius = animationRef.current.targetRadius;
        
        animationRef.current.currentRadius = startRadius + (targetRadius - startRadius) * easedProgress;
        
        if (progress >= 1) {
            animationRef.current.isAnimating = false;
            animationRef.current.currentRadius = targetRadius;
        }
    };

    const setupGL = (glContext) => {
        console.log('ShaderBackground: Setting up GL context', glContext);
        gl = glContext;

        // Create shader program - use fireworks shader on New Year's Day
        const vertShader = createShader(gl.VERTEX_SHADER, vertexShader);
         const activeFragmentShader = isFireworksMode ? fireworksFragmentShader : fragmentShader;
        const fragShader = createShader(gl.FRAGMENT_SHADER, activeFragmentShader);

        if (!vertShader || !fragShader) {
            console.error('ShaderBackground: Failed to create shaders');
            return;
        }

        program = gl.createProgram();
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return;
        }

        console.log('ShaderBackground: Shaders compiled and linked successfully', isFireworksMode ? '(Fireworks Mode)' : '(Normal Mode)');

        // Get locations
        positionLocation = gl.getAttribLocation(program, 'position');
        texCoordLocation = gl.getAttribLocation(program, 'texCoord');
        timeLocation = gl.getUniformLocation(program, 'time');
        resolutionLocation = gl.getUniformLocation(program, 'resolution');
    
    // Only get these locations for normal mode (fireworks shader doesn't use them)
    if (!isFireworksMode) {
        metaballRadiusLocation = gl.getUniformLocation(program, 'metaballRadius');
        blob1Location = gl.getUniformLocation(program, 'uBlob1');
        blob2Location = gl.getUniformLocation(program, 'uBlob2');
        blob3Location = gl.getUniformLocation(program, 'uBlob3');
    }
    bgColorLocation = gl.getUniformLocation(program, 'uBgColor');

        // Create buffers
        const positions = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            1.0, 1.0,
        ]);

        const texCoords = new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0,
        ]);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        // Start render loop
        startTime = Date.now();
        const render = () => {
            updateRadius(); // Update animation
            
            const time = (Date.now() - startTime) * 0.001;
            const { width, height } = Dimensions.get('window');

            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(program);

            // Set uniforms - common to both modes
            gl.uniform1f(timeLocation, time);
            gl.uniform2f(resolutionLocation, width, height);
            
            // Parse hex (#RGB, #RRGGBB, #RRGGBBAA) into normalized RGB, ignoring alpha
            const hexToRGB = (hex) => {
                if (!hex) return [1,1,1];
                let h = hex.trim().replace('#','');
                if (h.length === 3) { // expand short form
                    h = h.split('').map(c => c + c).join('');
                }
                if (h.length === 8) { // strip alpha
                    h = h.substring(0,6);
                }
                if (h.length !== 6) return [1,1,1];
                const r = parseInt(h.slice(0,2),16);
                const g = parseInt(h.slice(2,4),16);
                const b = parseInt(h.slice(4,6),16);
                return [r/255, g/255, b/255];
            };
            
            // Background color is used in both modes
            const [br,bg,bb] = hexToRGB(theme.colors.backgroundAlt || '#000000');
            gl.uniform3f(bgColorLocation, br,bg,bb);
            
            // Only set metaball-specific uniforms in normal mode
            if (!isFireworksMode) {
                gl.uniform1f(metaballRadiusLocation, animationRef.current.currentRadius);
                const [r1,g1,b1] = hexToRGB(theme.colors.blob1);
                const [r2,g2,b2] = hexToRGB(theme.colors.blob2);
                const [r3,g3,b3] = hexToRGB(theme.colors.blob3);
                gl.uniform3f(blob1Location, r1,g1,b1);
                gl.uniform3f(blob2Location, r2,g2,b2);
                gl.uniform3f(blob3Location, r3,g3,b3);
            }

            // Set attributes
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
            gl.enableVertexAttribArray(texCoordLocation);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

            // Draw
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            gl.endFrameEXP();
            requestAnimationFrame(render);
        };

        render();
    };

    return (
        <View style={styles.container}>
            <GLView
                style={styles.glView}
                onContextCreate={setupGL}
            />
            {/* Show snowfall only when not in fireworks mode */}
            {!isFireworksMode && (
                <SimpleSnowfall
                    count={200}
                    minSize={2}
                    maxSize={6}
                />
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        pointerEvents: 'none',
    },
    glView: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    }
});

export default ShaderBackground;