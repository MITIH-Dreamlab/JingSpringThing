// public/js/threeJS/threeGraph.js

import * as THREE from 'three';

/**
 * ForceGraph class manages the creation and updating of nodes and edges in the Three.js scene.
 */
export class ForceGraph {
    /**
     * Creates a new ForceGraph instance.
     * @param {THREE.Scene} scene - The Three.js scene.
     */
    constructor(scene) {
        this.scene = scene;
        this.nodes = [];
        this.links = [];
        this.nodeMeshes = new Map();
        this.linkMeshes = new Map();
    }

    /**
     * Updates the graph with new data.
     * @param {object} graphData - The graph data containing nodes and edges.
     */
    updateGraph(graphData) {
        this.nodes = graphData.nodes;
        this.links = graphData.edges;
        this.renderGraph();
    }

    /**
     * Renders the graph by creating and updating nodes and edges.
     */
    renderGraph() {
        this.updateNodes();
        this.updateLinks();
    }

    /**
     * Updates nodes in the scene based on the graph data.
     */
    updateNodes() {
        const newNodeIds = new Set(this.nodes.map(node => node.id));

        // Remove nodes that no longer exist
        this.nodeMeshes.forEach((mesh, nodeId) => {
            if (!newNodeIds.has(nodeId)) {
                this.scene.remove(mesh);
                this.nodeMeshes.delete(nodeId);
            }
        });

        // Add or update nodes
        this.nodes.forEach(node => {
            if (this.nodeMeshes.has(node.id)) {
                const mesh = this.nodeMeshes.get(node.id);
                mesh.position.set(node.x, node.y, node.z);
                // Optionally update node properties like color or size
            } else {
                // Create a new node mesh
                const geometry = new THREE.SphereGeometry(1.5, 16, 16);
                const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(node.x, node.y, node.z);
                mesh.userData = { id: node.id, name: node.label };
                this.scene.add(mesh);
                this.nodeMeshes.set(node.id, mesh);
            }
        });
    }

    /**
     * Updates edges in the scene based on the graph data.
     */
    updateLinks() {
        const newLinkKeys = new Set(this.links.map(link => `${link.source}-${link.target}`));

        // Remove edges that no longer exist
        this.linkMeshes.forEach((line, linkKey) => {
            if (!newLinkKeys.has(linkKey)) {
                this.scene.remove(line);
                this.linkMeshes.delete(linkKey);
            }
        });

        // Add or update edges
        this.links.forEach(link => {
            const linkKey = `${link.source}-${link.target}`;
            if (this.linkMeshes.has(linkKey)) {
                const line = this.linkMeshes.get(linkKey);
                const sourceMesh = this.nodeMeshes.get(link.source);
                const targetMesh = this.nodeMeshes.get(link.target);
                if (sourceMesh && targetMesh) {
                    const positions = line.geometry.attributes.position.array;
                    positions[0] = sourceMesh.position.x;
                    positions[1] = sourceMesh.position.y;
                    positions[2] = sourceMesh.position.z;
                    positions[3] = targetMesh.position.x;
                    positions[4] = targetMesh.position.y;
                    positions[5] = targetMesh.position.z;
                    line.geometry.attributes.position.needsUpdate = true;
                }
            } else {
                // Create a new edge line
                const sourceMesh = this.nodeMeshes.get(link.source);
                const targetMesh = this.nodeMeshes.get(link.target);
                if (sourceMesh && targetMesh) {
                    const geometry = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(sourceMesh.position.x, sourceMesh.position.y, sourceMesh.position.z),
                        new THREE.Vector3(targetMesh.position.x, targetMesh.position.y, targetMesh.position.z)
                    ]);
                    const material = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
                    const line = new THREE.Line(geometry, material);
                    this.scene.add(line);
                    this.linkMeshes.set(linkKey, line);
                }
            }
        });
    }
}
