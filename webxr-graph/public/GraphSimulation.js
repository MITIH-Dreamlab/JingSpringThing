// GraphSimulation.js

import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

export class GraphSimulation {
    /**
     * Creates a new GraphSimulation instance.
     * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
     * @param {Array} nodes - Array of node objects
     * @param {Array} edges - Array of edge objects
     */
    constructor(renderer, nodes, edges) {
        console.log('Initializing GraphSimulation');
        this.renderer = renderer;
        this.nodes = nodes;
        this.edges = edges;
        this.initDimensions();
        this.simulationParams = {}; // Initialize simulation parameters
        this.useCPUSimulation = false; // Default to GPU simulation
        try {
            this.initComputeRenderer();
        } catch (error) {
            console.warn('GPU computation not available, falling back to CPU simulation');
            this.useCPUSimulation = true;
        }
        
        // Set the simulation type for easy access
        this.simulationType = this.useCPUSimulation ? 'CPU' : 'GPU';
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
        try {
            this.gpuCompute = new GPUComputationRenderer(this.WIDTH, this.HEIGHT, this.renderer);

            if (!this.gpuCompute.isSupported) {
                console.error('GPUComputationRenderer is not supported on this device');
                throw new Error('GPUComputationRenderer not supported');
            }

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
                console.error('GPUComputationRenderer init error:', error);
                throw new Error('Failed to initialize GPUComputationRenderer');
            }

            console.log('GPUComputationRenderer initialized successfully');
        } catch (error) {
            console.error('Error in initComputeRenderer:', error);
            throw error;
        }
    }

    /**
     * Initializes the uniforms for the velocity shader.
     */
    initUniforms() {
        console.log('Initializing uniforms');
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
        console.log('Creating edge texture');
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
        console.log('Filling position texture');
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
        console.log('Filling velocity texture');
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

                // Check for NaN
                if (isnan(vel.x) || isnan(vel.y) || isnan(vel.z)) {
                    vel.xyz = vec3(0.0);
                }

                gl_FragColor = vel;
            }
        `;
    }

    /**
     * Performs one step of the simulation.
     * @param {number} deltaTime - Time step for the simulation
     */
    compute(deltaTime) {
        if (this.useCPUSimulation) {
            this.computeCPU(deltaTime);
        } else if (this.gpuCompute) {
            this.velocityVariable.material.uniforms.time.value += deltaTime;
            this.velocityVariable.material.uniforms.delta.value = deltaTime;
            this.gpuCompute.compute();
        } else {
            console.warn('Neither GPU nor CPU simulation is available.');
        }
    }

    /**
     * Performs one step of the simulation on the CPU.
     * @param {number} deltaTime - Time step for the simulation
     */
    computeCPU(deltaTime) {
        const repulsionStrength = this.simulationParams.repulsionStrength || 60.0;
        const attractionStrength = this.simulationParams.attractionStrength || 0.15;
        const maxSpeed = this.simulationParams.maxSpeed || 12.0;
        const damping = this.simulationParams.damping || 0.98;
        const centeringForce = this.simulationParams.centeringForce || 0.005;
        const edgeDistance = this.simulationParams.edgeDistance || 5.0;

        // Initialize velocities if not exists
        if (!this.velocities) {
            this.velocities = this.nodes.map(() => ({ x: 0, y: 0, z: 0 }));
        }

        // Calculate forces
        for (let i = 0; i < this.nodes.length; i++) {
            let force = { x: 0, y: 0, z: 0 };

            // Repulsive force
            for (let j = 0; j < this.nodes.length; j++) {
                if (i !== j) {
                    const dx = this.nodes[i].x - this.nodes[j].x;
                    const dy = this.nodes[i].y - this.nodes[j].y;
                    const dz = this.nodes[i].z - this.nodes[j].z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (distance > 0 && distance < 50) {
                        const repulsion = repulsionStrength / (distance * distance);
                        force.x += dx / distance * repulsion;
                        force.y += dy / distance * repulsion;
                        force.z += dz / distance * repulsion;
                    }
                }
            }

            // Attractive force (edges)
            this.edges.forEach(edge => {
                if (edge.source === this.nodes[i].id || edge.target === this.nodes[i].id) {
                    const otherNode = this.nodes.find(n => n.id === (edge.source === this.nodes[i].id ? edge.target : edge.source));
                    const dx = otherNode.x - this.nodes[i].x;
                    const dy = otherNode.y - this.nodes[i].y;
                    const dz = otherNode.z - this.nodes[i].z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    const attraction = attractionStrength * (distance - edgeDistance);
                    force.x += dx / distance * attraction;
                    force.y += dy / distance * attraction;
                    force.z += dz / distance * attraction;
                }
            });

            // Centering force
            force.x -= this.nodes[i].x * centeringForce;
            force.y -= this.nodes[i].y * centeringForce;
            force.z -= this.nodes[i].z * centeringForce;

            // Update velocity
            this.velocities[i].x = (this.velocities[i].x + force.x * deltaTime) * damping;
            this.velocities[i].y = (this.velocities[i].y + force.y * deltaTime) * damping;
            this.velocities[i].z = (this.velocities[i].z + force.z * deltaTime) * damping;

            // Limit speed
            const speed = Math.sqrt(
                this.velocities[i].x * this.velocities[i].x +
                this.velocities[i].y * this.velocities[i].y +
                this.velocities[i].z * this.velocities[i].z
            );
            if (speed > maxSpeed) {
                const ratio = maxSpeed / speed;
                this.velocities[i].x *= ratio;
                this.velocities[i].y *= ratio;
                this.velocities[i].z *= ratio;
            }

            // Update position
            const newX = this.nodes[i].x + this.velocities[i].x * deltaTime;
            const newY = this.nodes[i].y + this.velocities[i].y * deltaTime;
            const newZ = this.nodes[i].z + this.velocities[i].z * deltaTime;

            if (isNaN(newX) || isNaN(newY) || isNaN(newZ)) {
                console.warn(`NaN position computed for node ${i}: (${newX}, ${newY}, ${newZ})`);
                continue; // Skip this node
            }

            this.nodes[i].x = newX;
            this.nodes[i].y = newY;
            this.nodes[i].z = newZ;
        }
    }

    /**
     * Updates the node data for the simulation.
     * @param {Array} newNodes - The new array of nodes
     */
    updateNodeData(newNodes) {
        this.nodes = newNodes;
        this.initDimensions();
        if (!this.useCPUSimulation) {
            const dtPosition = this.gpuCompute.createTexture();
            this.fillPositionTexture(dtPosition);
            this.positionVariable.material.uniforms.texturePosition.value = dtPosition;
        }
    }

    /**
     * Updates the edge data for the simulation.
     * @param {Array} newEdges - The new array of edges
     */
    updateEdgeData(newEdges) {
        this.edges = newEdges;
        if (!this.useCPUSimulation) {
            this.velocityVariable.material.uniforms.edgeTexture.value = this.createEdgeTexture();
            this.velocityVariable.material.uniforms.edgeCount.value = this.edges.length;
        }
    }

    /**
     * Sets the simulation parameters.
     * @param {Object} params - The simulation parameters
     */
    setSimulationParameters(params) {
        this.simulationParams = { ...this.simulationParams, ...params };
        if (!this.useCPUSimulation) {
            const velocityUniforms = this.velocityVariable.material.uniforms;
            velocityUniforms.repulsionStrength.value = params.repulsionStrength || velocityUniforms.repulsionStrength.value;
            velocityUniforms.attractionStrength.value = params.attractionStrength || velocityUniforms.attractionStrength.value;
            velocityUniforms.maxSpeed.value = params.maxSpeed || velocityUniforms.maxSpeed.value;
            velocityUniforms.damping.value = params.damping || velocityUniforms.damping.value;
            velocityUniforms.centeringForce.value = params.centeringForce || velocityUniforms.centeringForce.value;
            velocityUniforms.edgeDistance.value = params.edgeDistance || velocityUniforms.edgeDistance.value;
        }
    }
}
