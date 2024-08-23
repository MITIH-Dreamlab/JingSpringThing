// script.test.js

import { init, updateGraphData, cleanup } from '../public/js/script';
import * as sceneSetup from '../public/js/sceneSetup';
import * as chatManager from '../public/js/chatManager';
import * as xrSetup from '../public/js/xrSetup';
import * as graphDataManager from '../public/js/graphDataManager';
import * as graphVisualizer from '../public/js/graphVisualizer';
import * as userInterface from '../public/js/userInterface';
import { Interface } from '../public/js/interfaces';
import { GraphSimulation } from '../public/js/GraphSimulation';

// Mock all imported modules
jest.mock('../public/js/sceneSetup');
jest.mock('../public/js/chatManager');
jest.mock('../public/js/xrSetup');
jest.mock('../public/js/graphDataManager');
jest.mock('../public/js/graphVisualizer');
jest.mock('../public/js/userInterface');
jest.mock('../public/js/interfaces');
jest.mock('../public/js/GraphSimulation');

describe('script.js', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Mock DOM elements
        document.body.innerHTML = `
            <button id="debugToggle"></button>
            <button id="initSpaceMouseButton"></button>
        `;

        // Mock window.requestAnimationFrame
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => setTimeout(cb, 0));
    });

    afterEach(() => {
        // Restore window.requestAnimationFrame
        window.requestAnimationFrame.mockRestore();
    });

    describe('init function', () => {
        it('should initialize the application correctly', async () => {
            // Mock return values
            sceneSetup.initScene.mockResolvedValue({ renderer: {}, scene: {}, camera: {} });
            xrSetup.setupXR.mockResolvedValue({ controllers: [] });
            graphDataManager.loadData.mockResolvedValue({ nodes: [], edges: [] });
            graphDataManager.setupWebSocket.mockReturnValue({ closeConnection: jest.fn() });

            await init();

            // Check if all necessary functions were called
            expect(sceneSetup.initScene).toHaveBeenCalled();
            expect(xrSetup.setupXR).toHaveBeenCalled();
            expect(chatManager.initializeChat).toHaveBeenCalled();
            expect(chatManager.loadChatHistory).toHaveBeenCalled();
            expect(chatManager.setupChatEventListeners).toHaveBeenCalled();
            expect(graphDataManager.loadData).toHaveBeenCalled();
            expect(graphDataManager.setupWebSocket).toHaveBeenCalled();
            expect(window.requestAnimationFrame).toHaveBeenCalled();
        });

        it('should handle errors during initialization', async () => {
            sceneSetup.initScene.mockRejectedValue(new Error('Scene init failed'));

            await init();

            expect(chatManager.addDebugMessage).toHaveBeenCalledWith(expect.stringContaining('Initialization failed'));
        });
    });

    describe('updateGraphData function', () => {
        it('should update graph data correctly', () => {
            const mockGraphData = { nodes: [{ id: 1 }], edges: [{ source: 1, target: 2 }] };
            
            updateGraphData(mockGraphData);

            expect(GraphSimulation).toHaveBeenCalled();
            expect(graphVisualizer.clearObjectPools).toHaveBeenCalled();
        });

        it('should handle invalid graph data', () => {
            updateGraphData(null);

            expect(chatManager.addDebugMessage).toHaveBeenCalledWith('Invalid graph data received');
            expect(GraphSimulation).not.toHaveBeenCalled();
        });
    });

    describe('cleanup function', () => {
        it('should perform cleanup correctly', () => {
            const mockCloseConnection = jest.fn();
            graphDataManager.setupWebSocket.mockReturnValue({ closeConnection: mockCloseConnection });

            init().then(() => {
                cleanup();

                expect(mockCloseConnection).toHaveBeenCalled();
                expect(chatManager.addDebugMessage).toHaveBeenCalledWith('Application cleanup complete');
            });
        });
    });

    describe('Event Listeners', () => {
        it('should set up event listeners correctly', () => {
            const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

            init();

            expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function), false);
            expect(addEventListenerSpy).toHaveBeenCalledWith('unload', cleanup);
        });
    });
});
