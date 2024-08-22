/**
 * graphVisualizer.js
 * Handles the visualization of the graph in 3D space.
 */

import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { CONSTANTS } from './constants.js';

// Reusable vectors and colors to avoid object creation in loops
const tempVector = new THREE.Vector3();
const tempColor = new THREE.Color();

/**
 * Updates 3D objects for nodes and edges.
 * @param {GraphSimulation} graphSimulation - The graph simulation object
 * @param {Array} nodePool - Pool of node objects
 * @param {Array} edgePool - Pool of edge objects
 * @param {THREE.PerspectiveCamera} camera - The camera object
 */
export function updateGraphObjects(graphSimulation, nodePool, edgePool, camera) {
    const positionArray = graphSimulation.getNodePositions();
    const edges = graphSimulation.edges;

    updateNodes(positionArray, nodePool, camera);
    updateEdges(positionArray, edgePool, edges);
}

/**
 * Updates the positions and appearance of nodes.
 * @param {Float32Array} positionArray - Array of node positions
 * @param {Array} nodePool - Pool of node objects
 * @param {THREE.PerspectiveCamera} camera - The camera object
 */
function updateNodes(positionArray, nodePool, camera) {
    for (let i = 0, len = positionArray.length / 4; i < len; i++) {
        const node = nodePool[i];
        if (!node) continue;

        const baseIndex = i * 4;
        node.position.set(
            positionArray[baseIndex],
            positionArray[baseIndex + 1],
            positionArray[baseIndex + 2]
        );

        const size = calculateNodeSize(node.userData.size);
        node.scale.setScalar(size);

        getNodeColor(node.userData.linksCount, tempColor);
        node.material.color.copy(tempColor);

        updateNodeLabel(node, camera);
    }
}

/**
 * Updates the positions and appearance of edges.
 * @param {Float32Array} positionArray - Array of node positions
 * @param {Array} edgePool - Pool of edge objects
 * @param {Array} edges - Array of edge data
 */
function updateEdges(positionArray, edgePool, edges) {
    const sourcePos = tempVector;
    for (let i = 0, len = edges.length; i < len; i++) {
        const edge = edgePool[i];
        if (!edge) continue;

        const { source, target, weight } = edges[i];
        const sourceIndex = source * 4;
        const targetIndex = target * 4;

        sourcePos.set(
            positionArray[sourceIndex],
            positionArray[sourceIndex + 1],
            positionArray[sourceIndex + 2]
        );

        edge.geometry.setFromPoints([
            sourcePos,
            tempVector.set(
                positionArray[targetIndex],
                positionArray[targetIndex + 1],
                positionArray[targetIndex + 2]
            )
        ]);

        getEdgeColor(weight, tempColor);
        edge.material.color.copy(tempColor);
    }
}

/**
 * Updates the visibility and orientation of node labels.
 * @param {THREE.Object3D} node - The node object
 * @param {THREE.PerspectiveCamera} camera - The camera object
 */
function updateNodeLabel(node, camera) {
    const label = node.children[0];
    if (label) {
        const distanceToCamera = camera.position.distanceTo(node.position);
        label.visible = distanceToCamera < CONSTANTS.TEXT_VISIBILITY_THRESHOLD;
        if (label.visible) {
            label.lookAt(camera.position);
        }
    }
}

/**
 * Calculates the size of a node based on its file size.
 * @param {number} fileSize - The size of the file
 * @returns {number} The calculated node size
 */
function calculateNodeSize(fileSize) {
    const normalizedSize = Math.min(fileSize / CONSTANTS.MAX_FILE_SIZE, 1);
    return CONSTANTS.NODE_BASE_SIZE * Math.pow(normalizedSize, CONSTANTS.NODE_SIZE_EXPONENT);
}

/**
 * Determines the color of a node based on its hyperlink count.
 * @param {number} hyperlinkCount - The number of hyperlinks
 * @param {THREE.Color} target - The target color object to set
 */
function getNodeColor(hyperlinkCount, target) {
    const t = Math.min(hyperlinkCount / CONSTANTS.MAX_HYPERLINK_COUNT, 1);
    target.setRGB(t, 0, 1 - t);
}

/**
 * Determines the color of an edge based on its weight.
 * @param {number} weight - The weight of the edge
 * @param {THREE.Color} target - The target color object to set
 */
function getEdgeColor(weight, target) {
    const t = Math.min(weight / CONSTANTS.MAX_EDGE_WEIGHT, 1);
    target.setRGB(1 - t, t, 0);
}

/**
 * Clears the object pools to prevent memory leaks.
 * @param {Array} nodePool - Pool of node objects
 * @param {Array} edgePool - Pool of edge objects
 */
export function clearObjectPools(nodePool, edgePool) {
    nodePool.length = 0;
    edgePool.length = 0;
}
