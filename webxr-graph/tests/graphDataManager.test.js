// graphDataManager.test.js

import { loadData, setDebugMode, validateGraphData } from '../public/js/graphDataManager';
import { addDebugMessage } from '../public/js/chatManager';

jest.mock('./chatManager');

describe('Graph Data Manager Functions', () => {

    beforeEach(() => {
      jest.clearAllMocks();
      fetch.resetMocks(); // Reset fetch mocks before each test
  });
  
  describe('loadData()', () => {
      it('should fetch graph data successfully', async () => {
          const mockResponse = { nodes: [], edges: [] };
          fetch.mockResponseOnce(JSON.stringify(mockResponse));

          const result = await loadData();

          expect(result).toEqual(mockResponse);
          expect(fetch).toHaveBeenCalledWith('/graph-data');
      });

      it('should handle errors when fetching graph data', async () => {
          fetch.mockReject(new Error("Fetch failed"));

          await loadData();

          expect(addDebugMessage).toHaveBeenCalledWith(expect.stringContaining("Error loading graph data"));
      });
  });

  describe('setDebugMode()', () => {
      it('should set debug mode correctly', () => {
          setDebugMode(true);
          expect(isDebugMode).toBe(true); // Assuming isDebugMode is defined in your module.
          
          setDebugMode(false);
          expect(isDebugMode).toBe(false);
      });
  });

  describe('validateGraphData()', () => {
      it('should return false for invalid graph data structure', () => {
          const result1 = validateGraphData(null);
          const result2 = validateGraphData({});
          
          expect(result1).toBe(false);
          expect(result2).toBe(false
