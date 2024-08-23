// server.test.js

import {
    initialize,
    loadGraphData,
    saveGraphData,
    sanitizeInput,
    fetchMarkdownMetadata,
    compareAndIdentifyUpdates,
    fetchAndUpdateFiles,
    extractReferences,
    buildEdges,
    refreshGraphData,
    createConversation,
    sendMessage
  } from '../server';
  
  import fs from 'fs/promises';
  import axios from 'axios';
  import WebSocket from 'ws';
  
  jest.mock('fs/promises');
  jest.mock('axios');
  jest.mock('ws');
  
  describe('Server Functions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('initialize', () => {
      it('creates necessary directories and files', async () => {
        fs.mkdir.mockResolvedValue();
        fs.access.mockRejectedValue(new Error());
        fs.writeFile.mockResolvedValue();
  
        await initialize();
  
        expect(fs.mkdir).toHaveBeenCalledTimes(2);
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
      });
    });
  
    describe('loadGraphData', () => {
      it('loads graph data successfully', async () => {
        const mockData = JSON.stringify({ nodes: [], edges: [] });
        fs.readFile.mockResolvedValue(mockData);
  
        const result = await loadGraphData();
  
        expect(result).toEqual({ nodes: [], edges: [] });
      });
  
      it('returns empty graph data on error', async () => {
        fs.readFile.mockRejectedValue(new Error('File not found'));
  
        const result = await loadGraphData();
  
        expect(result).toEqual({ nodes: [], edges: [] });
      });
    });
  
    describe('saveGraphData', () => {
      it('saves graph data successfully', async () => {
        const mockGraphData = { nodes: [{ name: 'Node1' }], edges: [] };
        
        await saveGraphData(mockGraphData);
        
        expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), JSON.stringify(mockGraphData, null, 2));
      });
    });
  
    describe('sanitizeInput', () => {
      it('sanitizes input correctly', () => {
        const input = 'Hello\nWorld\t!';
        const expectedOutput = 'Hello\\nWorld\\t!';
        expect(sanitizeInput(input)).toBe(expectedOutput);
      });
  
      it('returns empty string for non-string input', () => {
        expect(sanitizeInput(123)).toBe('');
        expect(sanitizeInput(null)).toBe('');
        expect(sanitizeInput(undefined)).toBe('');
      });
    });
  
    describe('fetchMarkdownMetadata', () => {
      it('fetches markdown metadata successfully', async () => {
        const mockResponse = { data: [{ name: 'file1.md' }, { name: 'file2.txt' }] };
        axios.get.mockResolvedValue(mockResponse);
  
        const result = await fetchMarkdownMetadata();
  
        expect(result).toEqual([{ name: 'file1.md' }]);
      });
    });
  
    describe('compareAndIdentifyUpdates', () => {
      it('identifies files that need updating', async () => {
        fs.readdir.mockResolvedValue(['file1.md', 'file2.md']);
        fs.readFile.mockResolvedValue(JSON.stringify({ sha: 'old-sha' }));
  
        const githubFiles = [
          { name: 'file1.md', sha: 'new-sha' },
          { name: 'file3.md', sha: 'new-file-sha' }
        ];
  
        const result = await compareAndIdentifyUpdates(githubFiles);
  
        expect(result).toEqual([
          { name: 'file1.md', sha: 'new-sha' },
          { name: 'file3.md', sha: 'new-file-sha' }
        ]);
      });
    });
  
    describe('extractReferences', () => {
      it('extracts references correctly', () => {
        const content = 'This references Node1 and also [Node2](https://example.com)';
        const nodeNames = ['Node1', 'Node2', 'Node3'];
  
        const result = extractReferences(content, nodeNames);
  
        expect(result).toEqual({ Node1: 1, Node2: 0.1 });
      });
    });
  
    describe('refreshGraphData', () => {
      it('refreshes graph data when updates are available', async () => {
        fetchMarkdownMetadata.mockResolvedValue([{ name: 'file1.md' }]);
        compareAndIdentifyUpdates.mockResolvedValue([{ name: 'file1.md' }]);
        fetchAndUpdateFiles.mockResolvedValue([{ name: 'file1.md', content: 'updated content' }]);
        buildEdges.mockResolvedValue();
  
        const result = await refreshGraphData();
  
        expect(result).toBe(true);
      });
  
      it('does not refresh when no updates are needed', async () => {
        fetchMarkdownMetadata.mockResolvedValue([{ name: 'file1.md' }]);
        compareAndIdentifyUpdates.mockResolvedValue([]);
  
        const result = await refreshGraphData();
  
        expect(result).toBe(false);
      });
    });
  
    describe('createConversation', () => {
      it('creates a conversation successfully', async () => {
        const mockResponse = { data: { data: { id: 'conv-123' } } };
        axios.get.mockResolvedValue(mockResponse);
  
        const result = await createConversation('user-1');
  
        expect(result).toBe('conv-123');
      });
    });
  
    describe('sendMessage', () => {
      it('sends a message successfully', async () => {
        const mockResponse = { data: { answer: 'Hello, user!' } };
        axios.post.mockResolvedValue(mockResponse);
  
        const result = await sendMessage('conv-123', 'Hello');
  
        expect(result).toEqual({ answer: 'Hello, user!' });
      });
    });
  });
  