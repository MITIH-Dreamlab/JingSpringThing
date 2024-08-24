// GraphSimulation.test.js

import { GraphSimulation } from '../public/js/GraphSimulation';
import * as THREE from 'three';

jest.mock('three');
jest.mock('three/examples/jsm/misc/GPUComputationRenderer', () => ({
  GPUComputationRenderer: jest.fn().mockImplementation(() => ({
    isSupported: true,
    createTexture: jest.fn(),
    addVariable: jest.fn(),
    setVariableDependencies: jest.fn(),
    init: jest.fn().mockReturnValue(null),
    compute: jest.fn(),
  })),
}));

describe('GraphSimulation', () => {
  let mockRenderer, mockNodes, mockEdges;

  beforeEach(() => {
    mockRenderer = new THREE.WebGLRenderer();
    mockNodes = [{ id: 1 }, { id: 2 }];
    mockEdges = [{ source: 1, target: 2, weight: 1 }];
  });

  test('should initialize with GPU simulation if supported', () => {
    const simulation = new GraphSimulation(mockRenderer, mockNodes, mockEdges);
    expect(simulation.useCPUSimulation).toBe(false);
  });

  test('should fall back to CPU simulation if GPU not supported', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const mockGPUCompute = require('three/examples/jsm/misc/GPUComputationRenderer').GPUComputationRenderer;
    mockGPUCompute.mockImplementation(() => ({ isSupported: false }));

    const simulation = new GraphSimulation(mockRenderer, mockNodes, mockEdges);
    expect(simulation.useCPUSimulation).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('GPU computation not available'));
  });

  test('should update node data correctly', () => {
    const simulation = new GraphSimulation(mockRenderer, mockNodes, mockEdges);
    const newNodes = [{ id: 1 }, { id: 2 }, { id: 3 }];
    simulation.updateNodeData(newNodes);
    expect(simulation.nodes).toEqual(newNodes);
  });

  test('should update edge data correctly', () => {
    const simulation = new GraphSimulation(mockRenderer, mockNodes, mockEdges);
    const newEdges = [{ source: 1, target: 2, weight: 2 }, { source: 2, target: 3, weight: 1 }];
    simulation.updateEdgeData(newEdges);
    expect(simulation.edges).toEqual(newEdges);
  });

  test('should compute simulation step', () => {
    const simulation = new GraphSimulation(mockRenderer, mockNodes, mockEdges);
    const computeSpy = jest.spyOn(simulation, 'compute');
    simulation.compute(0.016);
    expect(computeSpy).toHaveBeenCalledWith(0.016);
  });

  test('should get node positions', () => {
    const simulation = new GraphSimulation(mockRenderer, mockNodes, mockEdges);
    const positions = simulation.getNodePositions();
    expect(positions).toBeInstanceOf(Float32Array);
    expect(positions.length).toBe(mockNodes.length * 4);
  });
});
