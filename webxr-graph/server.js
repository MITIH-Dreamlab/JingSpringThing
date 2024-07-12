// Required modules
const express = require('express');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Constants for file paths and GitHub configurations
const PROCESSED_STORAGE_PATH = '/usr/src/app/data/processed_files';
const MARKDOWN_STORAGE_PATH = path.join(PROCESSED_STORAGE_PATH, 'markdown');
const GRAPH_DATA_PATH = path.join(PROCESSED_STORAGE_PATH, 'graph-data.json');
const GITHUB_OWNER = 'jjohare';
const GITHUB_REPO = 'logseq';
const GITHUB_DIRECTORY = 'mainKnowledgeGraph/pages';
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

// Express app setup
const app = express();
const port = process.env.PORT || 8443; // Using port 8443 for HTTPS
let httpsOptions;

/**
 * Escapes special characters in a string for use in a regular expression.
 * @param {string} string - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Initializes HTTPS options by reading key and certificate files.
 */
async function initializeHttpsOptions() {
    httpsOptions = {
        key: await fs.readFile('key.pem'),
        cert: await fs.readFile('cert.pem')
    };
}

/**
 * Initializes the directory structure and creates necessary files.
 */
async function initialize() {
    // Create necessary directories
    await fs.mkdir(PROCESSED_STORAGE_PATH, { recursive: true });
    await fs.mkdir(MARKDOWN_STORAGE_PATH, { recursive: true });

    // Create graph data file if it doesn't exist
    if (!await fs.access(GRAPH_DATA_PATH).catch(() => false)) {
        await fs.writeFile(GRAPH_DATA_PATH, JSON.stringify({ nodes: [], edges: [] }, null, 2));
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
 * Fetches Markdown files from the GitHub repository.
 * @returns {Promise<Array>} An array of file objects.
 */
async function fetchMarkdownFiles() {
    const files = [];
    try {
        // Encode the GitHub directory path
        const encodedDirectory = encodeURIComponent(GITHUB_DIRECTORY).replace(/%2F/g, '/');
        console.log(`Fetching contents from: https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedDirectory}`);
        
        // Make a request to the GitHub API
        const response = await axios.get(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedDirectory}`,
            {
                headers: {
                    Authorization: `token ${GITHUB_ACCESS_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            }
        );

        console.log('API Response:', response.status, response.statusText);
        const markdownFiles = response.data.filter(file => file.name.endsWith('.md'));
        console.log('Markdown files found:', markdownFiles.length);

        // Fetch content for each Markdown file
        for (const file of markdownFiles) {
            console.log(`Fetching content for file: ${file.name}`);
            try {
                const fileResponse = await axios.get(file.download_url, {
                    headers: { Authorization: `token ${GITHUB_ACCESS_TOKEN}` }
                });
                const content = fileResponse.data;
                console.log(`File: ${file.name}, GitHub SHA: ${file.sha}`);
                files.push({ name: file.name, content: content, sha: file.sha });
                console.log(`Content fetched for file: ${file.name}`);
            } catch (fileError) {
                console.error(`Error fetching file ${file.name}:`, fileError.message);
                continue;
            }
        }

        // Compare and update local files
        const updatedFiles = await compareAndUpdateFiles(files);
        console.log(`Updated ${updatedFiles.length} files locally`);

        return updatedFiles;
    } catch (error) {
        console.error('Error fetching Markdown files:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        return [];
    }
}

/**
 * Compares and updates local files with the fetched files.
 * @param {Array} files - Array of file objects from GitHub.
 * @returns {Promise<Array>} Array of updated file objects.
 */
async function compareAndUpdateFiles(files) {
    const updatedFiles = [];
    for (const file of files) {
        // Skip non-public files
        if (!file.content.includes('public:: true')) {
            console.log(`Skipping non-public file: ${file.name}`);
            continue;
        }

        const localPath = path.join(MARKDOWN_STORAGE_PATH, decodeURIComponent(file.name));
        let needsUpdate = true;

        try {
            const stats = await fs.stat(localPath);
            if (stats.isFile()) {
                const localContent = await fs.readFile(localPath, 'utf8');
                const localMetadata = JSON.parse(await fs.readFile(`${localPath}.meta.json`, 'utf8'));
                console.log(`File: ${file.name}, Local SHA: ${localMetadata.sha}, GitHub SHA: ${file.sha}`);
                if (localMetadata.sha === file.sha) {
                    needsUpdate = false;
                    console.log(`File ${file.name} is up to date.`);
                } else {
                    console.log(`File ${file.name} needs update.`);
                }
            }
        } catch (error) {
            console.log(`File ${file.name} doesn't exist locally or has no metadata, will be downloaded.`);
        }

        if (needsUpdate) {
            await fs.writeFile(localPath, file.content, 'utf8');
            await fs.writeFile(`${localPath}.meta.json`, JSON.stringify({ sha: file.sha }), 'utf8');
            updatedFiles.push({
                name: file.name,
                sha: file.sha,
                filePath: localPath
            });
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
    const lowerContent = content.toLowerCase();

    // Sort node names by length (descending) to prefer longer matches
    const sortedNodeNames = nodeNames.sort((a, b) => b.length - a.length);

    for (const nodeName of sortedNodeNames) {
        const lowerNodeName = nodeName.toLowerCase().replace('.md', '');
        let count = 0;
        let lastIndex = 0;

        while (true) {
            // Search for the node name (case insensitive, without .md)
            const index = lowerContent.indexOf(lowerNodeName, lastIndex);
            if (index === -1) break;

            // Check if it's a whole word (using word boundaries)
            const prevChar = index > 0 ? lowerContent[index - 1] : ' ';
            const nextChar = index + lowerNodeName.length < lowerContent.length ? lowerContent[index + lowerNodeName.length] : ' ';
            const isWholeWord = !/[a-z0-9_]/.test(prevChar) && !/[a-z0-9_]/.test(nextChar);

            if (isWholeWord) {
                // Check if it's already wrapped in [[]] to prevent recursion
                const isWrapped = (
                    index >= 2 && 
                    lowerContent.substring(index - 2, index) === '[[' && 
                    lowerContent.substring(index + lowerNodeName.length, index + lowerNodeName.length + 2) === ']]'
                );

                if (!isWrapped) {
                    // Check if it's part of a web hyperlink
                    const surroundingText = lowerContent.substring(Math.max(0, index - 50), Math.min(lowerContent.length, index + lowerNodeName.length + 50));
                    if (surroundingText.includes('](http') || surroundingText.includes('](https')) {
                        count += 0.1;
                    } else {
                        count += 1;
                    }
                }
            }

            lastIndex = index + lowerNodeName.length;
        }

        if (count > 0) {
            references[nodeName] = count;
        }
    }

    return references;
}

/**
 * Builds the edges of the graph based on file references.
 * @param {Array} files - Array of file objects containing name, sha, and filePath.
 */
async function buildEdges(files) {
    const graphData = await loadGraphData();
    const nodeNames = graphData.nodes.map(node => node.name);
    const edges = [];

    for (const file of files) {
        const source = file.name.replace('.md', '');
        let content;

        try {
            content = await fs.readFile(file.filePath, 'utf8');
        } catch (error) {
            console.error(`Error reading file ${file.filePath}:`, error);
            continue;
        }

        if (!content.includes('public:: true')) {
            console.log(`Skipping non-public file: ${file.name}`);
            continue;
        }

        let nodeIndex = graphData.nodes.findIndex(node => node.name === source);

        if (nodeIndex === -1 || graphData.nodes[nodeIndex].sha !== file.sha) {
            const nodeEntry = {
                name: source,
                sha: file.sha,
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
                    edges.push({ source, target, weight: parseFloat(weight.toFixed(2)) });
                }
            }
        }
    }

    // Combine edges with the same source and target
    const combinedEdges = edges.reduce((acc, edge) => {
        const existingEdge = acc.find(e => e.source === edge.source && e.target === edge.target);
        if (existingEdge) {
            existingEdge.weight += edge.weight;
        } else {
            acc.push(edge);
        }
        return acc;
    }, []);

    // Round weights to 2 decimal places
    combinedEdges.forEach(edge => {
        edge.weight = parseFloat(edge.weight.toFixed(2));
    });

    graphData.edges = combinedEdges;

    await saveGraphData(graphData);
}

/**
 * Retrieves the current graph data.
 * @returns {Promise<Object>} The current graph data.
 */
async function getGraphData() {
    return loadGraphData();
}

/**
 * Refreshes the graph data by fetching new files and rebuilding edges.
 */
async function refreshGraphData() {
    const files = await fetchMarkdownFiles();
    await buildEdges(files);
}

// Set up Express routes
app.use(express.static('public'));

/**
 * Route to get graph data.
 * Sends the current graph data and initiates a background refresh.
 */
app.get('/graph-data', async (req, res) => {
    try {
        const graphData = await getGraphData();
        res.json(graphData);
        // Start background refresh
        setTimeout(async () => {
            await refreshGraphData();
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
        console.error('Error testing GitHub API:', error.message);
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

        https.createServer(httpsOptions, app).listen(port, async () => {
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