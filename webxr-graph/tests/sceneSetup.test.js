// sceneSetup.test.js

import { initScene, onWindowResize } from '../public/js/sceneSetup';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

jest.mock('three');
jest.mock('three/examples/jsm/controls/OrbitControls');

describe('sceneSetup', () => {
  beforeEach(() => {
    // Mock the document methods
    document.createElement = jest.fn().mockReturnValue({
      appendChild: jest.fn(),
    });
    document.body.appendChild = jest.fn();
  });

  test('initScene should return renderer, scene, camera, and controls', async () => {
    const result = await initScene();
    
    expect(result.renderer).toBeInstanceOf(THREE.WebGLRenderer);
    expect(result.scene).toBeInstanceOf(THREE.Scene);
    expect(result.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(result.controls).toBeInstanceOf(OrbitControls);
  });

  test('initScene should add a cube to the scene', async () => {
    const { scene } = await initScene();
    
    expect(scene.add).toHaveBeenCalledWith(expect.any(THREE.Mesh));
  });

  test('onWindowResize should update camera and renderer', () => {
    const mockCamera = {
      aspect: 1,
      updateProjectionMatrix: jest.fn(),
    };
    const mockRenderer = {
      setSize: jest.fn(),
    };

    onWindowResize(mockCamera, mockRenderer);

    expect(mockCamera.updateProjectionMatrix).toHaveBeenCalled();
    expect(mockRenderer.setSize).toHaveBeenCalledWith(window.innerWidth, window.innerHeight);
  });
});
