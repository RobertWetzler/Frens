import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

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

const fragmentShader = `
precision highp float;
uniform float time;
uniform vec2 resolution;
uniform float metaballRadius; // Global radius fallback
uniform int blobCount;
uniform vec2 blobPositions[10]; // Support up to 10 blobs
uniform vec3 blobColors[10];
uniform float blobRadii[10]; // Individual radius for each blob
uniform bool useAnimation;
varying vec2 vUv;

// Adjustable parameters
const float FIELD_THRESHOLD = 0.99;
const float COLOR_VARIANCE = 0.1;
const float MOVEMENT_SPEED = 0.5;
const float TIME_OFFSET = 20.38;
const float NOISE_SCALE = 2.0;
const float MOVEMENT_RANGE = 0.5;
const float COLOR_CLAMP = 0.2;
const float ANGLE_SPEED = 0.4;
const float DIST_SPEED = 2.0;
const float COLOR_SATURATION = 1.7;
const float EDGE_SOFTNESS = 0.15;
const float SPECULAR_POWER = 3.0;
const float SPECULAR_INTENSITY = 0.09;
const float FRESNEL_POWER = 0.1;
const vec3 LIGHT_DIR = normalize(vec3(0.5, 0.5, 1.0));

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

vec3 getVariedColor(vec3 baseColor, vec2 pos, vec2 center, float time, vec3 normal) {
    vec2 dir = pos - center;
    float angle = atan(dir.y, dir.x);
    float dist = length(dir);
    
    float centerFade = smoothstep(0.0, 0.2, dist);
    
    vec2 noisePos = pos + vec2(cos(time * 0.000002), sin(time * 0.000003)) * 0.5;
    vec2 noise = random2(noisePos * NOISE_SCALE) * 2.0 - 1.0;
    
    vec3 colorVar;
    colorVar.r = baseColor.r + sin(angle + time * ANGLE_SPEED) * COLOR_VARIANCE * centerFade;
    colorVar.g = baseColor.g + cos(dist * 4.0 + time * DIST_SPEED) * COLOR_VARIANCE * centerFade;
    colorVar.b = baseColor.b + sin(dist * 3.0 - time * (ANGLE_SPEED - 0.1)) * COLOR_VARIANCE * centerFade;
    
    colorVar = clamp(colorVar, baseColor - COLOR_CLAMP, baseColor + COLOR_CLAMP);
    colorVar = saturate(colorVar, COLOR_SATURATION);

    float diffuse = max(0.0, dot(normal, LIGHT_DIR));
    float specular = pow(max(0.0, dot(reflect(-LIGHT_DIR, normal), vec3(0.0, 0.0, 1.0))), SPECULAR_POWER);
    float fresnel = pow(1.0 - max(0.0, dot(normal, vec3(0.0, 0.0, 1.0))), FRESNEL_POWER);

    colorVar = colorVar * (0.7 + 0.3 * diffuse);
    colorVar += vec3(1.0) * specular * SPECULAR_INTENSITY;
    colorVar += colorVar * fresnel * 0.3;

    return colorVar;
}

void main() {
    vec2 uv = vUv;
    uv = uv * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;
    float t = time * MOVEMENT_SPEED + TIME_OFFSET;

    float totalField = 0.0;
    vec3 totalColor = vec3(0.0);
    vec3 totalNormal = vec3(0.0, 0.0, 1.0);
    
    // Process dynamic number of blobs
    for(int i = 0; i < 10; i++) {
        if(i >= blobCount) break;
        
        vec2 position;
        if(useAnimation) {
            // Use animated positions with offset from base position
            float offsetX = sin(t * (0.7 + float(i) * 0.1)) * MOVEMENT_RANGE * 0.3;
            float offsetY = cos(t * (0.8 + float(i) * 0.15)) * MOVEMENT_RANGE * 0.3;
            position = blobPositions[i] + vec2(offsetX, offsetY);
        } else {
            // Use static positions
            position = blobPositions[i];
        }
        
        float field = metaball(uv, position, blobRadii[i]);
        vec3 normal = calculateNormal(uv, position, field);
        totalField += field;
        
        float weight = field;
        if(totalField > 0.0) {
            vec3 blobColor = getVariedColor(blobColors[i], uv, position, t, normal);
            totalColor += blobColor * weight;
        }
    }
    
    // Normalize color by total field
    if(totalField > 0.0) {
        totalColor /= totalField;
    }

    float alpha = smoothstep(FIELD_THRESHOLD, 1.0, totalField);
    vec3 finalColor = mix(vec3(1.0), totalColor, alpha);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export interface Blob {
  id: number;
  position: [number, number];
  color: [number, number, number];
  radius: number;
}

export interface ShaderCanvasRef {
  exportImage: (size: number) => string;
  setTime: (time: number) => void;
}

interface ShaderCanvasProps {
  time: number;
  metaballRadius: number;
  size: number;
  blobs: Blob[];
  useAnimation: boolean;
  onBlobPositionChange: (id: number, position: [number, number]) => void;
}

const ShaderCanvas = forwardRef<ShaderCanvasRef, ShaderCanvasProps>(({ time, metaballRadius, size, blobs, useAnimation, onBlobPositionChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const locationsRef = useRef<{
    position: number;
    texCoord: number;
    time: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    metaballRadius: WebGLUniformLocation | null;
    blobCount: WebGLUniformLocation | null;
    blobPositions: WebGLUniformLocation | null;
    blobColors: WebGLUniformLocation | null;
    blobRadii: WebGLUniformLocation | null;
    useAnimation: WebGLUniformLocation | null;
  } | null>(null);
  const buffersRef = useRef<{
    position: WebGLBuffer | null;
    texCoord: WebGLBuffer | null;
  } | null>(null);

  // Mouse interaction state
  const dragStateRef = useRef<{
    isDragging: boolean;
    draggedBlobId: number | null;
    lastMousePos: { x: number; y: number } | null;
  }>({
    isDragging: false,
    draggedBlobId: null,
    lastMousePos: null,
  });

  const createShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const setupGL = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    // Try different WebGL context options with proper typing
    let gl: WebGLRenderingContext | null = null;
    
    try {
      gl = (canvas.getContext('webgl') || 
            canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    } catch (e) {
      console.error('Error creating WebGL context:', e);
    }
    
    if (!gl) {
      console.error('WebGL not supported in this browser');
      // Try to show a fallback message in the canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('WebGL not supported', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    console.log('WebGL context created successfully');
    console.log('WebGL version:', gl.getParameter(gl.VERSION));
    console.log('WebGL vendor:', gl.getParameter(gl.VENDOR));
    glRef.current = gl;

    // Create shader program
    const vertShader = createShader(gl, gl.VERTEX_SHADER, vertexShader);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);

    if (!vertShader || !fragShader) {
      console.error('Failed to create shaders');
      return;
    }

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    programRef.current = program;

    // Get locations
    locationsRef.current = {
      position: gl.getAttribLocation(program, 'position'),
      texCoord: gl.getAttribLocation(program, 'texCoord'),
      time: gl.getUniformLocation(program, 'time'),
      resolution: gl.getUniformLocation(program, 'resolution'),
      metaballRadius: gl.getUniformLocation(program, 'metaballRadius'),
      blobCount: gl.getUniformLocation(program, 'blobCount'),
      blobPositions: gl.getUniformLocation(program, 'blobPositions'),
      blobColors: gl.getUniformLocation(program, 'blobColors'),
      blobRadii: gl.getUniformLocation(program, 'blobRadii'),
      useAnimation: gl.getUniformLocation(program, 'useAnimation'),
    };

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

    buffersRef.current = {
      position: positionBuffer,
      texCoord: texCoordBuffer,
    };
  };

  const render = () => {
    const gl = glRef.current;
    const program = programRef.current;
    const locations = locationsRef.current;
    const buffers = buffersRef.current;

    if (!gl || !program || !locations || !buffers) {
      console.log('Render skipped - missing:', {
        gl: !!gl,
        program: !!program,
        locations: !!locations,
        buffers: !!buffers
      });
      return;
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Set uniforms
    gl.uniform1f(locations.time, time);
    gl.uniform2f(locations.resolution, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(locations.metaballRadius, metaballRadius);
    gl.uniform1i(locations.blobCount, blobs.length);
    gl.uniform1i(locations.useAnimation, useAnimation ? 1 : 0);
    
    // Set blob positions, colors, and radii
    const positions = new Float32Array(blobs.length * 2);
    const colors = new Float32Array(blobs.length * 3);
    const radii = new Float32Array(blobs.length);
    
    blobs.forEach((blob, i) => {
      positions[i * 2] = blob.position[0];
      positions[i * 2 + 1] = blob.position[1];
      colors[i * 3] = blob.color[0];
      colors[i * 3 + 1] = blob.color[1];
      colors[i * 3 + 2] = blob.color[2];
      radii[i] = blob.radius;
    });
    
    gl.uniform2fv(locations.blobPositions, positions);
    gl.uniform3fv(locations.blobColors, colors);
    gl.uniform1fv(locations.blobRadii, radii);

    // Set attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoord);
    gl.enableVertexAttribArray(locations.texCoord);
    gl.vertexAttribPointer(locations.texCoord, 2, gl.FLOAT, false, 0, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const exportImage = (exportSize: number): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';

    // Temporarily resize canvas for export
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    
    canvas.width = exportSize;
    canvas.height = exportSize;
    
    render();
    
    const dataURL = canvas.toDataURL('image/png');
    
    // Restore original size
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    render();
    
    return dataURL;
  };

  // Convert canvas coordinates to normalized coordinates
  const canvasToNormalizedCoords = (canvasX: number, canvasY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((canvasX - rect.left) / rect.width) * 2 - 1;
    const y = -(((canvasY - rect.top) / rect.height) * 2 - 1); // Flip Y axis
    
    // Adjust for aspect ratio
    const aspectRatio = canvas.width / canvas.height;
    return { x: x * aspectRatio, y };
  };

  // Find the closest blob to a position
  const findClosestBlob = (x: number, y: number): Blob | null => {
    let closestBlob: Blob | null = null;
    let minDistance = Infinity;
    
    blobs.forEach(blob => {
      const dx = blob.position[0] - x;
      const dy = blob.position[1] - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance && distance < 0.3) { // 0.3 is the interaction radius
        minDistance = distance;
        closestBlob = blob;
      }
    });
    
    return closestBlob;
  };

  // Mouse event handlers
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (useAnimation) return; // Don't allow dragging when animation is on
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { x, y } = canvasToNormalizedCoords(event.clientX, event.clientY, canvas);
    const closestBlob = findClosestBlob(x, y);
    
    if (closestBlob) {
      dragStateRef.current = {
        isDragging: true,
        draggedBlobId: closestBlob.id,
        lastMousePos: { x: event.clientX, y: event.clientY },
      };
      
      // Change cursor to indicate dragging
      canvas.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dragState = dragStateRef.current;
    
    if (dragState.isDragging && dragState.draggedBlobId && dragState.lastMousePos) {
      // Calculate the movement delta
      const deltaX = event.clientX - dragState.lastMousePos.x;
      const deltaY = event.clientY - dragState.lastMousePos.y;
      
      // Convert to normalized coordinates
      const rect = canvas.getBoundingClientRect();
      const normalizedDeltaX = (deltaX / rect.width) * 2;
      const normalizedDeltaY = -(deltaY / rect.height) * 2; // Flip Y axis
      
      // Adjust for aspect ratio
      const aspectRatio = canvas.width / canvas.height;
      const adjustedDeltaX = normalizedDeltaX * aspectRatio;
      
      // Find the blob being dragged
      const draggedBlob = blobs.find(blob => blob.id === dragState.draggedBlobId);
      if (draggedBlob) {
        const newX = Math.max(-1.5, Math.min(1.5, draggedBlob.position[0] + adjustedDeltaX));
        const newY = Math.max(-1.5, Math.min(1.5, draggedBlob.position[1] + normalizedDeltaY));
        
        onBlobPositionChange(dragState.draggedBlobId, [newX, newY]);
      }
      
      // Update last mouse position
      dragState.lastMousePos = { x: event.clientX, y: event.clientY };
    } else if (!useAnimation) {
      // Update cursor based on hover state
      const { x, y } = canvasToNormalizedCoords(event.clientX, event.clientY, canvas);
      const closestBlob = findClosestBlob(x, y);
      canvas.style.cursor = closestBlob ? 'grab' : 'default';
    }
  };

  const handleMouseUp = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    dragStateRef.current = {
      isDragging: false,
      draggedBlobId: null,
      lastMousePos: null,
    };
    
    canvas.style.cursor = 'default';
  };

  const handleMouseLeave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Stop dragging when mouse leaves the canvas
    dragStateRef.current = {
      isDragging: false,
      draggedBlobId: null,
      lastMousePos: null,
    };
    
    canvas.style.cursor = 'default';
  };

  useImperativeHandle(ref, () => ({
    exportImage,
    setTime: (newTime: number) => {
      // Time is controlled by props, this is just for potential future use
    }
  }));

  useEffect(() => {
    setupGL();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log('Render useEffect triggered with:', { time, metaballRadius, size, blobCount: blobs.length, useAnimation });
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('Canvas not found in render useEffect');
      return;
    }

    canvas.width = size;
    canvas.height = size;
    console.log('Canvas resized to:', canvas.width, 'x', canvas.height);
    render();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, metaballRadius, size, blobs, useAnimation]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        border: '1px solid #ccc',
        borderRadius: '8px',
        maxWidth: '100%',
        height: 'auto',
        cursor: useAnimation ? 'default' : 'grab',
        userSelect: 'none'
      }}
    />
  );
});

export default ShaderCanvas;
