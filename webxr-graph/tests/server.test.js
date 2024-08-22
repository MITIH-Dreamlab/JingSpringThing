// server.test.js

const fs = require('fs/promises');
const { sanitizeInput, loadGraphData, saveGraphData, initialize } = require('../server'); // Adjust path as necessary

// Mocking the file system operations
jest.mock('fs/promises');

describe('Server Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('sanitizeInput', () => {
        it('should return an empty string if input is not a string', () => {
            expect(sanitizeInput(123)).toBe('');
        });

        it('should escape backslashes and special characters', () => {
            const input = 'Hello\nWorld\t!';
            const expectedOutput = 'Hello\\nWorld\\t!';
            expect(sanitizeInput(input)).toBe(expectedOutput);
        });

        it('should trim whitespace from input', () => {
            const input = '  Hello World  ';
            expect(sanitizeInput(input)).toBe('Hello World');
        });
    });

    describe('loadGraphData', () => {
        it('should load graph data successfully', async () => {
            const mockData = JSON.stringify({ nodes: [], edges: [] });
            fs.readFile.mockResolvedValueOnce(mockData);

            const result = await loadGraphData();
            expect(result).toEqual({ nodes: [], edges: [] });
            expect(fs.readFile).toHaveBeenCalledWith(expect.any(String), 'utf8');
        });

        it('should return empty graph data on error', async () => {
            fs.readFile.mockRejectedValueOnce(new Error("File not found"));

            const result = await loadGraphData();
            expect(result).toEqual({ nodes: [], edges: [] });
        });
    });

    describe('saveGraphData', () => {
        it('should save graph data successfully', async () => {
            const mockGraphData = { nodes: [{ name: 'Node1' }], edges: [] };
            
            await saveGraphData(mockGraphData);
            
            expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), JSON.stringify(mockGraphData, null, 2));
        });

        it('should handle errors when saving graph data', async () => {
            fs.writeFile.mockRejectedValueOnce(new Error("Write failed"));
            
            console.error = jest.fn(); // Mock console.error to suppress output during tests
            
            await saveGraphData({});
            
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error saving graph data:"), expect.any(Error));
        });
    });

    describe('initialize function', () => {
        beforeEach(() => {
          jest.clearAllMocks();
          fs.mkdir.mockResolvedValueOnce(); // Mock mkdir success
          fs.access.mockResolvedValueOnce(); // Mock access success
          fs.writeFile.mockResolvedValueOnce(); // Mock write file success
      });

      it('should create directories and files successfully during initialization', async () => {
          await initialize();

          expect(fs.mkdir).toHaveBeenCalledTimes(2); // Check mkdir was called twice
          expect(fs.writeFile).toHaveBeenCalledTimes(1); // Check writeFile was called once for initial graph data
      });

      it('should handle errors during initialization gracefully', async () => {
          fs.mkdir.mockRejectedValueOnce(new Error("Directory creation failed"));

          console.error = jest.fn(); // Mock console.error to suppress output during tests

          await initialize();

          expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error during initialization:"), expect.any(Error));
      });
  });
});
