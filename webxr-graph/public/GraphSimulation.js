import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GPUComputationRenderer } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/misc/GPUComputationRenderer.js';

export class GraphSimulation {
    constructor(renderer, nodes, edges) {
        this.renderer = renderer;
        this.nodes = nodes;
        this.edges = edges;
        this.initComputeRenderer();
    }

    initComputeRenderer() {
        const WIDTH = 16; // Adjust based on your needs
        const HEIGHT = Math.ceil(this.nodes.length / WIDTH);
        
        this.gpuCompute = new GPUComputationRenderer(WIDTH, HEIGHT, this.renderer);

        const positionTexture = this.gpuCompute.createTexture();
        const velocityTexture = this.gpuCompute.createTexture();

        this.fillPositionTexture(positionTexture);
        this.fillVelocityTexture(velocityTexture);

        this.positionVariable = this.gpuCompute.addVariable('texturePosition', this.getPositionShader(), positionTexture);
        this.velocityVariable = this.gpuCompute.addVariable('textureVelocity', this.getVelocityShader(), velocityTexture);

        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);

        this.positionUniforms = this.positionVariable.material.uniforms;
        this.velocityUniforms = this.velocityVariable.material.uniforms;

        this.positionUniforms.deltaTime = { value: 0.0 };
        this.velocityUniforms.deltaTime = { value: 0.0 };

        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error(error);
        }
    }

    fillPositionTexture(texture) {
        const theArray = texture.image.data;
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            theArray[i * 4 + 0] = node.x;
            theArray[i * 4 + 1] = node.y;
            theArray[i * 4 + 2] = node.z;
            theArray[i * 4 + 3] = 1;
        }
    }

    fillVelocityTexture(texture) {
        const theArray = texture.image.data;
        for (let i = 0; i < theArray.length; i++) {
            theArray[i] = 0;
        }
    }

    getPositionShader() {
        return `
            uniform float deltaTime;
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 pos = texture2D(texturePosition, uv);
                vec4 vel = texture2D(textureVelocity, uv);
                pos.xyz += vel.xyz * deltaTime;
                gl_FragColor = pos;
            }
        `;
    }

    getVelocityShader() {
        return `
            uniform float deltaTime;
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 pos = texture2D(texturePosition, uv);
                vec4 vel = texture2D(textureVelocity, uv);
                
                // Implement your force calculations here
                // This is a simplified example
                vec3 force = vec3(0.0);
                // Add spring forces, repulsion, etc.

                vel.xyz += force * deltaTime;
                vel.xyz *= 0.99; // damping
                gl_FragColor = vel;
            }
        `;
    }

    compute(deltaTime) {
        this.positionUniforms.deltaTime.value = deltaTime;
        this.velocityUniforms.deltaTime.value = deltaTime;
        this.gpuCompute.compute();
    }

    getCurrentPositions() {
        return this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
    }
}
