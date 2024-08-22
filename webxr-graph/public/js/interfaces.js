import * as THREE from 'three';

export class Interface {
    constructor(camera, scene, nodes) {
        this.camera = camera;
        this.scene = scene;
        this.nodes = nodes;

        // SpaceMouse variables
        this.spaceMouse = null;
        this.isSpaceMouseInitialized = false;
        this.translation = new THREE.Vector3();
        this.rotation = new THREE.Vector3();

        // Acceleration and sensitivity settings
        this.translationSpeed = 0.01;
        this.rotationSpeed = 0.001;

        // Reticule
        this.reticule = this.createReticule();
        this.camera.add(this.reticule);  // This line ensures the reticule is attached to the camera
        

        // Selected node
        this.selectedNode = null;

        // Bind methods
        this.handleSpaceMouseInput = this.handleSpaceMouseInput.bind(this);
        this.update = this.update.bind(this);
    }

    /**
     * Initializes the SpaceMouse
     */
    async initSpaceMouse() {
        if (this.isSpaceMouseInitialized) return;

        try {
            if (!navigator.hid) {
                console.error('WebHID API is not supported in this browser');
                return;
            }

            const devices = await navigator.hid.getDevices();
            console.log('Available HID devices:', devices);

            const spaceMouseDevices = await navigator.hid.requestDevice({
                filters: [{ vendorId: 0x046d }]  // 3Dconnexion vendor ID
            });

            if (spaceMouseDevices.length === 0) {
                throw new Error('No SpaceMouse found');
            }

            this.spaceMouse = spaceMouseDevices[0];
            await this.spaceMouse.open();

            this.spaceMouse.addEventListener('inputreport', this.handleSpaceMouseInput);
            console.log('SpaceMouse initialized:', this.spaceMouse.productName);
            this.isSpaceMouseInitialized = true;
        } catch (error) {
            console.error('Failed to initialize SpaceMouse:', error);
        }
    }

    /**
     * Handles SpaceMouse input
     * @param {HIDInputReportEvent} event - The input report event from the SpaceMouse
     */
    handleSpaceMouseInput(event) {
        const { data } = event;

        console.log('Raw SpaceMouse data:', new Uint8Array(data.buffer));

        if (data.buffer.byteLength < 1) {
            console.warn('Received empty data from SpaceMouse');
            return;
        }

        const view = new DataView(data.buffer);
        console.log('Bytes received:', view.byteLength);

        // Attempt to read translation and rotation data
        if (view.byteLength >= 6) {
            this.translation.set(
                view.getInt16(0, true) || 0,
                view.getInt16(2, true) || 0,
                view.getInt16(4, true) || 0
            );
        }

        if (view.byteLength >= 12) {
            this.rotation.set(
                view.getInt16(6, true) || 0,
                view.getInt16(8, true) || 0,
                view.getInt16(10, true) || 0
            );
        }

        console.log('SpaceMouse input:', {
            translation: this.translation,
            rotation: this.rotation
        });
    }

    /**
     * Updates camera position and rotation based on SpaceMouse input
     */
    update(deltaTime) {
        if (this.spaceMouse) {
            // Update camera position
            this.camera.position.add(
                this.translation.clone().multiplyScalar(this.translationSpeed * deltaTime)
            );

            // Update camera rotation
            this.camera.rotation.x += this.rotation.x * this.rotationSpeed * deltaTime;
            this.camera.rotation.y += this.rotation.y * this.rotationSpeed * deltaTime;
            this.camera.rotation.z += this.rotation.z * this.rotationSpeed * deltaTime;

            // Ensure the camera is looking at the center of the scene
            this.camera.lookAt(this.scene.position);
        }
    }

    /**
     * Creates a reticule in the center of the screen
     * @returns {THREE.Mesh} The reticule mesh
     */
    createReticule() {
        const geometry = new THREE.RingGeometry(0.02, 0.04, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const reticule = new THREE.Mesh(geometry, material);
        reticule.position.set(0, 0, -1);
        this.camera.add(reticule);
        return reticule;
    }
    

    /**
     * Selects the node at the center of the screen
     */
    selectNode() {
        const raycaster = new THREE.Raycaster();
        const center = new THREE.Vector2(0, 0);

        raycaster.setFromCamera(center, this.camera);

        const intersects = raycaster.intersectObjects(this.nodes);

        if (intersects.length > 0) {
            this.selectedNode = intersects[0].object;
            console.log('Selected node:', this.selectedNode.userData.name);
            // You can add more logic here to highlight the selected node or perform other actions
        } else {
            this.selectedNode = null;
            console.log('No node selected');
        }
    }

    /**
     * Sets the translation speed
     * @param {number} value - The new speed value
     */
    setTranslationSpeed(value) {
        this.translationSpeed = value;
    }

    /**
     * Sets the rotation speed
     * @param {number} value - The new speed value
     */
    setRotationSpeed(value) {
        this.rotationSpeed = value;
    }
}
