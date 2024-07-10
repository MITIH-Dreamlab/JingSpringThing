export async function initWebGPU() {
    if (!navigator.gpu) {
        throw new Error('WebGPU not supported on this browser.');
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('No appropriate GPUAdapter found.');
    }
    return await adapter.requestDevice();
}

export async function createComputePipeline(device) {
    const shaderModule = device.createShaderModule({
        code: `
            struct Node {
                position : vec4<f32>,
                velocity : vec4<f32>,
                size : f32,
            };

            struct Edge {
                sourceIndex : u32,
                targetIndex : u32,
                weight : f32,
            };

            @group(0) @binding(0) var<storage, read_write> nodes : array<Node>;
            @group(0) @binding(1) var<storage, read> edges : array<Edge>;

            const SPRING_CONSTANT : f32 = 0.01;
            const DAMPING_FACTOR : f32 = 0.95;
            const REPULSION_STRENGTH : f32 = 0.001;

            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
                let index = global_id.x;
                if (index >= arrayLength(&nodes)) {
                    return;
                }

                var force = vec3<f32>(0.0, 0.0, 0.0);

                // Apply repulsive force between all nodes
                for (var i = 0u; i < arrayLength(&nodes); i++) {
                    if (i == index) {
                        continue;
                    }
                    let diff = nodes[index].position.xyz - nodes[i].position.xyz;
                    let distance = length(diff);
                    if (distance > 0.0) {
                        force += normalize(diff) * REPULSION_STRENGTH / (distance * distance);
                    }
                }

                // Apply spring force along edges
                for (var i = 0u; i < arrayLength(&edges); i++) {
                    if (edges[i].sourceIndex == index) {
                        let targetNode = nodes[edges[i].targetIndex];
                        let diff = targetNode.position.xyz - nodes[index].position.xyz;
                        let distance = length(diff);
                        let direction = normalize(diff);
                        let springForce = SPRING_CONSTANT * edges[i].weight * (distance - (nodes[index].size + targetNode.size) / 2.0);
                        force += direction * springForce;
                    }
                }

                // Update velocity and position using Verlet integration
                let acceleration = force / nodes[index].size;
                nodes[index].position.xyz += (nodes[index].velocity.xyz + acceleration * 0.5) * 0.016;
                nodes[index].velocity.xyz = (nodes[index].velocity.xyz + acceleration) * DAMPING_FACTOR;
            }
        `
    });

    return device.createComputePipeline({
        layout: 'auto',
        compute: {
            module: shaderModule,
            entryPoint: 'main',
        },
    });
}

export function createBuffersAndBindGroups(device, nodes, edges){
    // Create buffer for nodes
    const nodeData = new Float32Array(nodes.length * 4 + nodes.length * 4);
    nodes.forEach((node, i) => {
        nodeData[i * 8] = Math.random() * 100 - 50; // x
        nodeData[i * 8 + 1] = Math.random() * 100 - 50; // y
        nodeData[i * 8 + 2] = Math.random() * 100 - 50; // z
        nodeData[i * 8 + 3] = 0; // w
        nodeData[i * 8 + 4] = 0; // vx
        nodeData[i * 8 + 5] = 0; // vy
        nodeData[i * 8 + 6] = 0; // vz
        nodeData[i * 8 + 7] = Math.sqrt(node.size) * 0.05; // size
    });
    const nodeBuffer = device.createBuffer({
        size: nodeData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        mappedAtCreation: true,
    });
    new Float32Array(nodeBuffer.getMappedRange()).set(nodeData);
    nodeBuffer.unmap();

    // Create buffer for edges
    const edgeData = new Uint32Array(edges.length * 3);
    edges.forEach((edge, i) => {
        edgeData[i * 3] = edge.sourceIndex;
        edgeData[i * 3 + 1] = edge.targetIndex;
        edgeData[i * 3 + 2] = edge.weight;
    });
    const edgeBuffer = device.createBuffer({
        size: edgeData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Uint32Array(edgeBuffer.getMappedRange()).set(edgeData);
    edgeBuffer.unmap();

    // Create bind group
    const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: nodeBuffer } },
            { binding: 1, resource: { buffer: edgeBuffer } },
        ],
    });

    return { nodeBuffer, edgeBuffer, bindGroup };
}
