// GraphSimulation.js

import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

export class GraphSimulation {
    /**
     * Creates a new GraphSimulation instance.
     * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
     * @param {Array<Object>} nodes - Array of node objects
     * @param {Array<Object>} edges - Array of edge objects
     */
    constructor(renderer, nodes, edges) {
        this.renderer = renderer;
        this.nodes = nodes;
        this.edges = edges;
        this.initDimensions();
        this.simulationParams = this.getDefaultSimulationParams();
        this.useCPUSimulation = !this.initGPUSimulation();
        
        console.log(`Using ${this.useCPUSimulation ? 'CPU' : 'GPU'} simulation`);
    }

    /**
     * Initializes the dimensions for the computation textures.
     */
    initDimensions() {
        this.WIDTH = Math.ceil(Math.sqrt(this.nodes.length));
        this.HEIGHT = Math.ceil(this.nodes.length / this.WIDTH);
    }

    /**
     * Initializes GPU simulation. Falls back to CPU if not supported.
     * @returns {boolean} Whether GPU simulation was successfully initialized
     */
    initGPUSimulation() {
        try {
            this.gpuCompute = new GPUComputationRenderer(this.WIDTH, this.HEIGHT, this.renderer);

            if (!this.gpuCompute.isSupported) {
                throw new Error('GPUComputationRenderer not supported');
            }

            const dtPosition = this.gpuCompute.createTexture();
            const dtVelocity = this.gpuCompute.createTexture();

            this.fillPositionTexture(dtPosition);
            this.fillVelocityTexture(dtVelocity);

            this.positionVariable = this.gpuCompute.addVariable('texturePosition', this.getPositionShader(), dtPosition);
            this.velocityVariable = this.gpuCompute.addVariable('textureVelocity', this.getVelocityShader(), dtVelocity);

            this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
            this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);

            this.initUniforms();

            const error = this.gpuCompute.init();
            if (error !== null) {
                throw new Error(`GPUComputationRenderer init error: ${error}`);
            }

            return true;
        } catch (error) {
            console.warn('GPU computation not available, falling back to CPU simulation:', error);
            return false;
        }
    }

    /**
     * Initializes the uniforms for the velocity shader.
     */
    initUniforms() {
        const velocityUniforms = this.velocityVariable.material.uniforms;
        Object.assign(velocityUniforms, {
            time: { value: 0.0 },
            delta: { value: 0.0 },
            edgeTexture: { value: this.createEdgeTexture() },
            nodeCount: { value: this.nodes.length },
            edgeCount: { value: this.edges.length },
            ...this.simulationParams
        });
    }

    /**
     * Creates a texture containing edge data for use in the velocity shader.
     * @returns {THREE.DataTexture} Texture containing edge data
     */
    createEdgeTexture() {
        const data = new Float32Array(this.WIDTH * this.HEIGHT * 4);
        this.edges.forEach((edge, i) => {
            const sourceIndex = this.nodes.findIndex(n => n.id === edge.source);
            const targetIndex = this.nodes.findIndex(n => n.id === edge.target);
            data[i * 4] = sourceIndex;
            data[i * 4 + 1] = targetIndex;
            data[i * 4 + 2] = edge.weight || 1.0;
            data[i * 4 + 3] = 1; // Unused, but needed for RGBA texture format
        });
        return new THREE.DataTexture(data, this.WIDTH, this.HEIGHT, THREE.RGBAFormat, THREE.FloatType);
    }

    /**
     * Fills the position texture with initial node positions.
     * @param {THREE.DataTexture} texture - The position texture to fill
     */
    fillPositionTexture(texture) {
        const theArray = texture.image.data;
        this.nodes.forEach((node, i) => {
            const stride = i * 4;
            theArray[stride] = Math.random() * 200 - 100;
            theArray[stride + 1] = Math.random() * 200 - 100;
            theArray[stride + 2] = Math.random() * 200 - 100;
            theArray[stride + 3] = 1; // W component
        });
    }

    /**
     * Fills the velocity texture with initial velocities (all zero).
     * @param {THREE.DataTexture} texture - The velocity texture to fill
     */
    fillVelocityTexture(texture) {
        const theArray = texture.image.data;
        theArray.fill(0);
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
                pos.xyz += vel.xyz * delta;
                gl_FragColor = pos;
            }
        `;
    }

    /**
     * Returns the GLSL shader code for velocity updates.
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
                
                force += -pos.xyz * centeringForce;
                
                vel.xyz = (vel.xyz + force * delta) * damping;
                
                float speed = length(vel.xyz);
                if (speed > maxSpeed) {
                    vel.xyz = normalize(vel.xyz) * maxSpeed;
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
        } else {
            this.computeGPU(deltaTime);
        }
    }

    /**
     * Performs one step of the GPU simulation.
     * @param {number} deltaTime - Time step for the simulation
     */
    computeGPU(deltaTime) {
        this.velocityVariable.material.uniforms.time.value += deltaTime;
        this.velocityVariable.material.uniforms.delta.value = deltaTime;
        this.gpuCompute.compute();
    }

    /**
     * Performs one step of the CPU simulation.
     * @param {number} deltaTime - Time step for the simulation
     */
    computeCPU(deltaTime) {
        const { repulsionStrength, attractionStrength, maxSpeed, damping, centeringForce, edgeDistance } = this.simulationParams;

        if (!this.velocities) {
            this.velocities = this.nodes.map(() => new THREE.Vector3());
        }

        const tempVec = new THREE.Vector3();

        this.nodes.forEach((node, i) => {
            const force = new THREE.Vector3();
            const nodePos = new THREE.Vector3(node.x, node.y, node.z);

            // Repulsive force
            this.nodes.forEach((otherNode, j) => {
                if (i !== j) {
                    tempVec.set(otherNode.x, otherNode.y, otherNode.z).sub(nodePos);
                    const distance = tempVec.length();
                    if (distance > 0 && distance < 50) {
                        force.add(tempVec.normalize().multiplyScalar(repulsionStrength.value / (distance * distance)));
                    }
                }
            });

            // Attractive force (edges)
            this.edges.forEach(edge => {
                if (edge.source === node.id || edge.target === node.id) {
                    const otherNode = this.nodes.find(n => n.id === (edge.source === node.id ? edge.target : edge.source));
                    tempVec.set(otherNode.x, otherNode.y, otherNode.z).sub(nodePos);
                    const distance = tempVec.length();
                    const attraction = attractionStrength.value * (distance - edgeDistance.value);
                    force.add(tempVec.normalize().multiplyScalar(attraction));
                }
            });

            // Centering force
            force.sub(nodePos.multiplyScalar(centeringForce.value));

            // Update velocity
            this.velocities[i].add(force.multiplyScalar(deltaTime)).multiplyScalar(damping.value);

            // Limit speed
            if (this.velocities[i].length() > maxSpeed.value) {
                this.velocities[i].setLength(maxSpeed.value);
            }

            // Update position
            node.x += this.velocities[i].x * deltaTime;
            node.y += this.velocities[i].y * deltaTime;
            node.z += this.velocities[i].z * deltaTime;
        });
    }

    /**
     * Updates the node data for the simulation.
     * @param {Array<Object>} newNodes - The new array of nodes
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
     * @param {Array<Object>} newEdges - The new array of edges
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
            Object.assign(this.velocityVariable.material.uniforms, this.simulationParams);
        }
    }

    /**
     * Returns the default simulation parameters.
     * @returns {Object} The default simulation parameters
     */
    getDefaultSimulationParams() {
        return {
            repulsionStrength: { value: 60.0 },
            attractionStrength: { value: 0.15 },
            maxSpeed: { value: 12.0 },
            damping: { value: 0.98 },
            centeringForce: { value: 0.005 },
            edgeDistance: { value: 5.0 }
        };
    }

    /**
     * Gets the current positions of all nodes.
     * @returns {Float32Array} Array of node positions
     */
    getNodePositions() {
        if (this.useCPUSimulation) {
            return new Float32Array(this.nodes.flatMap(node => [node.x, node.y, node.z, 1]));
        } else {
            return this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture.image.data;
        }
    }
}
