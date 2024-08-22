/**
 * xrSetup.js
 * Handles WebXR setup and VR functionality.
 */

import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

// Constants
const VR_SESSION_TYPE = 'immersive-vr';
const CONTROLLER_COUNT = 2;

/**
 * Sets up WebXR for VR functionality.
 * @param {THREE.WebGLRenderer} renderer - The Three.js WebGL renderer
 * @param {THREE.Scene} scene - The Three.js scene
 * @returns {Promise<{isVRSupported: boolean, controllers: THREE.XRTargetRaySpace[]}>}
 */
export async function setupXR(renderer, scene) {
    let isVRSupported = false;
    const controllers = [];

    try {
        isVRSupported = await checkVRSupport();
        if (isVRSupported) {
            enableVR(renderer);
            addVRButton(renderer);
            controllers.push(...createControllers(renderer, scene));
            setupVREvents(renderer);
            console.log('VR support enabled');
        } else {
            console.log('VR not supported on this device');
        }
    } catch (err) {
        console.error('Error setting up VR:', err);
    }

    return { isVRSupported, controllers };
}

/**
 * Checks if VR is supported on the device.
 * @returns {Promise<boolean>}
 */
async function checkVRSupport() {
    if (!navigator.xr) {
        console.log('WebXR not available');
        return false;
    }
    try {
        return await navigator.xr.isSessionSupported(VR_SESSION_TYPE);
    } catch (err) {
        console.error('Error checking VR support:', err);
        return false;
    }
}

/**
 * Enables VR on the renderer.
 * @param {THREE.WebGLRenderer} renderer 
 */
function enableVR(renderer) {
    renderer.xr.enabled = true;
}

/**
 * Adds the VR button to the document.
 * @param {THREE.WebGLRenderer} renderer 
 */
function addVRButton(renderer) {
    const vrButton = VRButton.createButton(renderer);
    document.body.appendChild(vrButton);
}

/**
 * Creates VR controllers and adds them to the scene.
 * @param {THREE.WebGLRenderer} renderer 
 * @param {THREE.Scene} scene 
 * @returns {THREE.XRTargetRaySpace[]}
 */
function createControllers(renderer, scene) {
    const controllerModelFactory = new XRControllerModelFactory();
    const controllers = [];

    for (let i = 0; i < CONTROLLER_COUNT; i++) {
        const controller = renderer.xr.getController(i);
        scene.add(controller);

        const grip = renderer.xr.getControllerGrip(i);
        grip.add(controllerModelFactory.createControllerModel(grip));
        scene.add(grip);

        controllers.push(controller);
    }

    return controllers;
}

/**
 * Sets up VR-specific event listeners.
 * @param {THREE.WebGLRenderer} renderer 
 */
function setupVREvents(renderer) {
    renderer.xr.addEventListener('sessionstart', onVRSessionStart);
    renderer.xr.addEventListener('sessionend', onVRSessionEnd);
}

/**
 * Handles the start of a VR session.
 */
function onVRSessionStart() {
    console.log('VR session started');
    // Add any necessary logic for when a VR session starts
}

/**
 * Handles the end of a VR session.
 */
function onVRSessionEnd() {
    console.log('VR session ended');
    // Add any necessary cleanup logic for when a VR session ends
}
