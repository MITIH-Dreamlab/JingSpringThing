/**
 * sceneSetup.js
 * Handles the setup and initialization of the Three.js scene.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Constants for scene setup
const FOV = 75;
const NEAR_PLANE = 0.1;
const FAR_PLANE = 1000;
const CAMERA_POSITION = [0, 0, 200];
const BACKGROUND_COLOR = 0x000000;
const AMBIENT_LIGHT_COLOR = 0xffffff;
const AMBIENT_LIGHT_INTENSITY = 0.5;
const DIRECTIONAL_LIGHT_COLOR = 0xffffff;
const DIRECTIONAL_LIGHT_INTENSITY = 0.5;
const DIRECTIONAL_LIGHT_POSITION = [0, 1, 0];

/**
 * Initializes the 3D scene, camera, renderer, and controls.
 * @returns {Promise<{renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls}>}
 */
export async function initScene() {
    const { renderer, container } = createRenderer();
    const scene = createScene();
    const camera = createCamera();
    const controls = createControls(camera, renderer.domElement);

    addLightsToScene(scene);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0, -5); // Position it 5 units in front of the camera
    scene.add(cube);

    window.addEventListener('resize', () => onWindowResize(camera, renderer), false);

    return { renderer, scene, camera, controls };
}

/**
 * Creates and configures the WebGL renderer.
 * @returns {{renderer: THREE.WebGLRenderer, container: HTMLElement}}
 */
function createRenderer() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    return { renderer, container };
}

/**
 * Creates and configures the scene.
 * @returns {THREE.Scene}
 */
function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND_COLOR);
    return scene;
}

/**
 * Creates and configures the camera.
 * @returns {THREE.PerspectiveCamera}
 */
function createCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(FOV, aspect, NEAR_PLANE, FAR_PLANE);
    camera.position.fromArray(CAMERA_POSITION);
    camera.lookAt(0, 0, 0);
    return camera;
}

/**
 * Creates and configures the OrbitControls.
 * @param {THREE.PerspectiveCamera} camera 
 * @param {HTMLElement} domElement 
 * @returns {OrbitControls}
 */
function createControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    return controls;
}

/**
 * Adds lights to the scene.
 * @param {THREE.Scene} scene 
 */
function addLightsToScene(scene) {
    const ambientLight = new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY);
    directionalLight.position.fromArray(DIRECTIONAL_LIGHT_POSITION);
    scene.add(directionalLight);
}

/**
 * Handles window resize events.
 * @param {THREE.PerspectiveCamera} camera 
 * @param {THREE.WebGLRenderer} renderer 
 */
export function onWindowResize(camera, renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
