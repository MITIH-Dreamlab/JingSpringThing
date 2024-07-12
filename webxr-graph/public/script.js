/**
 * script.js
 * 
 * This script creates a 3D visualization of a graph structure using Three.js.
 * It includes support for VR (or VR spoofing) and real-time updates via WebSocket.
 * 
 * Dependencies:
 * - Three.js (imported via skypack.dev)
 * - OrbitControls for Three.js
 * - VRButton for Three.js
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/webxr/VRButton.js';

// Global variables
let renderer, scene, camera, controls;
let nodes = [], edges = [];
let socket;

// Performance optimization: Use object pooling for nodes and edges
let nodePool = [], edgePool = [];

// Constants for graph visualization
const NODE_BASE_SIZE = 0.2;
const NODE_SIZE_EXPONENT = 0.5;
const MAX_FILE_SIZE = 1000000; // 1MB
const MAX_HYPERLINK_COUNT = 20;
const MAX_EDGE_WEIGHT = 10;
const INITIAL_POSITION_RANGE = 20;

// VR Spoofing flag
const SPOOF_VR = true; // Set this to false for real WebXR in production

// Debug elements
const statusEl = document.getElementById('status');
const nodeCountEl = document.getElementById('nodeCount');
const edgeCountEl = document.getElementById('edgeCount');

/**
 * Updates the status message on the page and in the console
 * @param {string} message - The status message to display
 */
function updateStatus(message) {
    statusEl.textContent = `Status: ${message}`;
    console.log(`Status: ${message}`);
}

/**
 * Initializes the 3D scene, camera, and renderer
 */
function initScene() {
    updateStatus('Initializing Scene');
    
    // Create a new scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Set up the camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    // Set up the renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('graphCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    // Add orbit controls for non-VR navigation
    controls = new OrbitControls(camera, renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    // Add a red cube as a reference point
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 0, -5);
    scene.add(cube);

    // Add a geodesic sphere as a boundary reference
    const sphereGeometry = new THREE.IcosahedronGeometry(100, 1);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(0, 0, 0);
    scene.add(sphere);

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);
}

/**
 * Sets up WebXR or spoofed VR
 */
async function setupXR() {
    updateStatus('Setting up XR');
    
    if (SPOOF_VR || (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'))) {
        const button = VRButton.createButton(renderer);
        document.body.appendChild(button);
        updateStatus('VR button added');
    } else {
        updateStatus('VR not supported');
    }
}

/**
 * Sets up controls for spoofed VR
 */
function setupSpoofedVRControls() {
    document.addEventListener('keydown', (event) => {
        const speed = 1;
        switch(event.key) {
            case 'w': camera.position.z -= speed; break;
            case 's': camera.position.z += speed; break;
            case 'a': camera.position.x -= speed; break;
            case 'd': camera.position.x += speed; break;
            case 'q': camera.position.y += speed; break;
            case 'e': camera.position.y -= speed; break;
        }
        console.log(`Camera Position: ${camera.position.x}, ${camera.position.y}, ${camera.position.z}`);
    });
}

/**
 * Loads graph data from the server and sets up WebSocket
 */
async function loadData() {
    updateStatus('Loading graph data');
    
    try {
        const response = await fetch('/graph-data');
        const graphData = await response.json();
        updateGraphData(graphData);
        console.log('Initial graph data loaded', graphData);
        updateStatus('Graph data loaded');
        
        // Set up WebSocket connection
        setupWebSocket();
    } catch (error) {
        console.error('Error loading graph data:', error);
        updateStatus('Error loading graph data');
    }
}

/**
 * Sets up WebSocket connection for real-time updates
 */
function setupWebSocket() {
    // Use wss:// for secure WebSocket connections
    socket = new WebSocket(`wss://${window.location.host}`);

    socket.onopen = () => {
        console.log('WebSocket connection established');
        updateStatus('WebSocket connected');
    };

    socket.onmessage = (event) => {
        const updatedGraphData = JSON.parse(event.data);
        updateGraphData(updatedGraphData);
        console.log('Received updated graph data', updatedGraphData);
        updateStatus('Graph data updated');
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateStatus('WebSocket error');
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed');
        updateStatus('WebSocket disconnected');
    };
}

/**
 * Updates the graph data and recreates graph objects
 * @param {Object} graphData - The new graph data
 */
function updateGraphData(graphData) {
    // Check if the received data has the expected structure
    if (!graphData.nodes || !graphData.edges) {
        console.error('Received invalid graph data structure', graphData);
        return;
    }

    nodes = graphData.nodes;
    edges = graphData.edges;

    nodeCountEl.textContent = `Nodes: ${nodes.length}`;
    edgeCountEl.textContent = `Edges: ${edges.length}`;

    // Performance optimization: Reuse existing objects instead of recreating them
    updateGraphObjects();
}

/**
 * Updates 3D objects for nodes and edges, reusing existing objects when possible
 */
function updateGraphObjects() {
    updateStatus('Updating graph objects');
    
    // Update or create nodes
    nodes.forEach((node, index) => {
        let mesh = nodePool[index];
        if (!mesh) {
            const geometry = new THREE.SphereGeometry(NODE_BASE_SIZE, 32, 32);
            const material = new THREE.MeshPhongMaterial();
            mesh = new THREE.Mesh(geometry, material);
            nodePool[index] = mesh;
            scene.add(mesh);
        }
        
        mesh.scale.setScalar(calculateNodeSize(node.size) / NODE_BASE_SIZE);
        mesh.material.color.setHex(getNodeColor(node.httpsLinksCount));
        
        const x = Math.random() * INITIAL_POSITION_RANGE - (INITIAL_POSITION_RANGE / 2);
        const y = Math.random() * INITIAL_POSITION_RANGE - (INITIAL_POSITION_RANGE / 2);
        const z = Math.random() * INITIAL_POSITION_RANGE - (INITIAL_POSITION_RANGE / 2);
        mesh.position.set(x, y, z);
        
        mesh.userData = { nodeId: node.name, name: node.name, isGraphObject: true };
        mesh.visible = true;
    });

    // Hide unused nodes
    for (let i = nodes.length; i < nodePool.length; i++) {
        if (nodePool[i]) nodePool[i].visible = false;
    }

    // Update or create edges
    edges.forEach((edge, index) => {
        let line = edgePool[index];
        if (!line) {
            const material = new THREE.LineBasicMaterial();
            const geometry = new THREE.BufferGeometry();
            line = new THREE.Line(geometry, material);
            edgePool[index] = line;
            scene.add(line);
        }

        const sourceNode = nodePool.find(node => node.userData.nodeId === edge.source);
        const targetNode = nodePool.find(node => node.userData.nodeId === edge.target);
        
        if (sourceNode && targetNode) {
            const points = [sourceNode.position, targetNode.position];
            line.geometry.setFromPoints(points);
            line.material.color.setHex(getEdgeColor(edge.weight));
            line.userData = { isGraphObject: true };
            line.visible = true;
        } else {
            console.warn(`Edge warning: sourceNode or targetNode not found for edge between ${edge.source} and ${edge.target}`);
            line.visible = false;
        }
    });

    // Hide unused edges
    for (let i = edges.length; i < edgePool.length; i++) {
        if (edgePool[i]) edgePool[i].visible = false;
    }

    console.log('Graph objects updated');
    updateStatus('Graph objects updated');
}

/**
 * Calculates the size of a node based on its file size
 * @param {number} fileSize - Size of the file in bytes
 * @returns {number} Size of the node
 */
function calculateNodeSize(fileSize) {
    const normalizedSize = Math.min(fileSize / MAX_FILE_SIZE, 1);
    return NODE_BASE_SIZE * Math.pow(normalizedSize, NODE_SIZE_EXPONENT);
}

/**
 * Determines the color of a node based on its hyperlink count
 * @param {number} hyperlinkCount - Number of hyperlinks in the node
 * @returns {number} Hexadecimal color value
 */
function getNodeColor(hyperlinkCount) {
    const t = Math.min(hyperlinkCount / MAX_HYPERLINK_COUNT, 1);
    return new THREE.Color(t, 0, 1 - t).getHex();
}

/**
 * Determines the color of an edge based on its weight
 * @param {number} weight - Weight of the edge
 * @returns {number} Hexadecimal color value
 */
function getEdgeColor(weight) {
    const t = Math.min(weight / MAX_EDGE_WEIGHT, 1);
    return new THREE.Color(1 - t, t, 0).getHex();
}

/**
 * Handles window resize events
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Animation loop
 */
function animate() {
    if (SPOOF_VR) {
        requestAnimationFrame(animate);
        render();
    } else {
        renderer.setAnimationLoop(render);
    }
}

/**
 * Render function
 */
function render() {
    if (SPOOF_VR || !renderer.xr.isPresenting) {
        controls.update();
    }
    renderer.render(scene, camera);
}

/**
 * Initializes the application
 */
async function init() {
    updateStatus('Initializing application');
    initScene();
    await setupXR();
    if (SPOOF_VR) {
        setupSpoofedVRControls();
    }
    await loadData();
    animate();
}

// Start the application
init();
