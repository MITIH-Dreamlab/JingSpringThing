// graphDataManager.test.js

import { loadData, setDebugMode, setupWebSocket, validateGraphData, throttle } from '../public/js/graphDataManager';
import { addDebugMessage } from '../public/js/chatManager';

jest.mock('../public/js/chatManager', () => ({
    addDebugMessage: jest.fn(),
}));

describe('Graph Data Manager Functions', () => {
    let mockFetch;
    let mockWebSocket;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        mockWebSocket = {
            send: jest.fn(),
            close: jest.fn(),
        };
        global.WebSocket = jest.fn(() => mockWebSocket);
    });

    afterEach(() => {
        delete global.fetch;
        delete global.WebSocket;
    });

    describe('loadData', () => {
        test('fetches graph data successfully', async () => {
            const mockResponse = { nodes: [], edges: [] };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await loadData();

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith('/graph-data');
        });

        test('handles errors when fetching graph data', async () => {
            mockFetch.mockRejectedValueOnce(new Error("Fetch failed"));

            await expect(loadData()).rejects.toThrow("Fetch failed");
            expect(addDebugMessage).toHaveBeenCalledWith(expect.stringContaining("Error loading graph data"));
        });
    });

    describe('setDebugMode', () => {
        test('sets debug mode correctly', () => {
            setDebugMode(true);
            expect(setDebugMode(true)).toBe(undefined); // setDebugMode doesn't return anything
            setDebugMode(false);
            expect(setDebugMode(false)).toBe(undefined);
        });
    });

    describe('setupWebSocket', () => {
        test('creates WebSocket connection and handles messages', () => {
            const mockOnMessage = jest.fn();
            const wsConnection = setupWebSocket(mockOnMessage);

            expect(global.WebSocket).toHaveBeenCalled();

            // Simulate WebSocket open event
            mockWebSocket.onopen();
            expect(wsConnection.isConnected()).toBe(true);

            // Simulate receiving a valid message
            const validData = { nodes: [], edges: [] };
            mockWebSocket.onmessage({ data: JSON.stringify(validData) });
            expect(mockOnMessage).toHaveBeenCalledWith(validData);

            // Simulate receiving an invalid message
            mockWebSocket.onmessage({ data: 'invalid json' });
            expect(addDebugMessage).toHaveBeenCalledWith(expect.stringContaining("Error parsing WebSocket message"));

            // Test sending data
            wsConnection.sendData({ test: 'data' });
            expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ test: 'data' }));

            // Test closing connection
            wsConnection.closeConnection();
            expect(mockWebSocket.close).toHaveBeenCalled();
        });
    });

    describe('validateGraphData', () => {
        test('returns false for invalid graph data structure', () => {
            expect(validateGraphData(null)).toBe(false);
            expect(validateGraphData({})).toBe(false);
            expect(validateGraphData({ nodes: [], edges: {} })).toBe(false);
        });

        test('returns true for valid graph data structure', () => {
            const validData = {
                nodes: [{ id: 1 }],
                edges: [{ source: 1, target: 2 }]
            };
            expect(validateGraphData(validData)).toBe(true);
        });
    });

    describe('throttle', () => {
        test('throttles function calls', (done) => {
            jest.useFakeTimers();
            const mockFn = jest.fn();
            const throttledFn = throttle(mockFn, 100);

            throttledFn();
            throttledFn();
            throttledFn();

            expect(mockFn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(150);

            throttledFn();
            expect(mockFn).toHaveBeenCalledTimes(2);

            jest.useRealTimers();
            done();
        });
    });
});
