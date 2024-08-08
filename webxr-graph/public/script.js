import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/webxr/VRButton.js';
import * as d3 from 'https://cdn.skypack.dev/d3-force@3';

// Global variables
let renderer, scene, camera, controls;
let nodes = [], edges = [];
let simulation; // d3-force simulation

// Constants for graph visualization
const NODE_BASE_SIZE = 0.2;
const NODE_SIZE_EXPONENT = 0.5;
const MAX_FILE_SIZE = 1000000; // 1MB
const MAX_HYPERLINK_COUNT = 20;
const MAX_EDGE_WEIGHT = 10;
const INITIAL_POSITION_RANGE = 20; // Reduced range for initial visibility
const ENERGY_THRESHOLD = 0.01; // Threshold for near ground state energy

// VR Spoofing flag
const SPOOF_VR = true; // Set to false for real WebXR in production

// Debug elements
const statusEl = document.getElementById('status');
const nodeCountEl = document.getElementById('nodeCount');
const edgeCountEl = document.getElementById('edgeCount');

// WebSocket connection
let websocket;

// Function to update status
function updateStatus(message) {
    statusEl.textContent = `Status: ${message}`;
    console.log(`Status: ${message}`);
}

/**
 * Initializes the 3D scene, camera, and renderer
 */
function initScene() {
    updateStatus('Initializing Scene');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('graphCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

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

    window.addEventListener('resize', onWindowResize, false);
}

/**
 * Sets up WebXR or spoofed VR
 */
async function setupXR() {
    updateStatus('Setting up XR');

    if (SPOOF_VR || (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'))) {
        const button = document.createElement('button');
        button.textContent = 'Enter VR';
        button.onclick = enterVR;
        document.body.appendChild(button);
        updateStatus('Enter VR button added');
    } else {
        updateStatus('VR not supported');
    }
}

/**
 * Enters VR mode (real or spoofed)
 */
function enterVR() {
    if (SPOOF_VR) {
        startSpoofedVRSession();
    } else {
        navigator.xr.requestSession('immersive-vr').then(onVRSessionStarted);
    }
}

/**
 * Starts a spoofed VR session
 */
function startSpoofedVRSession() {
    updateStatus('Starting spoofed VR session');
    setupSpoofedVRControls();
    animate();
}

/**
 * Sets up controls for spoofed VR
 */
function setupSpoofedVRControls() {
    document.addEventListener('keydown', (event) => {
        const speed = 1; // Adjust speed as necessary for smoother exploration
        switch(event.key) {
            case 'w': camera.position.z -= speed; break;
            case 's': camera.position.z += speed; break;
            case 'a': camera.position.x -= speed; break;
            case 'd': camera.position.x += speed; break;
            case 'q': camera.position.y += speed; break;
            case 'e': camera.position.y -= speed; break;
            // Randomize node positions on spacebar press
            case ' ': randomizeNodePositions(); break;
        }
        console.log(`Camera Position: ${camera.position.x}, ${camera.position.y}, ${camera.position.z}`);
    });
}

/**
 * Handles the start of a real VR session
 */
function onVRSessionStarted(session) {
    renderer.xr.setSession(session);
    updateStatus('VR session started');
}

/**
 * Loads graph data from the server and initializes the force-directed graph
 */
async function loadData() {
    updateStatus('Loading graph data');

    try {
        const response = await fetch('/graph-data');
        const graphData = await response.json();
        nodes = graphData.nodes;
        edges = graphData.edges;

        nodeCountEl.textContent = `Nodes: ${nodes.length}`;
        edgeCountEl.textContent = `Edges: ${edges.length}`;

        console.log('Graph data loaded', graphData);
        updateStatus('Graph data loaded');

        // Initialize the force-directed graph
        initForceDirectedGraph();
    } catch (error) {
        console.error('Error loading graph data:', error);
        updateStatus('Error loading graph data');
    }
}

/**
 * Initializes the force-directed graph using d3-force
 */
function initForceDirectedGraph() {
    simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(edges).id(d => d.name).distance(d => 10 + d.weight * 2)) // Adjust distance based on edge weight
        .force("charge", d3.forceManyBody().strength(-50)) // Repulsion force
        .force("center", d3.forceCenter(0, 0, 0)) // Centering force
        .on("tick", updateNodePositions); // Update positions on each tick

    // Randomize initial positions
    randomizeNodePositions();
}

/**
 * Randomizes the positions of the nodes
 */
function randomizeNodePositions() {
    nodes.forEach(node => {
        const x = Math.random() * INITIAL_POSITION_RANGE - (INITIAL_POSITION_RANGE / 2);
        const y = Math.random() * INITIAL_POSITION_RANGE - (INITIAL_POSITION_RANGE / 2);
        const z = Math.random() * INITIAL_POSITION_RANGE - (INITIAL_POSITION_RANGE / 2);
        node.x = x;
        node.y = y;
        node.z = z;
    });
    updateNodePositions(); // Update the Three.js objects immediately
}

/**
 * Updates the positions of the Three.js objects based on the simulation
 */
function updateNodePositions() {
    nodes.forEach(node => {
        const threeNode = scene.children.find(child => child.userData.nodeId === node.name);
        if (threeNode) {
            threeNode.position.set(node.x, node.y, node.z);
        }
    });

    // Check for near ground state energy
    if (simulation.alpha() < ENERGY_THRESHOLD) {
        simulation.stop(); // Stop the simulation if near ground state
        updateStatus('Graph settled');
    }
}

/**
 * Creates 3D objects for nodes and edges
 */
function createGraphObjects() {
    updateStatus('Creating graph objects');

    // Create nodes
    nodes.forEach(node => {
        const geometry = new THREE.SphereGeometry(calculateNodeSize(node.size), 32, 32);
        const material = new THREE.MeshPhongMaterial({ color: getNodeColor(node.httpsLinksCount) });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { nodeId: node.name }; // Use name as ID
        scene.add(mesh);
    });

    // Create edges
    edges.forEach(edge => {
        const sourceNode = scene.children.find(child => child.userData.nodeId === edge.source);
        const targetNode = scene.children.find(child => child.userData.nodeId === edge.target);

        if (sourceNode && targetNode) {
            const material = new THREE.LineBasicMaterial({ color: getEdgeColor(edge.weight) });
            const points = [sourceNode.position, targetNode.position];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            scene.add(line);
        }
    });

    updateStatus('Graph objects created');
}

/**
 * Calculates the size of a node based on its file size
 */
function calculateNodeSize(fileSize) {
    const normalizedSize = fileSize / MAX_FILE_SIZE;
    return NODE_BASE_SIZE * Math.pow(normalizedSize, NODE_SIZE_EXPONENT);
}

/**
 * Determines the color of a node based on its hyperlink count
 */
function getNodeColor(hyperlinkCount) {
    const t = Math.min(hyperlinkCount / MAX_HYPERLINK_COUNT, 1);
    return new THREE.Color(t, 0, 1 - t);
}

/**
 * Determines the color of an edge based on its weight
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
function render(time, frame) {
    if (SPOOF_VR) {
        renderer.render(scene, camera);
    } else if (renderer.xr.isPresenting) {
        renderer.render(scene, camera);
    } else {
        controls.update();
        renderer.render(scene, camera);
    }
}

/**
 * Initializes the WebSocket connection
 */
function initWebSocket() {
    websocket = new WebSocket(`wss://${window.location.host}`); // Use wss for HTTPS

    websocket.onopen = () => {
        console.log('WebSocket connection established');
    };

    websocket.onmessage = (event) => {
        try {
            const updatedData = JSON.parse(event.data);
            console.log('Received updated graph data:', updatedData);

            // Update the graph with the new data (replace this with your update logic)
            // ...
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
        console.log('WebSocket connection closed');
    };
}

/**
 * Initializes the application
 */
async function init() {
    updateStatus('Initializing application');
    initScene();
    await setupXR();
    await loadData();
    createGraphObjects();
    initWebSocket(); // Initialize WebSocket connection
    animate();
}

// Start the application
init();
