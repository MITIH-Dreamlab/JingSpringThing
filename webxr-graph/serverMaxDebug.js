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
const GITHUB_OWNER = 'jjohare';
const GITHUB_REPO = 'logseq';
const GITHUB_DIRECTORY = 'mainKnowledgeGraph/pages';
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

// Express app setup
const app = express();
const port = process.env.PORT || 8443; // Using port 8443 for HTTPS
let httpsOptions;

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
 * Initializes the necessary directories and JSON files.
 */
async function initialize() {
    const directories = [DATA_DIR, LOCAL_STORAGE_PATH, PROCESSED_STORAGE_PATH, PRISTINE_PATH, PROCESSED_PATH];
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

/**
 * Computes the SHA256 hash of the given data.
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
 * Compares and updates local files with fetched GitHub files.
 * @param {Array} files - Array of file objects from GitHub.
 * @returns {Promise<Array>} Array of updated file objects.
 */
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
 * Fetches Markdown files from the specified GitHub repository.
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
 * @param {Array} files - Array of file objects containing name and content.
 */
async function buildEdges(files) {
    const nodeData = await loadNodeData();
    const nodeNames = nodeData.map(file => file.name);
    const referencesMap = {};

    console.log(`Initial nodeData: ${JSON.stringify(nodeData)}`);
    await writeDebugFile('debug_initial_nodeData.json', nodeData);

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
    await writeDebugFile('debug_nodeData_after_processing.json', nodeData);
    await writeDebugFile('debug_referencesMap.json', referencesMap);

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
    await writeDebugFile('debug_edges.json', edges);

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
 * Writes a debug file with the given filename and content.
 * @param {string} filename - The name of the debug file.
 * @param {Object} content - The content to write to the file.
 */
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

/**
 * Checks if a directory is accessible and writable.
 * @param {string} dir - The directory path to check.
 * @returns {Promise<boolean>} True if the directory is accessible and writable, false otherwise.
 */
async function checkDirectoryAccess(dir) {
    try {
        await fs.access(dir, fs.constants.W_OK);
        console.log(`Directory ${dir} is writable`);
        return true;
    } catch (error) {
        console.error(`Error accessing ${dir}:`, error);
        return false;
    }
}

/**
 * Creates a directory if it doesn't exist.
 * @param {string} dir - The directory path to create.
 * @returns {Promise<boolean>} True if the directory was created or already exists, false otherwise.
 */
async function createDirectoryIfNotExists(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Directory ${dir} created or already exists`);
        return true;
    } catch (error) {
        console.error(`Error creating directory ${dir}:`, error);
        return false;
    }
}

/**
 * Lists the contents of a directory.
 * @param {string} dir - The directory path to list.
 */
async function listDirectoryContents(dir) {
    try {
        const files = await fs.readdir(dir);
        console.log(`Contents of ${dir}:`, files);
    } catch (error) {
        console.error(`Error listing contents of ${dir}:`, error);
    }
}

/**
 * Writes a test file to a directory and then removes it.
 * @param {string} dir - The directory to write the test file in.
 * @param {string} filename - The name of the test file.
 */
async function writeTestFile(dir, filename) {
    const testPath = path.join(dir, filename);
    try {
        await fs.writeFile(testPath, 'Test content');
        console.log(`Test file written successfully: ${testPath}`);
        await fs.unlink(testPath);
        console.log(`Test file removed successfully: ${testPath}`);
    } catch (error) {
        console.error(`Error with test file operations in ${dir}:`, error);
    }
}

/**
 * Retrieves the current graph data and initiates a background refresh.
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
 */
async function refreshGraphData() {
    const files = await fetchMarkdownFiles();
    await buildEdges(files);
}

// Express API Endpoints
app.use(express.static('public'));

/**
 * Endpoint to get the graph data.
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
 */
async function main() {
    console.log('Starting main function');

    const dirsToCheck = [DATA_DIR, LOCAL_STORAGE_PATH, PROCESSED_STORAGE_PATH, PRISTINE_PATH, PROCESSED_PATH];

    for (const dir of dirsToCheck) {
        if (!await checkDirectoryAccess(dir)) {
            if (!await createDirectoryIfNotExists(dir)) {
                console.error(`Failed to create or access ${dir}. Exiting.`);
                process.exit(1);
            }
        }
        await listDirectoryContents(dir);
        await writeTestFile(dir, 'test.txt');
    }

    try {
        await initialize();
        console.log('Initialization complete');

        await initializeHttpsOptions();
        console.log('HTTPS options initialized');

        https.createServer(httpsOptions, app).listen(port, async () => {
            console.log(`HTTPS Server running on https://localhost:${port}`);
            console.log('HINT: If you\'re running this in Docker, make sure port', port, 'is properly exposed');
            
            console.log('Starting initial graph data refresh');
            try {
                await refreshGraphData(); // Initial data fetch and processing
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

