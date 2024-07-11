import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/webxr/VRButton.js';

let renderer, scene, camera, controls;
let nodes = [], edges = [];

const NODE_BASE_SIZE = 0.2;
const NODE_SIZE_EXPONENT = 0.5;
const MAX_FILE_SIZE = 1000000;
const MAX_HYPERLINK_COUNT = 20;
const MAX_EDGE_WEIGHT = 10;
const INITIAL_POSITION_RANGE = 20;

const SPOOF_VR = true;

const statusEl = document.getElementById('status');
const nodeCountEl = document.getElementById('nodeCount');
const edgeCountEl = document.getElementById('edgeCount');

function updateStatus(message) {
    statusEl.textContent = `Status: ${message}`;
    console.log(`Status: ${message}`);
}

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    window.addEventListener('resize', onWindowResize, false);
}

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

function enterVR() {
    if (SPOOF_VR) {
        startSpoofedVRSession();
    } else {
        navigator.xr.requestSession('immersive-vr').then(onVRSessionStarted);
    }
}

function startSpoofedVRSession() {
    updateStatus('Starting spoofed VR session');
    setupSpoofedVRControls();
    animate();
}

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
        console.log(`Camera Position: X=${camera.position.x}, Y=${camera.position.y}, Z=${camera.position.z}`);
    });
}

function onVRSessionStarted(session) {
    renderer.xr.setSession(session);
    updateStatus('VR session started');
}

async function loadData() {
    updateStatus('Loading graph data');
    try {
        const response = await fetch('/graph-data');
        const graphData = await response.json();
        console.log('Received graph data:', graphData);
        nodes = graphData.nodes;
        edges = graphData.edges;

        nodeCountEl.textContent = `Nodes: ${nodes.length}`;
        edgeCountEl.textContent = `Edges: ${edges.length}`;
        updateStatus('Graph data loaded');
    } catch (error) {
        console.error('Error loading graph data:', error);
        updateStatus('Error loading graph data');
    }
}

function createGraphObjects() {
    console.log('Creating graph objects');
    nodes.forEach(node => {
        const geometry = new THREE.SphereGeometry(calculateNodeSize(node.size), 32, 32);
        const material = new THREE.MeshPhongMaterial({ color: getNodeColor(node.hyperlinks) });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            Math.random() * INITIAL_POSITION_RANGE - INITIAL_POSITION_RANGE / 2,
            Math.random() * INITIAL_POSITION_RANGE - INITIAL_POSITION_RANGE / 2,
            Math.random() * INITIAL_POSITION_RANGE - INITIAL_POSITION_RANGE / 2
        );
        mesh.userData = { nodeId: node.id, name: node.name };
        scene.add(mesh);
        console.log(`Created node: ${node.name}`);
    });

    edges.forEach(edge => {
        const sourceNode = scene.children.find(child => child.userData.nodeId === edge.source);
        const targetNode = scene.children.find(child => child.userData.nodeId === edge.target);

        if (sourceNode && targetNode) {
            const material = new THREE.LineBasicMaterial({ color: getEdgeColor(edge.weight) });
            const points = [sourceNode.position, targetNode.position];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            scene.add(line);
            console.log(`Created edge between ${sourceNode.userData.name} and ${targetNode.userData.name}`);
        }
    });
}

function calculateNodeSize(fileSize) {
    const normalizedSize = fileSize / MAX_FILE_SIZE;
    return NODE_BASE_SIZE * Math.pow(normalizedSize, NODE_SIZE_EXPONENT);
}

function getNodeColor(hyperlinkCount) {
    const t = Math.min(hyperlinkCount / MAX_HYPERLINK_COUNT, 1);
    return new THREE.Color(t, 0, 1 - t);
}

function getEdgeColor(weight) {
    const t = Math.min(weight / MAX_EDGE_WEIGHT, 1);
    return new THREE.Color(1 - t, t, 0);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    if (SPOOF_VR) {
        requestAnimationFrame(animate);
        render();
    } else {
        renderer.setAnimationLoop(render);
    }
}

function render(time, frame) {
    controls.update();
    renderer.render(scene, camera);
}

async function init() {
    updateStatus('Initializing application');
    initScene();
    await setupXR();
    await loadData();
    createGraphObjects();
    animate();
    updateStatus('Initialization complete');
}

init();
