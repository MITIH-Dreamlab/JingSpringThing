// public/js/components/visualization.js

import * as THREE from 'three';
import { OrbitControls } from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/jsm/controls/OrbitControls.js';
import { initXRSession, handleXRSession } from '../xr/xrSetup.js';
import { initXRInteraction, addNodeLabels, updateLabelOrientations } from '../xr/xrInteraction.js';
import { isGPUAvailable, initGPU, computeOnGPU } from '../gpuUtils.js';

/**
 * Visualization class handles the creation and rendering of the 3D graph using Three.js.
 */
export class Visualization {
    /**
     * Creates a new Visualization instance.
     * @param {GraphDataManager} graphDataManager - The GraphDataManager instance.
     */
    constructor(graphDataManager) {
        this.graphDataManager = graphDataManager;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.nodeLabels = [];
        this.labelsGroup = null;
        this.gpu = null;
        this.isGPUEnabled = false;

        // Mesh pools for nodes and edges
        this.nodeMeshes = new Map();
        this.edgeMeshes = new Map();
    }

    /**
     * Initializes the Three.js scene, camera, renderer, controls, and XR sessions.
     */
    initialize() {
        this.initThreeJS();
        this.setupGPU();
        initXRSession(this.renderer, this.scene, this.camera);
        initXRInteraction(this.scene, this.camera, this.renderer, this.onSelect.bind(this));
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.animate();
    }

    /**
     * Sets up GPU acceleration if available.
     */
    setupGPU() {
        if (isGPUAvailable()) {
            this.gpu = initGPU();
            this.isGPUEnabled = true;
            console.log('GPU acceleration enabled.');
        } else {
            console.warn('GPU acceleration not available. Falling back to CPU rendering.');
            this.isGPUEnabled = false;
        }
    }

    /**
     * Initializes the Three.js scene, camera, renderer, and controls.
     */
    initThreeJS() {
        // Create the scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.002);

        // Create the camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 100);

        // Create the renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.xr.enabled = true; // Enable WebXR
        document.getElementById('scene-container').appendChild(this.renderer.domElement);

        // Add orbit controls for camera manipulation
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Add ambient light to the scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Add directional light to the scene
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(50, 50, 50);
        this.scene.add(directionalLight);

        // Create a group for labels
        this.labelsGroup = new THREE.Group();
        this.scene.add(this.labelsGroup);
    }

    /**
     * Handles node selection via controllers.
     * @param {THREE.Object3D} selectedObject - The selected Three.js object.
     */
    onSelect(selectedObject) {
        if (selectedObject && selectedObject.userData && selectedObject.userData.id) {
            console.log(`Selected Node: ${selectedObject.userData.name}`);
            // Display node information
            const nodeInfo = {
                id: selectedObject.userData.id,
                name: selectedObject.userData.name,
                // Add more properties as needed
            };
            // Emit a custom event to update the UI
            const event = new CustomEvent('nodeSelected', { detail: nodeInfo });
            window.dispatchEvent(event);
        }
    }

    /**
     * Updates the visualization with new graph data.
     */
    updateVisualization() {
        const graphData = this.graphDataManager.getGraphData();
        if (!graphData) return;

        // Update nodes
        graphData.nodes.forEach(node => {
            if (this.nodeMeshes.has(node.id)) {
                const mesh = this.nodeMeshes.get(node.id);
                mesh.position.set(node.x, node.y, node.z);
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

        // Remove nodes that no longer exist
        const existingNodeIds = new Set(graphData.nodes.map(node => node.id));
        this.nodeMeshes.forEach((mesh, nodeId) => {
            if (!existingNodeIds.has(nodeId)) {
                this.scene.remove(mesh);
                this.nodeMeshes.delete(nodeId);
            }
        });

        // Update edges
        graphData.edges.forEach(edge => {
            const edgeKey = `${edge.source}-${edge.target}`;
            if (this.edgeMeshes.has(edgeKey)) {
                const line = this.edgeMeshes.get(edgeKey);
                const sourceMesh = this.nodeMeshes.get(edge.source);
                const targetMesh = this.nodeMeshes.get(edge.target);
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
                const sourceMesh = this.nodeMeshes.get(edge.source);
                const targetMesh = this.nodeMeshes.get(edge.target);
                if (sourceMesh && targetMesh) {
                    const geometry = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(sourceMesh.position.x, sourceMesh.position.y, sourceMesh.position.z),
                        new THREE.Vector3(targetMesh.position.x, targetMesh.position.y, targetMesh.position.z)
                    ]);
                    const material = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
                    const line = new THREE.Line(geometry, material);
                    this.scene.add(line);
                    this.edgeMeshes.set(edgeKey, line);
                }
            }
        });

        // Remove edges that no longer exist
        const existingEdgeKeys = new Set(graphData.edges.map(edge => `${edge.source}-${edge.target}`));
        this.edgeMeshes.forEach((line, edgeKey) => {
            if (!existingEdgeKeys.has(edgeKey)) {
                this.scene.remove(line);
                this.edgeMeshes.delete(edgeKey);
            }
        });

        // Add or update labels
        this.addLabels(graphData.nodes);
    }

    /**
     * Adds labels as billboards to nodes.
     * @param {Array} nodes - Array of node objects.
     */
    addLabels(nodes) {
        // Clear existing labels
        while (this.labelsGroup.children.length > 0) {
            const label = this.labelsGroup.children[0];
            this.labelsGroup.remove(label);
        }

        // Load font and create labels
        const loader = new THREE.FontLoader();
        loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
            nodes.forEach(node => {
                const textGeometry = new THREE.TextGeometry(node.label, {
                    font: font,
                    size: 2,
                    height: 0.1,
                    curveSegments: 12,
                    bevelEnabled: false,
                });

                const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.position.set(node.x, node.y + 5, node.z);
                textMesh.lookAt(this.camera.position); // Make the label face the camera

                this.labelsGroup.add(textMesh);
                this.nodeLabels.push(textMesh);
            });
        });
    }

    /**
     * Continuously renders the scene and updates label orientations.
     */
    animate() {
        const animateLoop = () => {
            requestAnimationFrame(animateLoop);

            // Update controls
            this.controls.update();

            // Update label orientations to face the camera
            this.updateLabels();

            // GPU acceleration (if enabled)
            if (this.isGPUEnabled && this.gpu) {
                computeOnGPU(this.gpu, { /* Pass necessary data */ });
            }

            // Render the scene
            this.renderer.render(this.scene, this.camera);
        };

        animateLoop();
    }

    /**
     * Updates the orientation of labels to always face the camera.
     */
    updateLabels() {
        this.nodeLabels.forEach(label => {
            label.lookAt(this.camera.position);
        });
    }

    /**
     * Handles window resize events by updating camera and renderer dimensions.
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
