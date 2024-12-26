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

struct Metaball {
    float field;
    vec3 color;
};

float metaball(vec2 p, vec2 center, float radius) {
    float d = length(p - center);
    //return radius / d;
    return pow(min(radius / d, 1.5), 1.5);
}

void main() {
    vec2 uv = vUv;
    uv = uv * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;
    float t = time * 0.5 + 15.0;

    // Define positions and colors for each ball
    vec2 positions[3];
    positions[0] = vec2(sin(t * 0.7) * 0.5, cos(t * 0.8) * 0.5);
    positions[1] = vec2(cos(t * 0.5) * 0.6, sin(t * 0.9) * 0.4);
    positions[2] = vec2(sin(t * 0.9) * 0.3, cos(t * 0.6) * 0.6);

    vec3 colors[3];
    colors[0] = vec3(0.4, 0.6, 1.0);    // Lighter blue
    colors[1] = vec3(0.6, 0.8, 1.0);    // Very light blue
    colors[2] = vec3(0.6, 0.45, 0.95);  // Lighter royal purple


    // Calculate field and color contribution for each ball
    Metaball balls[3];
    float totalField = 0.0;
    vec3 totalColor = vec3(0.0);

    for(int i = 0; i < 3; i++) {
        float field = metaball(uv, positions[i], 0.19);
        balls[i].field = field;
        balls[i].color = colors[i];
        totalField += field;
    }

    // Blend colors based on field strength
    for(int i = 0; i < 3; i++) {
        float weight = balls[i].field / totalField;
        totalColor += balls[i].color * weight;
    }

    // Mix with white background
    float alpha = smoothstep(0.99, 1.0, totalField);
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