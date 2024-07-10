import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/webxr/VRButton.js';

// Global variables
let renderer, scene, camera, controls;
let nodes = [], edges = [];

// Constants for graph visualization
const NODE_BASE_SIZE = 0.2;
const NODE_SIZE_EXPONENT = 0.5;
const MAX_FILE_SIZE = 1000000; // 1MB
const MAX_HYPERLINK_COUNT = 20;
const MAX_EDGE_WEIGHT = 10;

// VR Spoofing flag
const SPOOF_VR = true; // Set this to false for real WebXR in production

/**
 * Initializes the 3D scene, camera, and renderer
 */
function initScene() {
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

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);
}

/**
 * Sets up WebXR or spoofed VR
 */
async function setupXR() {
    if (SPOOF_VR || (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'))) {
        const button = document.createElement('button');
        button.textContent = 'Enter VR';
        button.onclick = enterVR;
        document.body.appendChild(button);
    } else {
        console.log('VR not supported');
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
    console.log('Starting spoofed VR session');
    setupSpoofedVRControls();
    animate();
}

/**
 * Sets up controls for spoofed VR
 */
function setupSpoofedVRControls() {
    document.addEventListener('keydown', (event) => {
        const speed = 0.1;
        switch(event.key) {
            case 'w': camera.position.z -= speed; break;
            case 's': camera.position.z += speed; break;
            case 'a': camera.position.x -= speed; break;
            case 'd': camera.position.x += speed; break;
            case 'q': camera.position.y += speed; break;
            case 'e': camera.position.y -= speed; break;
        }
    });
}

/**
 * Handles the start of a real VR session
 */
function onVRSessionStarted(session) {
    renderer.xr.setSession(session);
    // Additional VR session setup if needed
}

/**
 * Loads graph data from the server
 */
async function loadData() {
    try {
        const response = await fetch('/graph-data');
        const graphData = await response.json();
        nodes = graphData.nodes;
        edges = graphData.edges;
    } catch (error) {
        console.error('Error loading graph data:', error);
    }
}

/**
 * Creates 3D objects for nodes and edges
 */
function createGraphObjects() {
    // Create nodes
    nodes.forEach(node => {
        const geometry = new THREE.SphereGeometry(calculateNodeSize(node.size), 32, 32);
        const material = new THREE.MeshPhongMaterial({ color: getNodeColor(node.hyperlinks) });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            Math.random() * 100 - 50,
            Math.random() * 100 - 50,
            Math.random() * 100 - 50
        );
        mesh.userData = { nodeId: node.id };
        scene.add(mesh);
    });

    // Create edges
    edges.forEach(edge => {
        const sourceNode = scene.children.find(child => child.userData.nodeId === edge.source);
        const targetNode = scene.children.find(child => child.userData.nodeId === edge.target);
        
        if (sourceNode && targetNode) {
            const material = new THREE.LineBasicMaterial({ color: getEdgeColor(edge.weight) });
            const geometry = new THREE.BufferGeometry().setFromPoints([
                sourceNode.position,
                targetNode.position
            ]);
            const line = new THREE.Line(geometry, material);
            scene.add(line);
        }
    });
}

/**
 * Calculates the size of a node based on its file size
 * @param {number} fileSize Size of the file in bytes
 * @returns {number} Size of the node
 */
function calculateNodeSize(fileSize) {
    const normalizedSize = fileSize / MAX_FILE_SIZE;
    return NODE_BASE_SIZE * Math.pow(normalizedSize, NODE_SIZE_EXPONENT);
}

/**
 * Determines the color of a node based on its hyperlink count
 * @param {number} hyperlinkCount Number of hyperlinks in the node
 * @returns {THREE.Color} Color of the node
 */
function getNodeColor(hyperlinkCount) {
    const t = Math.min(hyperlinkCount / MAX_HYPERLINK_COUNT, 1);
    return new THREE.Color(t, 0, 1 - t);
}

/**
 * Determines the color of an edge based on its weight
 * @param {number} weight Weight of the edge
 * @returns {THREE.Color} Color of the edge
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
        // Regular rendering for spoofed VR
        renderer.render(scene, camera);
    } else if (renderer.xr.isPresenting) {
        // WebXR rendering
        renderer.render(scene, camera);
    } else {
        // Non-VR rendering
        controls.update();
        renderer.render(scene, camera);
    }
}

/**
 * Initializes the application
 */
async function init() {
    initScene();
    await setupXR();
    await loadData();
    createGraphObjects();
    animate();
}

// Start the application
init();

