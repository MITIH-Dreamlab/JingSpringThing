/**
 * graphDataManager.js
 * Manages graph data loading and WebSocket communication for real-time updates.
 */

import { addDebugMessage } from './chatManager.js';

// Constants
const GRAPH_DATA_ENDPOINT = '/graph-data';
const WEBSOCKET_RECONNECT_INTERVAL = 5000; // 5 seconds

let isDebugMode = false;

export function setDebugMode(mode) {
    isDebugMode = mode;
}

function debugLog(...args) {
    if (isDebugMode) {
        console.log(...args);
        addDebugMessage(args.join(' '));
    }
}

/**
 * Loads initial graph data from the server.
 * @returns {Promise<Object>} The loaded graph data.
 * @throws {Error} If there's an error fetching or parsing the data.
 */
export async function loadData() {
    try {
        debugLog('Fetching graph data from:', GRAPH_DATA_ENDPOINT);
        const response = await fetch(GRAPH_DATA_ENDPOINT);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const graphData = await response.json();
        debugLog(`Graph data loaded successfully. Nodes: ${graphData.nodes.length}, Edges: ${graphData.edges.length}`);
        return graphData;
    } catch (error) {
        console.error('Error loading graph data:', error);
        addDebugMessage(`Error loading graph data: ${error.message}`);
        throw error;
    }
}

/**
 * Sets up WebSocket connection for real-time updates with automatic reconnection.
 * @param {Function} onMessage - Callback function to handle incoming messages.
 * @returns {Object} An object with methods to manage the WebSocket connection.
 */
export function setupWebSocket(onMessage) {
    let socket = null;
    let isConnected = false;
    let reconnectTimeout = null;

    function connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}`;
        debugLog('Connecting to WebSocket:', url);
        socket = new WebSocket(url);

        socket.onopen = handleOpen;
        socket.onmessage = handleMessage;
        socket.onerror = handleError;
        socket.onclose = handleClose;
    }

    function handleOpen() {
        debugLog('WebSocket connected');
        isConnected = true;
        clearTimeout(reconnectTimeout);
    }

    function handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            debugLog('Received WebSocket data:', data);
            if (validateGraphData(data)) {
                onMessage(data);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            addDebugMessage(`Error parsing WebSocket message: ${error.message}`);
        }
    }

    function handleError(error) {
        console.error('WebSocket error:', error, 'Current readyState:', socket.readyState);
        addDebugMessage(`WebSocket error: ${error.message}`);
    }

    function handleClose() {
        debugLog('WebSocket disconnected');
        isConnected = false;
        reconnectTimeout = setTimeout(connect, WEBSOCKET_RECONNECT_INTERVAL);
    }

    function sendData(data) {
        if (isConnected && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
            debugLog('Data sent via WebSocket');
            return true;
        } else {
            console.warn('WebSocket is not connected. Unable to send data.');
            addDebugMessage('WebSocket is not connected. Unable to send data.');
            return false;
        }
    }

    function closeConnection() {
        if (socket) {
            socket.close();
        }
        clearTimeout(reconnectTimeout);
        debugLog('WebSocket connection closed');
    }

    function getConnectionStatus() {
        return {
            isConnected,
            readyState: socket ? socket.readyState : 'No socket',
        };
    }

    connect();

    return {
        sendData,
        closeConnection,
        isConnected: () => isConnected,
        getConnectionStatus
    };
}

function validateGraphData(data) {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        console.error('Invalid graph data structure:', data);
        addDebugMessage('Invalid graph data structure received');
        return false;
    }
    debugLog(`Valid graph data received. Nodes: ${data.nodes.length}, Edges: ${data.edges.length}`);
    return true;
}

export function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    }
}
