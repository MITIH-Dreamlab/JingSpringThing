/**
 * script.js
 *
 * This script creates a 3D visualization of a graph structure using Three.js and WebGL.
 * It includes support for VR (or VR spoofing), real-time updates via WebSocket,
 * GPU-accelerated force-directed graph layout, and debug features like node randomization.
 *
 * Features:
 * - 3D visualization of nodes (spheres) and edges (lines)
 * - VR support with option for VR spoofing
 * - Real-time graph updates via WebSocket
 * - GPU-accelerated force-directed graph layout
 * - Dynamic node labeling for closer nodes
 * - Responsive design (handles window resizing)
 * - Debug overlay with node and edge counts and simulation type (CPU/GPU)
 *
 * Dependencies:
 * - Three.js (imported via CDN)
 * - GraphSimulation (custom class for GPU-accelerated physics)
 *
 * @version 3.2
 * @license MIT
 */

// Import necessary Three.js modules
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

// Import the custom GraphSimulation class
import { GraphSimulation } from './GraphSimulation.js';

// Global variables for Three.js components
let renderer, scene, camera, controls;

// Graph data and simulation
let nodes = [], edges = [];
let graphSimulation;

// WebSocket connection for real-time updates
let socket;

// Performance optimization: Use object pooling for nodes and edges
const nodePool = [], edgePool = [];

// Time tracking for animation
let lastTime = 0;

// Font for node labels
let font;

// Constants for graph visualization
const NODE_BASE_SIZE = 5; // Base size for nodes
const NODE_SIZE_EXPONENT = 0.5; // Exponent for node size scaling
const MAX_FILE_SIZE = 1000000; // Maximum file size (1MB) for node size calculation
const MAX_HYPERLINK_COUNT = 2000; // Maximum hyperlink count for node color calculation
const MAX_EDGE_WEIGHT = 100; // Maximum edge weight for edge color calculation
const INITIAL_POSITION_RANGE = 1000; // Range for initial random node positions
const TEXT_VISIBILITY_THRESHOLD = 100; // Distance threshold for showing node labels

// VR Spoofing flag (set to false for real WebXR in production)
const SPOOF_VR = true;

// Debug elements in the DOM
const statusEl = document.getElementById('status');
const nodeCountEl = document.getElementById('nodeCount');
const edgeCountEl = document.getElementById('edgeCount');
const simulationTypeEl = document.getElementById('simulationType');

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

    // Check for WebGL support
    if (THREE.WebGL.isWebGLAvailable()) {
        // Create the WebGL renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });

        // Set the renderer's size to the window's width and height
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Enable XR (VR/AR) support
        renderer.xr.enabled = true;

        // Append the renderer's DOM element to the body of the page
        document.body.appendChild(renderer.domElement);

        // Create a new Three.js scene
        scene = new THREE.Scene();

        // Set the scene's background color to black
        scene.background = new THREE.Color(0x000000);

        // Create a perspective camera
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        // Set the camera's initial position
        camera.position.set(0, 0, 200);

        // Make the camera look at the origin
        camera.lookAt(0, 0, 0);

        // Add orbit controls for camera manipulation
        controls = new OrbitControls(camera, renderer.domElement);

        // Add ambient light to the scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // Add directional light to the scene
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 0);
        scene.add(directionalLight);

        // Add an event listener to handle window resizing
        window.addEventListener('resize', onWindowResize, false);

        console.log('Scene initialized');
    } else {
        // Display a warning message if WebGL is not available
        const warning = THREE.WebGL.getWebGLErrorMessage();
        document.body.appendChild(warning);
        updateStatus('WebGL 2 not supported');
        throw new Error('WebGL 2 not supported');
    }
}

/**
 * Sets up WebXR or spoofed VR
 */
async function setupXR() {
    updateStatus('Setting up XR');

    // Check if VR is supported or if VR spoofing is enabled
    if (SPOOF_VR || (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'))) {
        // Create a VR button and append it to the page
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
    // Add an event listener for key presses
    document.addEventListener('keydown', (event) => {
        // Define the movement speed
        const speed = 5;

        // Handle different key presses for camera movement
        switch (event.key) {
            case 'w':
                camera.position.z -= speed;
                break;
            case 's':
                camera.position.z += speed;
                break;
            case 'a':
                camera.position.x -= speed;
                break;
            case 'd':
                camera.position.x += speed;
                break;
            case 'q':
                camera.position.y += speed;
                break;
            case 'e':
                camera.position.y -= speed;
                break;
        }

        // Log the camera's position to the console
        console.log(`Camera Position: ${camera.position.x}, ${camera.position.y}, ${camera.position.z}`);
    });
}

/**
 * Randomizes the positions of all nodes
 */
function randomizeNodePositions() {
    // Check if the graph simulation is initialized
    if (!graphSimulation) {
        console.error('Graph simulation not initialized');
        return;
    }

    // Create an array to store the new random positions
    const positionArray = new Float32Array(nodes.length * 4);

    // Generate random positions for each node within a specified range
    for (let i = 0; i < nodes.length; i++) {
        positionArray[i * 4] = (Math.random() - 0.5) * INITIAL_POSITION_RANGE * 2;
        positionArray[i * 4 + 1] = (Math.random() - 0.5) * INITIAL_POSITION_RANGE * 2;
        positionArray[i * 4 + 2] = (Math.random() - 0.5) * INITIAL_POSITION_RANGE * 2;
        positionArray[i * 4 + 3] = 1; // W component (homogeneous coordinates)
    }

    // Update the node positions in the graph simulation
    graphSimulation.updateNodePositions(positionArray);

    console.log('Node positions randomized');

    // Update the visual representation of the graph
    updateGraphObjects();
}

/**
 * Sets up keyboard controls
 */
function setupKeyboardControls() {
    // Add an event listener for key presses
    document.addEventListener('keydown', (event) => {
        // If the spacebar is pressed, randomize node positions
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
        // Fetch graph data from the server
        const response = await fetch('/graph-data');
        const graphData = await response.json();
        console.log('Received graph data:', graphData); // Debug log

        // Update the graph with the loaded data
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
    // Determine the appropriate WebSocket protocol (ws or wss) based on the current page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Create a new WebSocket connection to the server
    socket = new WebSocket(`${protocol}//${window.location.host}`);

    // Event handler for when the WebSocket connection is opened
    socket.onopen = () => {
        console.log('WebSocket connection established');
        updateStatus('WebSocket connected');
    };

    // Event handler for when a message is received from the server
    socket.onmessage = (event) => {
        // Parse the received message as JSON
        const updatedGraphData = JSON.parse(event.data);
        console.log('Received updated graph data:', updatedGraphData); // Debug log

        // Update the graph with the new data
        updateGraphData(updatedGraphData);
        updateStatus('Graph data updated');
    };

    // Event handler for WebSocket errors
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateStatus('WebSocket error');
    };

    // Event handler for when the WebSocket connection is closed
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
    // Check if the graph data is valid
    if (!graphData || !graphData.nodes || !graphData.edges) {
        console.error('Invalid graph data received:', graphData);
        return;
    }

    // Update the nodes and edges arrays with the new data
    nodes = graphData.nodes;
    edges = graphData.edges;

    console.log(`Updating graph with ${nodes.length} nodes and ${edges.length} edges`);

    // Update debug information in the DOM
    nodeCountEl.textContent = `Nodes: ${nodes.length}`;
    edgeCountEl.textContent = `Edges: ${edges.length}`;

    // Initialize or update the GraphSimulation
    if (!graphSimulation) {
        try {
            // Check if the renderer is initialized
            if (!renderer) {
                throw new Error('Renderer not initialized');
            }

            // Create a new GraphSimulation instance
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

            // Update simulation type display
            simulationTypeEl.textContent = `Simulation: ${graphSimulation.useCPUSimulation ? 'CPU' : 'GPU'}`;

        } catch (error) {
            console.error('Error initializing GraphSimulation:', error);
            updateStatus('Error initializing simulation');
            return; // Exit the function if we can't initialize the simulation
        }
    } else {
        try {
            // Update the node and edge data in the existing GraphSimulation instance
            graphSimulation.updateNodeData(nodes);
            graphSimulation.updateEdgeData(edges);

            // Update simulation type display
            simulationTypeEl.textContent = `Simulation: ${graphSimulation.useCPUSimulation ? 'CPU' : 'GPU'}`;

        } catch (error) {
            console.error('Error updating GraphSimulation:', error);
            updateStatus('Error updating simulation');
            return; // Exit the function if we can't update the simulation
        }
    }

    // Update the visual representation of the graph
    try {
        updateGraphObjects();
    } catch (error) {
        console.error('Error updating graph objects:', error);
        updateStatus('Error updating graph visualization');
    }

    // If we've made it this far without errors, update the status
    updateStatus('Graph data updated successfully');
}

/**
 * Updates 3D objects for nodes and edges
 */
function updateGraphObjects() {
    // Check if the graph simulation is initialized
    if (!graphSimulation) {
        console.error('GraphSimulation not initialized');
        return;
    }

    // Get node positions based on simulation type
    let positionArray;
    if (graphSimulation.useCPUSimulation) {
        // For CPU simulation, get positions directly from nodes
        positionArray = new Float32Array(nodes.length * 4);
        nodes.forEach((node, index) => {
            positionArray[index * 4] = node.x;
            positionArray[index * 4 + 1] = node.y;
            positionArray[index * 4 + 2] = node.z;
            positionArray[index * 4 + 3] = 1;
        });
    } else if (graphSimulation.gpuCompute) {
        // For GPU simulation, read positions from the GPU computation result
        const WIDTH = graphSimulation.WIDTH;
        const HEIGHT = graphSimulation.HEIGHT;
        positionArray = new Float32Array(WIDTH * HEIGHT * 4);
        renderer.readRenderTargetPixels(
            graphSimulation.gpuCompute.getCurrentRenderTarget(graphSimulation.positionVariable),
            0, 0, WIDTH, HEIGHT,
            positionArray
        );
    } else {
        console.error('Neither CPU nor GPU simulation is available');
        return;
    }

    // Update or create nodes
    nodes.forEach((node, index) => {
        let mesh = nodePool[index];

        // Create a new node mesh if it doesn't exist
        if (!mesh) {
            // Create a new icosahedron geometry for the node
            const geometry = new THREE.IcosahedronGeometry(NODE_BASE_SIZE, 1);

            // Create a new Phong material for the node
            const material = new THREE.MeshPhongMaterial();

            // Create a new mesh using the geometry and material
            mesh = new THREE.Mesh(geometry, material);

            // Add the mesh to the node pool
            nodePool[index] = mesh;

            // Add the mesh to the scene
            scene.add(mesh);

            // Create a text label for the node (hidden by default)
            if (font) {
                try {
                    // Create a new text geometry using the loaded font
                    const textGeometry = new TextGeometry(node.name, {
                        font: font,
                        size: NODE_BASE_SIZE * 0.5,
                        height: 0.1,
                    });

                    // Create a new basic material for the text
                    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

                    // Create a new mesh for the text
                    const textMesh = new THREE.Mesh(textGeometry, textMaterial);

                    // Position the text above the node
                    textMesh.position.y = NODE_BASE_SIZE * 1.5;

                    // Hide the text by default
                    textMesh.visible = false;

                    // Add the text mesh as a child of the node mesh
                    mesh.add(textMesh);
                } catch (error) {
                    console.warn('Error creating text for node:', node.name, error);
                }
            } else {
                console.warn('Font not loaded, skipping text label for node:', node.name);
            }
        }

        // Update node position
        mesh.position.set(
            positionArray[index * 4],
            positionArray[index * 4 + 1],
            positionArray[index * 4 + 2]
        );

        // Update node size, color, and user data
        mesh.scale.setScalar(calculateNodeSize(node.size));
        mesh.material.color.setHex(getNodeColor(node.httpsLinksCount));
        mesh.userData = { nodeId: node.name, name: node.name };

        // Make the node visible
        mesh.visible = true;

        // Update text visibility based on distance to camera
        if (mesh.children[0]) {
            const distanceToCamera = camera.position.distanceTo(mesh.position);
            mesh.children[0].visible = distanceToCamera < TEXT_VISIBILITY_THRESHOLD;
        }
    });

    // Hide unused nodes
    for (let i = nodes.length; i < nodePool.length; i++) {
        if (nodePool[i]) nodePool[i].visible = false;
    }

    // Update or create edges
    edges.forEach((edge, index) => {
        let line = edgePool[index];

        // Create a new edge line if it doesn't exist
        if (!line) {
            // Create a new line basic material
            const material = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.3 });

            // Create a new buffer geometry
            const geometry = new THREE.BufferGeometry();

            // Create a new line using the geometry and material
            line = new THREE.Line(geometry, material);

            // Add the line to the edge pool
            edgePool[index] = line;

            // Add the line to the scene
            scene.add(line);
        }

        // Get the indices of the source and target nodes
        const sourceIndex = nodes.findIndex(n => n.name === edge.source);
        const targetIndex = nodes.findIndex(n => n.name === edge.target);

        // Update edge position and color if source and target nodes are found
        if (sourceIndex !== -1 && targetIndex !== -1) {
            // Create vectors for the source and target positions
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

            // Update the line geometry
            line.geometry.setFromPoints([sourcePos, targetPos]);

            // Update the line color
            line.material.color = getEdgeColor(edge.weight);

            // Make the line visible
            line.visible = true;
        } else {
            // Hide the line if source or target nodes are not found
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
 * @returns {THREE.Color} Color object for the edge
 */
function getEdgeColor(weight) {
    const t = Math.min(weight / MAX_EDGE_WEIGHT, 1);
    return new THREE.Color(1 - t, t, 0);
}

/**
 * Handles window resize events
 */
function onWindowResize() {
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;

    // Update camera projection matrix
    camera.updateProjectionMatrix();

    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Animation loop
 */
function animate(time) {
    // Calculate delta time
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    // Perform graph simulation if initialized
    if (graphSimulation) {
        try {
            // Compute the next step of the simulation
            graphSimulation.compute(deltaTime);

            // Update the visual representation of the graph
            updateGraphObjects();

            // Update text visibility for each node
            nodePool.forEach(nodeMesh => {
                const textMesh = nodeMesh.children[0];
                if (textMesh) {
                    const distanceToCamera = camera.position.distanceTo(nodeMesh.position);
                    textMesh.visible = distanceToCamera < TEXT_VISIBILITY_THRESHOLD;
                }
            });
        } catch (error) {
            console.error('Error in graph simulation:', error);
            updateStatus('Error in simulation');
        }
    }

    // Render the scene
    render();

    // Request the next frame of the animation
    requestAnimationFrame(animate);
}

/**
 * Render function
 */
function render() {
    // Update orbit controls
    controls.update();

    // Update text rotations to face camera (only for visible text)
    nodePool.forEach(nodeMesh => {
        const textMesh = nodeMesh.children[0];
        if (textMesh && textMesh.visible) {
            textMesh.lookAt(camera.position);
        }
    });

    // Render the scene using the renderer and camera
    renderer.render(scene, camera);
}

/**
 * Initializes the application
 */
async function init() {
    updateStatus('Initializing application');

    // Initialize the scene, camera, and renderer
    initScene();

    // Set up WebXR or spoofed VR
    await setupXR();

    // Set up spoofed VR controls if enabled
    if (SPOOF_VR) {
        setupSpoofedVRControls();
    }

    // Set up keyboard controls
    setupKeyboardControls();

    // Load initial graph data
    await loadData();

    // Start the animation loop
    animate(0);
}

// Load the font before starting the application
const loader = new FontLoader();
loader.load(
    'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
    function (loadedFont) {
        font = loadedFont;
        console.log('Font loaded successfully');
    },
    function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    function (err) {
        console.error('An error happened while loading the font:', err);
    }
);

// Initialize the application
init();