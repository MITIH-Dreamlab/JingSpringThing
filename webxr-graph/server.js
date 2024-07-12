// server.js

const express = require('express');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
require('dotenv').config();

// Constants for file paths and GitHub configurations
const PROCESSED_STORAGE_PATH = '/usr/src/app/data/processed_files';
const MARKDOWN_STORAGE_PATH = path.join(PROCESSED_STORAGE_PATH, 'markdown');
const GRAPH_DATA_PATH = path.join(PROCESSED_STORAGE_PATH, 'graph-data.json');
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_DIRECTORY = process.env.GITHUB_DIRECTORY;
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

// Express app setup
const app = express();
const port = process.env.PORT || 8443; // Using port 8443 for HTTPS
let httpsOptions;

// WebSocket server
let wss;

/**
 * Initializes HTTPS options by reading key and certificate files.
 * @returns {Promise<void>}
 */
async function initializeHttpsOptions() {
    try {
        httpsOptions = {
            key: await fs.readFile('key.pem'),
            cert: await fs.readFile('cert.pem')
        };
        console.log('HTTPS options initialized successfully');
    } catch (error) {
        console.error('Error loading HTTPS certificates:', error);
        process.exit(1);
    }
}

/**
 * Initializes the directory structure and creates necessary files.
 * @returns {Promise<void>}
 */
async function initialize() {
    try {
        await fs.mkdir(PROCESSED_STORAGE_PATH, { recursive: true });
        await fs.mkdir(MARKDOWN_STORAGE_PATH, { recursive: true });

        if (!await fs.access(GRAPH_DATA_PATH).catch(() => false)) {
            await fs.writeFile(GRAPH_DATA_PATH, JSON.stringify({ nodes: [], edges: [] }, null, 2));
        }
        console.log('Initialization complete');
    } catch (error) {
        console.error('Error during initialization:', error);
        process.exit(1);
    }
}

/**
 * Computes the SHA256 hash of the given data.
 * @param {string} data - The data to hash.
 * @returns {string} The computed hash.
 */
function computeHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Loads the graph data from the file.
 * @returns {Promise<Object>} The graph data object.
 */
async function loadGraphData() {
    try {
        const data = await fs.readFile(GRAPH_DATA_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading graph data:', err);
        return { nodes: [], edges: [] };
    }
}

/**
 * Saves the graph data to the file.
 * @param {Object} graphData - The graph data to save.
 * @returns {Promise<void>}
 */
async function saveGraphData(graphData) {
    try {
        await fs.writeFile(GRAPH_DATA_PATH, JSON.stringify(graphData, null, 2));
        console.log('Graph data saved successfully.');
    } catch (err) {
        console.error('Error saving graph data:', err);
    }
}

/**
 * Fetches Markdown file metadata from the GitHub repository.
 * @returns {Promise<Array>} An array of file metadata objects.
 */
async function fetchMarkdownMetadata() {
    try {
        const encodedDirectory = encodeURIComponent(GITHUB_DIRECTORY).replace(/%2F/g, '/');
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedDirectory}`;
        console.log(`Fetching from URL: ${url}`);
        console.log(`Using token: ${GITHUB_ACCESS_TOKEN.substr(0, 4)}...${GITHUB_ACCESS_TOKEN.substr(-4)}`);
        
        const response = await axios.get(url, {
            headers: {
                Authorization: `token ${GITHUB_ACCESS_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
        console.log('Response status:', response.status);
        return response.data.filter(file => file.name.endsWith('.md'));
    } catch (error) {
        console.error('Error fetching Markdown metadata:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return [];
    }
}



/**
 * Compares and updates local files with the fetched metadata.
 * @param {Array} githubFiles - Array of file metadata objects from GitHub.
 * @returns {Promise<Array>} Array of files that need updating.
 */
async function compareAndIdentifyUpdates(githubFiles) {
    const filesToUpdate = [];
    for (const file of githubFiles) {
        const localPath = path.join(MARKDOWN_STORAGE_PATH, file.name);
        const metadataPath = `${localPath}.meta.json`;

        try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            if (metadata.sha !== file.sha) {
                filesToUpdate.push(file);
            }
        } catch (error) {
            // File doesn't exist locally or has no metadata
            filesToUpdate.push(file);
        }
    }
    return filesToUpdate;
}

/**
 * Fetches and updates the content of specified files.
 * @param {Array} filesToUpdate - Array of files to update.
 * @returns {Promise<Array>} Array of updated file objects.
 */
async function fetchAndUpdateFiles(filesToUpdate) {
    const updatedFiles = [];
    for (const file of filesToUpdate) {
        try {
            const response = await axios.get(file.download_url, {
                headers: { Authorization: `token ${GITHUB_ACCESS_TOKEN}` }
            });
            const content = response.data;

            if (content.includes('public:: true')) {
                const localPath = path.join(MARKDOWN_STORAGE_PATH, file.name);
                await fs.writeFile(localPath, content, 'utf8');
                await fs.writeFile(`${localPath}.meta.json`, JSON.stringify({ sha: file.sha }), 'utf8');
                updatedFiles.push({ name: file.name, filePath: localPath, content });
            }
        } catch (error) {
            console.error(`Error updating file ${file.name}:`, error.message);
        }
    }
    return updatedFiles;
}

/**
 * Extracts references to other nodes from the content.
 * @param {string} content - The content to search for references.
 * @param {string[]} nodeNames - Array of node names to search for.
 * @returns {Object} Object with node names as keys and reference counts as values.
 */
function extractReferences(content, nodeNames) {
    const references = {};
    const regexPatterns = nodeNames.map(name => ({
        name: name.replace('.md', ''),
        regex: new RegExp(`\\b${escapeRegExp(name.replace('.md', ''))}\\b`, 'gi')
    }));

    for (const { name, regex } of regexPatterns) {
        let match;
        let count = 0;
        while ((match = regex.exec(content)) !== null) {
            const surroundingText = content.substring(Math.max(0, match.index - 50), Math.min(content.length, match.index + name.length + 50));
            if (surroundingText.includes('](http') || surroundingText.includes('](https')) {
                count += 0.1;
            } else {
                count += 1;
            }
        }
        if (count > 0) {
            references[name] = parseFloat(count.toFixed(2));
        }
    }
    return references;
}

/**
 * Escapes special characters in a string for use in a regular expression.
 * @param {string} string - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds the edges of the graph based on file references.
 * @param {Array} updatedFiles - Array of updated file objects.
 * @returns {Promise<void>}
 */
async function buildEdges(updatedFiles) {
    const graphData = await loadGraphData();
    const nodeNames = graphData.nodes.map(node => node.name);
    const newEdges = [];

    for (const file of updatedFiles) {
        const source = file.name.replace('.md', '');
        const content = file.content;

        let nodeIndex = graphData.nodes.findIndex(node => node.name === source);
        const nodeEntry = {
            name: source,
            size: Buffer.byteLength(content, 'utf8'),
            httpsLinksCount: (content.match(/https?:\/\/[^\s]+/g) || []).length
        };

        if (nodeIndex === -1) {
            graphData.nodes.push(nodeEntry);
        } else {
            graphData.nodes[nodeIndex] = nodeEntry;
        }

        const references = extractReferences(content, nodeNames);
        for (const [target, weight] of Object.entries(references)) {
            if (target !== source) {
                newEdges.push({ source, target, weight });
            }
        }
    }

    // Combine new edges with existing edges
    const allEdges = [...graphData.edges.filter(edge => 
        !newEdges.some(newEdge => newEdge.source === edge.source && newEdge.target === edge.target)
    ), ...newEdges];

    // Combine edges with the same source and target
    graphData.edges = allEdges.reduce((acc, edge) => {
        const existingEdge = acc.find(e => e.source === edge.source && e.target === edge.target);
        if (existingEdge) {
            existingEdge.weight = parseFloat((existingEdge.weight + edge.weight).toFixed(2));
        } else {
            acc.push({ ...edge, weight: parseFloat(edge.weight.toFixed(2)) });
        }
        return acc;
    }, []);

    await saveGraphData(graphData);
}

/**
 * Refreshes the graph data by fetching new files and rebuilding edges.
 * @returns {Promise<boolean>} True if the graph was updated, false otherwise.
 */
async function refreshGraphData() {
    try {
        const githubFiles = await fetchMarkdownMetadata();
        const filesToUpdate = await compareAndIdentifyUpdates(githubFiles);

        if (filesToUpdate.length > 0) {
            const updatedFiles = await fetchAndUpdateFiles(filesToUpdate);
            await buildEdges(updatedFiles);
            console.log('Graph data refreshed successfully.');
            return true;
        } else {
            console.log('No updates needed for graph data.');
            return false;
        }
    } catch (error) {
        console.error('Error refreshing graph data:', error);
        return false;
    }
}

// Set up Express routes
app.use(express.static('public'));

/**
 * Route to get graph data.
 * Sends the current graph data and initiates a background refresh.
 */
app.get('/graph-data', async (req, res) => {
    try {
        const graphData = await loadGraphData();
        res.json(graphData);
        // Start background refresh
        setTimeout(async () => {
            const wasUpdated = await refreshGraphData();
            if (wasUpdated) {
                const updatedData = await loadGraphData();
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(updatedData));
                    }
                });
            }
        }, 0);
    } catch (error) {
        console.error('Error processing graph data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Route to test GitHub API access.
 * Useful for debugging GitHub API issues.
 */
app.get('/test-github-api', async (req, res) => {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`,
            {
                headers: {
                    Authorization: `token ${GITHUB_ACCESS_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error('Error testing GitHub API:', error);
        res.status(500).json({ error: 'Failed to access GitHub API', details: error.message });
    }
});

/**
 * Main function to initialize and start the server.
 */
async function main() {
    try {
        await initialize();
        await initializeHttpsOptions();

        const server = https.createServer(httpsOptions, app);
        
        // Initialize WebSocket server
        wss = new WebSocket.Server({ server });

        wss.on('connection', (ws) => {
            console.log('New WebSocket connection');
            ws.on('message', (message) => {
                console.log('Received:', message);
            });
        });

        server.listen(port, async () => {
            console.log(`HTTPS Server running on https://localhost:${port}`);
            console.log('Starting initial graph data refresh');
            try {
                await refreshGraphData();
                console.log('Initial graph data refresh complete');
            } catch (refreshError) {
                console.error('Error during initial graph data refresh:', refreshError);
            }
        });
    } catch (error) {
        console.error('Error in main function:', error);
        process.exit(1);
    }
}

// Start the application
main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
