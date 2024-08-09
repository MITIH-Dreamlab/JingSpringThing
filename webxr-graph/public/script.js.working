/**
 * script.js
 * 
 * This script creates a 3D visualization of a graph structure using Three.js and WebGL.
 * It includes support for VR (or VR spoofing), real-time updates via WebSocket,
 * GPU-accelerated force-directed graph layout, and debug features like node randomization.
 * 
 * Dependencies:
 * - Three.js (imported via skypack.dev)
 * - OrbitControls for Three.js
 * - VRButton for Three.js
 * - GraphSimulation (custom class for GPU-accelerated physics)
 * 
 * @version 2.2
 * @license MIT
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/webxr/VRButton.js';
import { GraphSimulation } from './GraphSimulation.js';

// Global variables for Three.js components
let renderer, scene, camera, controls;

// Graph data and simulation
let nodes = [], edges = [];
let graphSimulation;

// WebSocket connection for real-time updates
let socket;

// Performance optimization: Use object pooling for nodes and edges
let nodePool = [], edgePool = [];

// Time tracking for animation
let lastTime = 0;

// Constants for graph visualization
const NODE_BASE_SIZE = 5; // Increased for better visibility
const NODE_SIZE_EXPONENT = 0.5;
const MAX_FILE_SIZE = 1000000; // 1MB
const MAX_HYPERLINK_COUNT = 2000;
const MAX_EDGE_WEIGHT = 100;
const INITIAL_POSITION_RANGE = 1000; // Increased for wider spread

// VR Spoofing flag (set to false for real WebXR in production)
const SPOOF_VR = true;

// Debug elements in the DOM
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
    
    // Create a new Three.js scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Set up the camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 200);
    camera.lookAt(0, 0, 0);

    // Set up the WebGL renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Add orbit controls for non-VR navigation
    controls = new OrbitControls(camera, renderer.domElement);

    // Add ambient light to the scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add directional light to the scene
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    // Add a geodesic sphere as a boundary reference
 //   const sphereGeometry = new THREE.IcosahedronGeometry(100, 1);
 //   const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
 //   const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
 //   sphere.position.set(0, 0, 0);
 //   scene.add(sphere);

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);

    console.log('Scene initialized with debug objects');
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
        const speed = 5; // Increased for faster movement
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
 * Randomizes the positions of all nodes
 */
function randomizeNodePositions() {
    if (!graphSimulation) {
        console.error('Graph simulation not initialized');
        return;
    }

    const positionArray = new Float32Array(nodes.length * 4);
    for (let i = 0; i < nodes.length; i++) {
        positionArray[i * 4] = (Math.random() - 0.5) * INITIAL_POSITION_RANGE * 2;
        positionArray[i * 4 + 1] = (Math.random() - 0.5) * INITIAL_POSITION_RANGE * 2;
        positionArray[i * 4 + 2] = (Math.random() - 0.5) * INITIAL_POSITION_RANGE * 2;
        positionArray[i * 4 + 3] = 1; // W component
    }

    // Update the position texture in the GraphSimulation
    graphSimulation.updateNodePositions(positionArray);

    console.log('Node positions randomized');
    updateGraphObjects();
}

/**
 * Sets up keyboard controls
 */
function setupKeyboardControls() {
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            randomizeNodePositions();
        }
    });

    console.log('Keyboard controls set up. Press spacebar to randomize node positions.');
}

/**
 * Loads initial graph data from the server and sets up WebSocket
 */
async function loadData() {
    updateStatus('Loading graph data');
    
    try {
        const response = await fetch('/graph-data');
        const graphData = await response.json();
        console.log('Received graph data:', graphData); // Debug log
        updateGraphData(graphData);
        updateStatus('Graph data loaded');
        
        // Set up WebSocket connection for real-time updates
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onopen = () => {
        console.log('WebSocket connection established');
        updateStatus('WebSocket connected');
    };

    socket.onmessage = (event) => {
        const updatedGraphData = JSON.parse(event.data);
        console.log('Received updated graph data:', updatedGraphData); // Debug log
        updateGraphData(updatedGraphData);
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
    if (!graphData || !graphData.nodes || !graphData.edges) {
        console.error('Invalid graph data received:', graphData);
        return;
    }

    nodes = graphData.nodes;
    edges = graphData.edges;

    console.log(`Updating graph with ${nodes.length} nodes and ${edges.length} edges`);

    nodeCountEl.textContent = `Nodes: ${nodes.length}`;
    edgeCountEl.textContent = `Edges: ${edges.length}`;

    // Initialize or update the GraphSimulation
    if (!graphSimulation) {
        graphSimulation = new GraphSimulation(renderer, nodes, edges);
        
        // Set initial simulation parameters
        graphSimulation.setSimulationParameters({
            repulsionStrength: 60.0,
            attractionStrength: 0.15,
            maxSpeed: 12.0,
            damping: 0.98,
            centeringForce: 0.005,
            edgeDistance: 5.0
        });
    } else {
        graphSimulation.updateNodeData(nodes);
        graphSimulation.updateEdgeData(edges);
    }

    updateGraphObjects();
}
/**
 * Updates 3D objects for nodes and edges
 */
function updateGraphObjects() {
    const WIDTH = graphSimulation.WIDTH;
    const HEIGHT = graphSimulation.HEIGHT;

    const positionArray = new Float32Array(WIDTH * HEIGHT * 4);
    renderer.readRenderTargetPixels(
        graphSimulation.gpuCompute.getCurrentRenderTarget(graphSimulation.positionVariable),
        0, 0, WIDTH, HEIGHT,
        positionArray
    );

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
        
        mesh.position.set(
            positionArray[index * 4],
            positionArray[index * 4 + 1],
            positionArray[index * 4 + 2]
        );

        mesh.scale.setScalar(calculateNodeSize(node.size));
        mesh.material.color.setHex(getNodeColor(node.httpsLinksCount));
        mesh.userData = { nodeId: node.name, name: node.name };
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
            const material = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.3 });
            const geometry = new THREE.BufferGeometry();
            line = new THREE.Line(geometry, material);
            edgePool[index] = line;
            scene.add(line);
        }

        const sourceIndex = nodes.findIndex(n => n.name === edge.source);
        const targetIndex = nodes.findIndex(n => n.name === edge.target);
        
        if (sourceIndex !== -1 && targetIndex !== -1) {
            const sourcePos = new THREE.Vector3(
                positionArray[sourceIndex * 4],
                positionArray[sourceIndex * 4 + 1],
                positionArray[sourceIndex * 4 + 2]
            );
            const targetPos = new THREE.Vector3(
                positionArray[targetIndex * 4],
                positionArray[targetIndex * 4 + 1],
                positionArray[targetIndex * 4 + 2]
            );
            
            line.geometry.setFromPoints([sourcePos, targetPos]);
            line.material.color = getEdgeColor(edge.weight);
            line.visible = true;
        } else {
            line.visible = false;
        }
    });

    // Hide unused edges
    for (let i = edges.length; i < edgePool.length; i++) {
        if (edgePool[i]) edgePool[i].visible = false;
    }
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
    return new THREE.Color(1 - t, t, 0);
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
function animate(time) {
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    if (graphSimulation) {
        graphSimulation.compute(deltaTime);
        updateGraphObjects();
    }

    render();

    requestAnimationFrame(animate);
}

/**
 * Render function
 */
function render() {
    controls.update();
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
    setupKeyboardControls(); // Set up keyboard controls including spacebar for randomization
    await loadData();
    animate(0);
}

// Start the application
init();
