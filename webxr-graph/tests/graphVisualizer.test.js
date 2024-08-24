// graphVisualizer.test.js

import { updateGraphObjects, clearObjectPools } from '../public/js/graphVisualizer';
import * as THREE from 'three';

jest.mock('three');

describe('graphVisualizer', () => {
  let mockGraphSimulation, mockNodePool, mockEdgePool, mockCamera;

  beforeEach(() => {
    mockGraphSimulation = {
      getNodePositions: jest.fn().mockReturnValue(new Float32Array([1, 2, 3, 1, 4, 5, 6, 1])),
      edges: [{ source: 0, target: 1, weight: 1 }],
    };
    mockNodePool = [
      { position: new THREE.Vector3(), scale: new THREE.Vector3(), material: { color: new THREE.Color() }, userData: { size: 100, linksCount: 5 }, children: [{ visible: true, lookAt: jest.fn() }] },
      { position: new THREE.Vector3(), scale: new THREE.Vector3(), material: { color: new THREE.Color() }, userData: { size: 200, linksCount: 10 }, children: [{ visible: true, lookAt: jest.fn() }] },
    ];
    mockEdgePool = [
      { geometry: { setFromPoints: jest.fn() }, material: { color: new THREE.Color() } },
    ];
    mockCamera = { position: new THREE.Vector3(0, 0, 10) };
  });

  test('updateGraphObjects should update node and edge positions', () => {
    updateGraphObjects(mockGraphSimulation, mockNodePool, mockEdgePool, mockCamera);

    expect(mockNodePool[0].position.x).toBe(1);
    expect(mockNodePool[0].position.y).toBe(2);
    expect(mockNodePool[0].position.z).toBe(3);
    expect(mockNodePool[1].position.x).toBe(4);
    expect(mockNodePool[1].position.y).toBe(5);
    expect(mockNodePool[1].position.z).toBe(6);

    expect(mockEdgePool[0].geometry.setFromPoints).toHaveBeenCalled();
  });

  test('clearObjectPools should empty node and edge pools', () => {
    clearObjectPools(mockNodePool, mockEdgePool);

    expect(mockNodePool.length).toBe(0);
    expect(mockEdgePool.length).toBe(0);
  });
});
