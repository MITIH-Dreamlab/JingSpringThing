/**
 * GraphSimulation.js
 *
 * This class implements a GPU-accelerated force-directed graph layout algorithm.
 * It uses Three.js and GPUComputationRenderer for efficient parallel computations on the GPU.
 * The simulation applies repulsive forces between all nodes and attractive forces along edges
 * to create a balanced graph layout.
 *
 * Features:
 * - GPU-accelerated computations for high performance
 * - Configurable simulation parameters
 * - Support for dynamic graphs (adding/removing nodes and edges)
 * - Edge weight consideration in force calculations
 * - Automatic resizing of computation textures when node count changes significantly
 *
 * @author Your Name
 * @version 1.3
 * @license MIT
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GPUComputationRenderer } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/misc/GPUComputationRenderer.js';

export class GraphSimulation {
    /**
     * Creates a new GraphSimulation instance.
     * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
     * @param {Array} nodes - Array of node objects
     * @param {Array} edges - Array of edge objects
     */
    constructor(renderer, nodes, edges) {
        this.renderer = renderer;
        this.nodes = nodes;
        this.edges = edges;
        this.initDimensions();
        this.initComputeRenderer();
    }

    /**
     * Initializes the dimensions for the computation textures.
     */
    initDimensions() {
        this.WIDTH = Math.ceil(Math.sqrt(this.nodes.length));
        this.HEIGHT = Math.ceil(this.nodes.length / this.WIDTH);
        console.log(`Initializing dimensions: ${this.WIDTH}x${this.HEIGHT}`);
    }

    /**
     * Initializes the GPUComputationRenderer and sets up position and velocity variables.
     */
    initComputeRenderer() {
        console.log('Initializing GPUComputationRenderer');
        this.gpuCompute = new GPUComputationRenderer(this.WIDTH, this.HEIGHT, this.renderer);

        const dtPosition = this.gpuCompute.createTexture();
        const dtVelocity = this.gpuCompute.createTexture();
        const dtEdges = this.createEdgeTexture();

        this.fillPositionTexture(dtPosition);
        this.fillVelocityTexture(dtVelocity);

        this.positionVariable = this.gpuCompute.addVariable('texturePosition', this.getPositionShader(), dtPosition);
        this.velocityVariable = this.gpuCompute.addVariable('textureVelocity', this.getVelocityShader(), dtVelocity);

        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);

        this.initUniforms();

        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error('GPUComputationRenderer error:', error);
            throw new Error('Failed to initialize GPUComputationRenderer');
        }
    }

    /**
     * Initializes the uniforms for the velocity shader.
     */
    initUniforms() {
        const velocityUniforms = this.velocityVariable.material.uniforms;
        velocityUniforms.time = { value: 0.0 };
        velocityUniforms.delta = { value: 0.0 };
        velocityUniforms.edgeTexture = { value: this.createEdgeTexture() };
        velocityUniforms.nodeCount = { value: this.nodes.length };
        velocityUniforms.edgeCount = { value: this.edges.length };
        velocityUniforms.repulsionStrength = { value: 50.0 };
        velocityUniforms.attractionStrength = { value: 0.1 };
        velocityUniforms.maxSpeed = { value: 10.0 };
        velocityUniforms.damping = { value: 0.99 };
        velocityUniforms.centeringForce = { value: 0.01 };
        velocityUniforms.edgeDistance = { value: 1.0 };
    }

    /**
     * Creates a texture containing edge data for use in the velocity shader.
     * @returns {THREE.DataTexture} Texture containing edge data
     */
    createEdgeTexture() {
        const data = new Float32Array(this.WIDTH * this.HEIGHT * 4);
        for (let i = 0; i < this.edges.length; i++) {
            const edge = this.edges[i];
            const sourceIndex = this.nodes.findIndex(n => n.name === edge.source);
            const targetIndex = this.nodes.findIndex(n => n.name === edge.target);
            data[i * 4] = sourceIndex;
            data[i * 4 + 1] = targetIndex;
            data[i * 4 + 2] = edge.weight || 1.0; // Use weight if available, otherwise default to 1
            data[i * 4 + 3] = 1; // Unused, but needed for RGBA texture format
        }
        const texture = new THREE.DataTexture(data, this.WIDTH, this.HEIGHT, THREE.RGBAFormat, THREE.FloatType);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * Fills the position texture with initial node positions.
     * @param {THREE.DataTexture} texture - The position texture to fill
     */
    fillPositionTexture(texture) {
        const theArray = texture.image.data;
        for (let i = 0; i < this.nodes.length; i++) {
            const stride = i * 4;
            // Initialize with random positions in a cube
            theArray[stride] = Math.random() * 200 - 100;
            theArray[stride + 1] = Math.random() * 200 - 100;
            theArray[stride + 2] = Math.random() * 200 - 100;
            theArray[stride + 3] = 1; // W component
        }
    }

    /**
     * Fills the velocity texture with initial velocities (all zero).
     * @param {THREE.DataTexture} texture - The velocity texture to fill
     */
    fillVelocityTexture(texture) {
        const theArray = texture.image.data;
        for (let i = 0; i < theArray.length; i++) {
            theArray[i] = 0;
        }
    }

    /**
     * Returns the GLSL shader code for position updates.
     * @returns {string} GLSL shader code
     */
    getPositionShader() {
        return `
            uniform float delta;
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 pos = texture2D(texturePosition, uv);
                vec4 vel = texture2D(textureVelocity, uv);
                // Update position based on velocity
                pos.xyz += vel.xyz * delta;
                gl_FragColor = pos;
            }
        `;
    }

    /**
     * Returns the GLSL shader code for velocity updates.
     * This is where the force-directed algorithm is implemented.
     * @returns {string} GLSL shader code
     */
    getVelocityShader() {
        return `
            uniform float time;
            uniform float delta;
            uniform sampler2D edgeTexture;
            uniform float nodeCount;
            uniform float edgeCount;
            uniform float repulsionStrength;
            uniform float attractionStrength;
            uniform float maxSpeed;
            uniform float damping;
            uniform float centeringForce;
            uniform float edgeDistance;

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 pos = texture2D(texturePosition, uv);
                vec4 vel = texture2D(textureVelocity, uv);
                
                vec3 force = vec3(0.0);
                
                // Repulsive force
                for (float y = 0.0; y < 1.0; y += 1.0 / ${this.HEIGHT}.0) {
                    for (float x = 0.0; x < 1.0; x += 1.0 / ${this.WIDTH}.0) {
                        vec3 otherPos = texture2D(texturePosition, vec2(x, y)).xyz;
                        vec3 diff = pos.xyz - otherPos;
                        float dist = length(diff);
                        if (dist > 0.0001 && dist < 50.0) {
                            force += normalize(diff) * repulsionStrength / (dist * dist);
                        }
                    }
                }
                
                // Attractive force (edges)
                for (float i = 0.0; i < ${this.edges.length}.0; i += 1.0) {
                    vec4 edge = texture2D(edgeTexture, vec2((i + 0.5) / ${this.WIDTH}.0, 0.5 / ${this.HEIGHT}.0));
                    if (edge.x == gl_FragCoord.x || edge.y == gl_FragCoord.x) {
                        vec3 otherPos = texture2D(texturePosition, vec2(
                            edge.x == gl_FragCoord.x ? edge.y : edge.x,
                            0.5
                        ) / resolution.xy).xyz;
                        vec3 diff = otherPos - pos.xyz;
                        float dist = length(diff);
                        force += normalize(diff) * attractionStrength * edge.z * (dist - edgeDistance);
                    }
                }
                
                // Centering force to prevent drift
                force += -pos.xyz * centeringForce;
                
                // Update velocity
                vel.xyz = vel.xyz + force * delta;
                
                // Limit speed
                float speed = length(vel.xyz);
                if (speed > maxSpeed) {
                    vel.xyz = normalize(vel.xyz) * maxSpeed;
                }
                
                // Apply damping
                vel.xyz *= damping;

                gl_FragColor = vel;
            }
        `;
    }

    /**
     * Performs one step of the simulation.
     * @param {number} deltaTime - Time step for the simulation
     */
    compute(deltaTime) {
        if (!this.gpuCompute) {
            console.error('GPUCompute not initialized');
            return;
        }
        this.velocityVariable.material.uniforms.time.value += deltaTime;
        this.velocityVariable.material.uniforms.delta.value = deltaTime;
        this.gpuCompute.compute();
    }

    /**
     * Retrieves the current positions of all nodes.
     * @returns {THREE.Texture} Texture containing current positions
     */
    getCurrentPositions() {
        if (!this.gpuCompute || !this.positionVariable) {
            console.error('GPUCompute or positionVariable not initialized');
            return null;
        }
        return this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
    }

    /**
     * Retrieves the current velocities of all nodes.
     * @returns {THREE.Texture} Texture containing current velocities
     */
    getCurrentVelocities() {
        if (!this.gpuCompute || !this.velocityVariable) {
            console.error('GPUCompute or velocityVariable not initialized');
            return null;
        }
        return this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture;
    }

    /**
     * Updates simulation parameters.
     * @param {Object} params - Object containing parameter updates
     */
    setSimulationParameters(params) {
        const uniforms = this.velocityVariable.material.uniforms;
        if (params.repulsionStrength !== undefined) uniforms.repulsionStrength.value = params.repulsionStrength;
        if (params.attractionStrength !== undefined) uniforms.attractionStrength.value = params.attractionStrength;
        if (params.maxSpeed !== undefined) uniforms.maxSpeed.value = params.maxSpeed;
        if (params.damping !== undefined) uniforms.damping.value = params.damping;
        if (params.centeringForce !== undefined) uniforms.centeringForce.value = params.centeringForce;
        if (params.edgeDistance !== undefined) uniforms.edgeDistance.value = params.edgeDistance;
    }

    /**
     * Updates the node data. Call this if nodes are added or removed.
     * @param {Array} nodes - New array of node objects
     */
    updateNodeData(nodes) {
        const oldNodeCount = this.nodes.length;
        this.nodes = nodes;
        if (Math.abs(oldNodeCount - nodes.length) > oldNodeCount * 0.1) {
            // If node count changed by more than 10%, reinitialize
            console.log('Node count changed significantly. Reinitializing simulation.');
            this.initDimensions();
            this.initComputeRenderer();
        } else {
            this.velocityVariable.material.uniforms.nodeCount.value = this.nodes.length;
        }
    }

    /**
     * Updates the edge data. Call this if edges are added or removed.
     * @param {Array} edges - New array of edge objects
     */
    updateEdgeData(edges) {
        this.edges = edges;
        const dtEdges = this.createEdgeTexture();
        this.velocityVariable.material.uniforms.edgeTexture.value = dtEdges;
        this.velocityVariable.material.uniforms.edgeCount.value = this.edges.length;
    }

    /**
     * Updates the positions of nodes. Used for manual position updates (e.g., from user interaction).
     * @param {Float32Array} positionArray - Array of new positions (x, y, z, w for each node)
     */
    updateNodePositions(positionArray) {
        const positionTexture = this.getCurrentPositions();
        if (positionTexture && positionTexture.image) {
            positionTexture.image.data.set(positionArray);
            positionTexture.needsUpdate = true;
        } else {
            console.error('Position texture not available for updating');
        }
    }
}
