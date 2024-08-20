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

// Graph data and simulation instance
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
const NODE_BASE_SIZE = 5;
const NODE_SIZE_EXPONENT = 0.5;
const MAX_FILE_SIZE = 1000000;
const MAX_HYPERLINK_COUNT = 2000;
const MAX_EDGE_WEIGHT = 100;
const INITIAL_POSITION_RANGE = 1000;
const TEXT_VISIBILITY_THRESHOLD = 100;

// VR Spoofing flag (set to false for real WebXR in production)
const SPOOF_VR = true;

// Chat window elements
const chatWindow = document.getElementById('chatWindow');
const questionInput = document.getElementById('questionInput');
const askButton = document.getElementById('askButton');
const smartPane = document.getElementById('smartPane');
const resizeHandle = document.getElementById('resizeHandle');

// Chat-related variables
let currentConversationId = null;

/**
 * Updates the status message and adds it to the chat window
 * @param {string} message - The status message to display
 */
function updateStatus(message) {
    addMessageToChat('System', `Status: ${message}`);
    console.log(`Status: ${message}`);
}

/**
 * Adds a message to the chat window
 * @param {string} sender - The sender of the message
 * @param {string} message - The message content
 */
function addMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.innerHTML = `<strong>${sender}:</strong> ${marked.parse(message)}`;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}
/**
 * Initializes the 3D scene, camera, and renderer
 */
function initScene() {
    updateStatus('Initializing Scene');

    try {
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
    } catch (error) {
        console.error('Error initializing scene:', error);
        updateStatus('WebGL not supported or error initializing scene');
        throw new Error('WebGL not supported or error initializing scene');
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
        // If Control+R is pressed, randomize node positions
        if (event.ctrlKey && event.code === 'KeyR') {
            event.preventDefault(); // Prevent the default browser refresh action
            randomizeNodePositions();
        }
    });

    console.log('Keyboard controls set up. Press Control+R to randomize node positions.');
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
        console.log('Received graph data:', graphData);

        // Validate node positions
        graphData.nodes.forEach(node => {
            if (typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') {
                console.warn(`Invalid position for node ${node.name}: (${node.x}, ${node.y}, ${node.z})`);
                node.x = Math.random() * 100 - 50;
                node.y = Math.random() * 100 - 50;
                node.z = Math.random() * 100 - 50;
            }
        });

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
 * Updates the graph data and re-creates graph objects
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

    // Update debug information in the chat
    addMessageToChat('System', `Nodes: ${nodes.length}, Edges: ${edges.length}`);

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

            // Update simulation type in chat
            addMessageToChat('System', `Simulation: ${graphSimulation.simulationType}`);
            updateStatus(`Graph simulation initialized (${graphSimulation.simulationType})`);

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

            // Update simulation type in chat (in case it has changed)
            addMessageToChat('System', `Simulation: ${graphSimulation.simulationType}`);
            updateStatus(`Graph data updated (${graphSimulation.simulationType} simulation)`);

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
        const x = positionArray[index * 4];
        const y = positionArray[index * 4 + 1];
        const z = positionArray[index * 4 + 2];

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            console.warn(`NaN position detected for node ${node.name}: (${x}, ${y}, ${z})`);
            return;
        }

        mesh.position.set(x, y, z);

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
            // Check if simulation type has changed
            const currentSimType = graphSimulation.simulationType;
            if (currentSimType !== graphSimulation.lastReportedSimType) {
                addMessageToChat('System', `Simulation: ${currentSimType}`);
                updateStatus(`Simulation type changed to ${currentSimType}`);
                graphSimulation.lastReportedSimType = currentSimType;
            }

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
 * Initializes a new chat
 */
async function initializeChat() {
    try {
        const response = await fetch('/api/chat/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: 'webxr-user' }),
        });
        const data = await response.json();
        if (data.success) {
            currentConversationId = data.conversationId;
            addMessageToChat('System', 'Chat initialized');
        } else {
            throw new Error(data.error || 'Failed to initialize chat');
        }
    } catch (error) {
        console.error("Error initializing chat:", error);
        addMessageToChat('System', "There was an error initializing the chat. Please try again.");
    }
}


/**
 * Loads chat history
 */
async function loadChatHistory() {
    if (!currentConversationId) return;

    try {
        const response = await fetch(`/api/chat/history/${currentConversationId}`);
        const data = await response.json();

        if (data.retcode === 0) {
            chatWindow.innerHTML = ''; // Clear existing messages
            data.data.message.forEach(msg => {
                addMessageToChat(msg.role === 'user' ? 'User' : 'AI', msg.content);
            });
        } else {
            throw new Error('Failed to load chat history');
        }
    } catch (error) {
        console.error("Error loading chat history:", error);
        addMessageToChat('System', "There was an error loading the chat history.");
    }
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

    // Check initial node positions
    nodes.forEach((node, index) => {
        if (isNaN(node.x) || isNaN(node.y) || isNaN(node.z)) {
            console.warn(`Invalid initial position for node ${node.name}: (${node.x}, ${node.y}, ${node.z})`);
            // Set to a default position
            node.x = 0;
            node.y = 0;
            node.z = 0;
        }
    });

    // Initialize chat
    await initializeChat();

    // Load chat history
    await loadChatHistory();

    // Start the animation loop
    animate(0);
}


// Load the font before starting the application
const loader = new FontLoader();
loader.load(
    'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', // Ensure this path is correct, or adjust as per your setup
    function (loadedFont) {
        font = loadedFont;
        console.log('Font loaded successfully');
        init(); // Initialize the application after the font is loaded
    },
    function (xhr) {
        // Ensure xhr.total is greater than 0 to avoid irregular percentage values
        if (xhr.total > 0) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        } else {
            console.warn('Could not determine loading percentage');
        }
    },
    function (err) {
        console.error('An error happened while loading the font:', err);
    }
);

// Event listener for the "Ask" button
askButton.addEventListener('click', async () => {
    const question = questionInput.value;

    if (!question) {
        addMessageToChat('System', "Please enter a question!");
        return;
    }

    addMessageToChat('User', question);
    questionInput.value = ''; // Clear input after sending

    try {
        if (!currentConversationId) {
            await initializeChat();
        }

        const response = await fetch('/api/chat/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                conversationId: currentConversationId,
                message: question 
            }),
        });
        const data = await response.json();

        if (data.retcode === 0) {
            addMessageToChat('AI', data.data.answer);
        } else {
            throw new Error('Failed to get answer');
        }
    } catch (error) {
        console.error("Error asking question:", error);
        addMessageToChat('System', "There was an error processing your question. Please try again.");
    }
});


// Set up resizable pane functionality
let isDragging = false;

resizeHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newHeight = e.clientY;
    smartPane.style.height = `${newHeight}px`;
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

// Add event listener for 'Enter' key in the question input
questionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // Prevent default 'Enter' behavior
        askButton.click(); // Trigger the ask button click event
    }
});

// Function to toggle fullscreen mode
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}


// Add event listener for fullscreen toggle (e.g., F11 key)
document.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
        e.preventDefault(); // Prevent default F11 behavior
        toggleFullScreen();
    }
});

// Function to save chat history
function saveChatHistory() {
    const chatHistory = chatWindow.innerHTML;
    const blob = new Blob([chatHistory], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chat_history.html';
    a.click();
}

// Add event listener for saving chat history (e.g., Ctrl+S)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault(); // Prevent default save behavior
        saveChatHistory();
    }
});

// Function to clear chat history
function clearChatHistory() {
    if (confirm('Are you sure you want to clear the chat history?')) {
        chatWindow.innerHTML = '';
        addMessageToChat('System', 'Chat history cleared.');
    }
}

// Add event listener for clearing chat history (e.g., Ctrl+L)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault(); // Prevent default behavior
        clearChatHistory();
    }
});

// Add these instructions to the initial messages
addMessageToChat('System', 'Press F11 to toggle fullscreen mode.');
addMessageToChat('System', 'Press Ctrl+S to save chat history.');
addMessageToChat('System', 'Press Ctrl+L to clear chat history.');
