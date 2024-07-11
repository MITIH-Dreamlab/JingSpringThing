// Required Node.js modules
const express = require('express');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Constants for file paths and GitHub configurations
const DATA_DIR = '/usr/src/app/data';
const LOCAL_STORAGE_PATH = `${DATA_DIR}/markdown_files`;
const PROCESSED_STORAGE_PATH = `${DATA_DIR}/processed_files`;
const PRISTINE_PATH = path.join(PROCESSED_STORAGE_PATH, 'pristine');
const PROCESSED_PATH = path.join(PROCESSED_STORAGE_PATH, 'processed');
const NODES_JSON_PATH = `${PROCESSED_STORAGE_PATH}/nodes.json`;
const EDGES_JSON_PATH = `${PROCESSED_STORAGE_PATH}/edges.json`;
const GRAPH_DATA_PATH = `${PROCESSED_STORAGE_PATH}/graph-data.json`;

// Express app setup
const app = express();
const port = process.env.PORT || 8443; // Using port 8443 for HTTPS
let httpsOptions;

/**
 * Initializes HTTPS options by reading key and certificate files.
 * This is necessary for running an HTTPS server.
 */
async function initializeHttpsOptions() {
    httpsOptions = {
        key: await fs.readFile('key.pem'),
        cert: await fs.readFile('cert.pem')
    };
}

/**
 * Initializes the necessary directories and JSON files.
 * This function ensures that all required directories exist and that
 * the JSON files for nodes, edges, and graph data are created if they don't exist.
 */
async function initialize() {
    const directories = [PROCESSED_STORAGE_PATH, LOCAL_STORAGE_PATH, PRISTINE_PATH];
    for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true }).catch(err => {
            if (err.code !== 'EEXIST') throw err;
        });
    }

    const jsonFiles = [
        { path: NODES_JSON_PATH, content: { files: [] } },
        { path: EDGES_JSON_PATH, content: { edges: [] } },
        { path: GRAPH_DATA_PATH, content: {} }
    ];

    for (const file of jsonFiles) {
        if (!await fs.access(file.path).catch(() => false)) {
            await fs.writeFile(file.path, JSON.stringify(file.content, null, 2));
        }
    }
}

async function writeDebugFile(filename, content) {
    const debugPath = path.join(DATA_DIR, 'debug');
    try {
        await fs.mkdir(debugPath, { recursive: true });
        await fs.writeFile(path.join(debugPath, filename), JSON.stringify(content, null, 2));
        console.log(`Debug file written: ${filename}`);
    } catch (error) {
        console.error(`Error writing debug file ${filename}:`, error);
    }
}

// Use this function in buildEdges and other relevant places

async function compareAndUpdateFiles(files) {
    const updatedFiles = [];
    for (const file of files) {
        const localPath = path.join(LOCAL_STORAGE_PATH, file.name);
        let needsUpdate = true;

        try {
            const stats = await fs.stat(localPath);
            if (stats.isFile()) {
                const localContent = await fs.readFile(localPath, 'utf8');
                const localHash = computeHash(localContent);
                if (localHash === file.sha) {
                    needsUpdate = false;
                }
            }
        } catch (error) {
            // File doesn't exist locally, needs to be downloaded
        }

        if (needsUpdate) {
            await fs.writeFile(localPath, file.content, 'utf8');
            updatedFiles.push(file);
        }
    }
    return updatedFiles;
}

/**
 * Computes the SHA256 hash of the given data.
 * This is used to check if file contents have changed.
 * @param {string} data - The data to hash.
 * @returns {string} The computed hash.
 */
function computeHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Loads the node data from the JSON file.
 * @returns {Promise<Array>} Array of node data.
 */
async function loadNodeData() {
    try {
        const data = await fs.readFile(NODES_JSON_PATH, 'utf8');
        return JSON.parse(data).files;
    } catch (err) {
        console.error('Error loading nodes data:', err);
        return [];
    }
}

/**
 * Saves the node data to the JSON file.
 * @param {Array} nodes - The node data to save.
 */
async function saveNodeData(nodes) {
    try {
        await fs.writeFile(NODES_JSON_PATH, JSON.stringify({ files: nodes }, null, 2));
        console.log('Node data saved successfully.');
    } catch (err) {
        console.error('Error saving nodes data:', err);
    }
}

/**
 * Fetches Markdown files from the specified GitHub repository.
 * This function uses the GitHub API to retrieve all Markdown files
 * from the specified directory in the repository.
 * @returns {Promise<Array>} Array of objects containing file names and contents.
 */
async function fetchMarkdownFiles() {
    const files = [];
    try {
        console.log(`Fetching contents from: https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(GITHUB_DIRECTORY)}`);
        const response = await axios.get(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(GITHUB_DIRECTORY)}`,
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

        for (const file of markdownFiles) {
            console.log(`Fetching content for file: ${file.name}`);
            try {
                const fileResponse = await axios.get(file.download_url, {
                    headers: { Authorization: `token ${GITHUB_ACCESS_TOKEN}` }
                });
                files.push({ name: file.name, content: fileResponse.data, sha: file.sha });
                console.log(`Content fetched for file: ${file.name}`);
            } catch (fileError) {
                console.error(`Error fetching file ${file.name}:`, fileError.message);
                continue;
            }
        }
        console.log(`Successfully fetched ${files.length} Markdown files`);

        // Compare and update files
        const updatedFiles = await compareAndUpdateFiles(files);
        console.log(`Updated ${updatedFiles.length} files locally`);

        return updatedFiles;
    } catch (error) {
        console.error('Error fetching Markdown files:', error.message);
        return [];
    }
}

/**
 * Extracts references to other nodes from the content.
 * This function looks for both [[wiki-style]] links and node names within hyperlinks.
 * @param {string} content - The content to search for references.
 * @param {string[]} nodeNames - Array of node names to search for.
 * @returns {Object} Object with node names as keys and reference counts as values.
 */
function extractReferences(content, nodeNames) {
    const references = {};
    nodeNames.forEach(node => {
        const regex = new RegExp(`\\[\\[${node}\\]\\]`, 'gi');
        const matches = content.match(regex) || [];
        if (matches.length > 0) {
            references[node] = matches.length;
        }
    });

    // Add weight for node names in hyperlinks
    const hyperlinks = content.match(/\[([^\]]+)\]\(https?:\/\/[^\s]+\)/g) || [];
    for (const hyperlink of hyperlinks) {
        const linkText = hyperlink.match(/\[([^\]]+)\]/)[1];
        for (const nodeName of nodeNames) {
            if (linkText.toLowerCase().includes(nodeName.toLowerCase())) {
                references[nodeName] = (references[nodeName] || 0) + 0.1;
            }
        }
    }

    return references;
}

/**
 * Builds the edges of the graph based on file references.
 * This function processes all Markdown files, extracts references,
 * and creates edges between nodes based on these references.
 * @param {Array} files - Array of file objects containing name and content.
 */
async function buildEdges(files) {
    const nodeData = await loadNodeData();
    const nodeNames = nodeData.map(file => file.name);
    const referencesMap = {};

    console.log(`Initial nodeData: ${JSON.stringify(nodeData)}`);
    await fs.writeFile('./processed_data/debug_initial_nodeData.json', JSON.stringify(nodeData, null, 2));

    for (const source of nodeNames) {
        referencesMap[source] = {};
        for (const target of nodeNames) {
            referencesMap[source][target] = 0;
        }
    }

    console.log(`Processing ${files.length} files`);
    let publicFileCount = 0;

    for (const file of files) {
        const source = file.name.replace('.md', '');
        const content = file.content;

        console.log(`Processing file: ${file.name}`);
        if (!content.includes('public:: true')) {
            console.log(`Skipping file (not marked as public): ${file.name}`);
            continue;
        }
        publicFileCount++;

        const pristineHash = computeHash(content);
        let nodeEntry = nodeData.find(node => node.name === source);

        if (!nodeEntry || nodeEntry.hash !== pristineHash) {
            nodeEntry = {
                name: source,
                hash: pristineHash,
                size: Buffer.byteLength(content, 'utf8'),
                httpsLinksCount: (content.match(/https?:\/\/[^\s]+/g) || []).length
            };

            if (!nodeData.find(node => node.name === source)) {
                nodeData.push(nodeEntry);
            } else {
                const index = nodeData.findIndex(node => node.name === source);
                nodeData[index] = nodeEntry;
            }

            console.log(`Created/Updated node: ${JSON.stringify(nodeEntry)}`);

            // Extract references and calculate weights
            const references = extractReferences(content, nodeNames);
            console.log(`References for ${source}: ${JSON.stringify(references)}`);

            for (const [target, count] of Object.entries(references)) {
                if (target !== source) {
                    referencesMap[source][target] = (referencesMap[source][target] || 0) + count;
                }
            }
        }
    }

    console.log(`Processed ${publicFileCount} public files`);
    await fs.writeFile('./processed_data/debug_nodeData_after_processing.json', JSON.stringify(nodeData, null, 2));
    await fs.writeFile('./processed_data/debug_referencesMap.json', JSON.stringify(referencesMap, null, 2));

    const edges = [];
    nodeNames.forEach(source => {
        nodeNames.forEach(target => {
            if (source !== target) {
                const weight = referencesMap[source][target] + referencesMap[target][source];
                if (weight > 0) {
                    edges.push({
                        source: source,
                        target: target,
                        weight: weight
                    });
                }
            }
        });
    });

    console.log(`Constructed ${edges.length} edges`);
    await fs.writeFile('./processed_data/debug_edges.json', JSON.stringify(edges, null, 2));

    try {
        await saveNodeData(nodeData);
        await fs.writeFile(EDGES_JSON_PATH, JSON.stringify({ edges: edges }, null, 2));
        await fs.writeFile(GRAPH_DATA_PATH, JSON.stringify({ nodes: nodeData, edges: edges }, null, 2));
        console.log('Graph data saved successfully.');
    } catch (err) {
        console.error('Error saving graph data:', err);
    }
}
/**
 * Retrieves the current graph data and initiates a background refresh.
 * This function returns the existing graph data immediately and then
 * starts a process to fetch new data from GitHub and update the graph.
 * @returns {Promise<Object>} The current graph data.
 */
async function getGraphData() {
    let existingData = {};
    try {
        existingData = JSON.parse(await fs.readFile(GRAPH_DATA_PATH, 'utf8'));
    } catch (error) {
        console.log('No existing graph data found. Creating new data.');
    }

    // Start background refresh
    setTimeout(async () => {
        await refreshGraphData();
    }, 0);

    return existingData;
}

/**
 * Refreshes the graph data by fetching new files from GitHub and rebuilding the graph.
 * This function is typically called in the background to update the graph data.
 */
async function refreshGraphData() {
    const files = await fetchMarkdownFiles();
    await buildEdges(files);
}

// Express API Endpoints
app.use(express.static('public'));

/**
 * Endpoint to get the graph data.
 * This endpoint returns the current graph data immediately and
 * initiates a background refresh of the data.
 */
app.get('/graph-data', async (req, res) => {
    try {
        const graphData = await getGraphData();
        res.json(graphData);
        console.log('Graph data sent to client.');
    } catch (error) {
        console.error('Error processing graph data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Endpoint to test GitHub API access.
 * This endpoint is useful for verifying that the GitHub access token is working correctly.
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
        console.log('GitHub API test successful.');
    } catch (error) {
        console.error('Error testing GitHub API:', error.message);
        res.status(500).json({ error: 'Failed to access GitHub API', details: error.message });
    }
});

/**
 * Main function to initialize and start the server.
 * This function sets up the HTTPS server and starts listening for requests.
 */

async function main() {
    try {
        await fs.access(DATA_DIR, fs.constants.W_OK);
        console.log(`Data directory ${DATA_DIR} is writable`);
    } catch (error) {
        console.error(`Error accessing ${DATA_DIR}:`, error);
        process.exit(1);
    }

    await initialize();
    await initializeHttpsOptions();
    https.createServer(httpsOptions, app).listen(port, async () => {
        console.log(`HTTPS Server running on https://localhost:${port}`);
        console.log('HINT: If you\'re running this in Docker, make sure port', port, 'is properly exposed');
        await refreshGraphData(); // Initial data fetch and processing
    });
}

// Start the application
main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1); // Exit with a non-zero exit code
});

