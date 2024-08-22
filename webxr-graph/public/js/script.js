/**
 * script.js
 * Entry point for the WebXR Graph Visualization application.
 */

import { initScene, onWindowResize } from './sceneSetup.js';
import { addDebugMessage, initializeChat, loadChatHistory, setupChatEventListeners } from './chatManager.js';
import { setupXR } from './xrSetup.js';
import { loadData, setupWebSocket, throttle } from './graphDataManager.js';
import { updateGraphObjects, clearObjectPools } from './graphVisualizer.js';
import { setupKeyboardControls } from './userInterface.js';
import { Interface } from './interfaces.js';
import * as CONSTANTS from './constants.js';
import { GraphSimulation } from './GraphSimulation.js';
import { setDebugMode } from './graphDataManager.js';


// Application state
const state = {
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    graphSimulation: null,
    interface: null,
    nodes: [],
    edges: [],
    nodePool: [],
    edgePool: [],
    lastTime: 0,
    animationFrameId: null,
    wsConnection: null,
    debugMode: false,
    xrControllers: []
};

/**
 * Initializes the application.
 * @async
 */
async function init() {
    console.time('Initialization');
    addDebugMessage('Starting initialization...');
    
    try {
        const sceneSetup = await initScene();
        Object.assign(state, sceneSetup);
        addDebugMessage('Scene initialized');

        const xrSetup = await setupXR(state.renderer, state.scene);
        state.xrControllers = xrSetup.controllers;
        addDebugMessage('XR setup complete');

        state.interface = new Interface(state.camera, state.scene, state.nodePool);
        setupSpaceMouseInitButton();
        addDebugMessage('Interface initialized');
        
        // setupKeyboardControls();
        // addDebugMessage('Keyboard controls set up');
        
        const initialData = await loadData();
        addDebugMessage(`Initial data loaded: ${initialData.nodes.length} nodes, ${initialData.edges.length} edges`);
        updateGraphData(initialData);

        await initializeChat();
        await loadChatHistory();
        setupChatEventListeners();
        addDebugMessage('Chat initialized, history loaded, and event listeners set up');
        
        state.wsConnection = setupWebSocket(throttle(updateGraphData, 100));
        addDebugMessage('WebSocket connection established');
        
        setupDebugToggle(); // Add this line to set up the debug toggle button
        
        console.timeEnd('Initialization');
        addDebugMessage('Initialization complete. Starting animation loop.');
        state.animationFrameId = requestAnimationFrame(animate);
    } catch (error) {
        console.error('Initialization failed:', error);
        addDebugMessage(`Initialization failed: ${error.message}`);
    }
}

/**
 * Sets up the debug mode toggle button.
 */
function setupDebugToggle() {
    const debugToggle = document.getElementById('debugToggle');
    if (debugToggle) {
        debugToggle.addEventListener('click', toggleDebugMode);
        addDebugMessage('Debug toggle button set up');
    } else {
        addDebugMessage('Debug toggle button not found in the DOM');
    }
}

/**
 * Toggles the debug mode on and off.
 */
function toggleDebugMode() {
    state.debugMode = !state.debugMode;
    setDebugMode(state.debugMode);
    addDebugMessage(`Debug mode ${state.debugMode ? 'enabled' : 'disabled'}`);
}


/**
 * Sets up the SpaceMouse initialization button.
 */
function setupSpaceMouseInitButton() {
    const button = document.getElementById('initSpaceMouseButton');
    if (button) {
        button.addEventListener('click', async () => {
            try {
                await state.interface.initSpaceMouse();
                button.disabled = true;
                button.textContent = 'SpaceMouse Initialized';
                addDebugMessage('SpaceMouse initialized successfully');
            } catch (error) {
                addDebugMessage(`Failed to initialize SpaceMouse: ${error.message}`);
            }
        });
        addDebugMessage('SpaceMouse init button set up');
    } else {
        addDebugMessage('SpaceMouse init button not found in the DOM');
    }
}

/**
 * Main animation loop.
 * @param {number} time - Current timestamp.
 */
function animate(time) {
    const deltaTime = (time - state.lastTime) / 1000;
    state.lastTime = time;

    if (state.graphSimulation) {
        state.graphSimulation.compute(deltaTime);
        updateGraphObjects(state.graphSimulation, state.nodePool, state.edgePool, state.camera);
        if (state.animationFrameId % 60 === 0) { // Log every 60 frames to avoid spam
            addDebugMessage(`Graph updated: ${state.nodePool.length} nodes, ${state.edgePool.length} edges`);
        }
    } else {
        if (state.animationFrameId % 300 === 0) { // Log every 300 frames
            addDebugMessage('No graph simulation to update');
        }
    }

    state.interface.update(deltaTime);
    state.controls.update();
    state.renderer.render(state.scene, state.camera);

    state.animationFrameId = requestAnimationFrame(animate);
}

/**
 * Updates the graph data and reinitializes the simulation if necessary.
 * @param {Object} graphData - New graph data.
 */
function updateGraphData(graphData) {
    if (!graphData || !graphData.nodes || !graphData.edges) {
        addDebugMessage('Invalid graph data received');
        console.error('Invalid graph data received:', graphData);
        return;
    }

    addDebugMessage(`Updating graph data: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
    state.nodes = graphData.nodes;
    state.edges = graphData.edges;

    if (!state.graphSimulation) {
        addDebugMessage('Creating new GraphSimulation');
        state.graphSimulation = new GraphSimulation(state.renderer, state.nodes, state.edges);
    } else {
        addDebugMessage('Updating existing GraphSimulation');
        state.graphSimulation.updateNodeData(state.nodes);
        state.graphSimulation.updateEdgeData(state.edges);
    }

    clearObjectPools(state.nodePool, state.edgePool);
    addDebugMessage('Object pools cleared');
}

/**
 * Cleans up resources and stops the animation loop.
 */
function cleanup() {
    if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
    }
    if (state.wsConnection) {
        state.wsConnection.closeConnection();
    }
    addDebugMessage('Application cleanup complete');
}

// Event listener for window resize
window.addEventListener('resize', () => {
    onWindowResize(state.camera, state.renderer);
    addDebugMessage('Window resized, scene adjusted');
}, false);

// Initialize the application
init().catch(error => {
    console.error('Unhandled error during initialization:', error);
    addDebugMessage(`Unhandled error during initialization: ${error.message}`);
});

// Cleanup on page unload
window.addEventListener('unload', cleanup);

addDebugMessage('script.js loaded and event listeners set up');
