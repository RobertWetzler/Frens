import React from 'react';
import { GLView } from 'expo-gl';
import { Dimensions, StyleSheet } from 'react-native'

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

// Fragment shader with simple color animation
/*
const fragmentShader = `
  precision highp float;
  uniform float time;
  varying vec2 vUv;
  
  void main() {
    vec3 color = 0.5 + 0.5 * cos(time + vUv.xyx + vec3(0.0, 2.0, 4.0));
    gl_FragColor = vec4(color, 1.0);
  }
`;
*/
// Blobs!!!

const fragmentShader = `
precision highp float;
uniform float time;
uniform vec2 resolution;
varying vec2 vUv;

// Adjustable parameters
const float METABALL_RADIUS = 0.18;      // Size of each blob
const float FIELD_THRESHOLD = 0.99;      // When to start blending with background
const float COLOR_VARIANCE = 0.1;        // How much colors can vary (0.0 - 1.0)
const float MOVEMENT_SPEED = 0.5;        // Speed of blob movement
const float TIME_OFFSET = 20.0;          // Starting time offset
const float NOISE_SCALE = 2.0;           // Scale of the noise pattern
const float MOVEMENT_RANGE = 0.5;        // How far blobs move from center
const float COLOR_CLAMP = 0.2;           // Max color variation from base
const float ANGLE_SPEED = 0.4;           // Speed of angle-based color change
const float DIST_SPEED = 0.2;            // Speed of distance-based color change

struct Metaball {
    float field;
    vec3 color;
};

vec2 random2(vec2 p) {
    return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
}

float metaball(vec2 p, vec2 center, float radius) {
    float d = length(p - center);
    return pow(min(radius / d, 1.5), 1.5);
}

vec3 getVariedColor(vec3 baseColor, vec2 pos, vec2 center, float time) {
    vec2 dir = pos - center;
    float angle = atan(dir.y, dir.x);
    float dist = length(dir);
    
    // Scale down color variation near the center
    float centerFade = smoothstep(0.0, 0.2, dist);
    
    vec2 noisePos = pos + vec2(cos(time * 0.000002), sin(time * 0.000003)) * 0.5;
    //vec2 noisePos = pos + vec2(cos(0.2), sin(0.3)) * 0.5;
    vec2 noise = random2(noisePos * NOISE_SCALE) * 2.0 - 1.0;
    
    vec3 colorVar;
    //colorVar.r = baseColor.r + sin(angle + time * 0.3) * 0.1 + noise.x * 0.1;
    //colorVar.g = baseColor.g + cos(dist * 4.0 + time * 0.2) * 0.1 + noise.y * 0.1;
    //colorVar.b = baseColor.b + sin(dist * 3.0 - time * 0.4) * 0.1 + noise.x * 0.1;
    colorVar.r = baseColor.r + sin(angle + time * ANGLE_SPEED) * COLOR_VARIANCE * centerFade;
    colorVar.g = baseColor.g + cos(dist * 4.0 + time * DIST_SPEED) * COLOR_VARIANCE * centerFade;
    colorVar.b = baseColor.b + sin(dist * 3.0 - time * (ANGLE_SPEED - 0.1)) * COLOR_VARIANCE * centerFade;
    
    return clamp(colorVar, baseColor - COLOR_CLAMP, baseColor + COLOR_CLAMP);
}

void main() {
    vec2 uv = vUv;
    uv = uv * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;
    float t = time * MOVEMENT_SPEED + TIME_OFFSET;
    //t = t + 2.0 * sin(t);

    vec2 positions[3];
    positions[0] = vec2(sin(t * 0.7) * MOVEMENT_RANGE, cos(t * 0.8) * MOVEMENT_RANGE);
    positions[1] = vec2(cos(t * 0.5) * (MOVEMENT_RANGE + 0.1), sin(t * 0.9) * (MOVEMENT_RANGE - 0.1));
    positions[2] = vec2(sin(t * 0.9) * (MOVEMENT_RANGE - 0.2), cos(t * 0.6) * (MOVEMENT_RANGE + 0.1));

    vec3 baseColors[3];
    baseColors[0] = vec3(0.4, 0.6, 1.0);    // Lighter blue
    baseColors[1] = vec3(0.6, 0.8, 1.0);    // Very light blue
    baseColors[2] = vec3(0.6, 0.45, 0.95);  // Lighter royal purple

    Metaball balls[3];
    float totalField = 0.0;
    vec3 totalColor = vec3(0.0);
    
    for(int i = 0; i < 3; i++) {
        float field = metaball(uv, positions[i], METABALL_RADIUS);
        balls[i].field = field;
        balls[i].color = getVariedColor(baseColors[i], uv, positions[i], t);
        totalField += field;
    }

    for(int i = 0; i < 3; i++) {
        float weight = balls[i].field / totalField;
        totalColor += balls[i].color * weight;
    }

    float alpha = smoothstep(FIELD_THRESHOLD, 1.0, totalField);
    vec3 finalColor = mix(vec3(1.0), totalColor, alpha);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const ShaderBackground = () => {
    let gl = null;
    let program = null;
    let positionLocation = null;
    let texCoordLocation = null;
    let timeLocation = null;
    let resolutionLocation = null;
    let startTime = null;

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

    const setupGL = (glContext) => {
        gl = glContext;

        // Create shader program
        const vertShader = createShader(gl.VERTEX_SHADER, vertexShader);
        const fragShader = createShader(gl.FRAGMENT_SHADER, fragmentShader);

        program = gl.createProgram();
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return;
        }

        // Get locations
        positionLocation = gl.getAttribLocation(program, 'position');
        texCoordLocation = gl.getAttribLocation(program, 'texCoord');
        timeLocation = gl.getUniformLocation(program, 'time');
        resolutionLocation = gl.getUniformLocation(program, 'resolution');

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
            const time = (Date.now() - startTime) * 0.001;
            const { width, height } = Dimensions.get('window');

            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(program);

            // Set uniforms
            gl.uniform1f(timeLocation, time);
            gl.uniform2f(resolutionLocation, width, height);

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
        <GLView
            style={styles.container}
            onContextCreate={setupGL}
            />
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject, // This makes it fill the screen
        backgroundColor: 'transparent',
    },
});


export default ShaderBackground;