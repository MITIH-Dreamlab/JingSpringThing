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
const NODES_JSON_PATH = path.join(PROCESSED_STORAGE_PATH, 'nodes.json');
const EDGES_JSON_PATH = path.join(PROCESSED_STORAGE_PATH, 'edges.json');
const GRAPH_DATA_PATH = path.join(PROCESSED_STORAGE_PATH, 'graph-data.json');
const GITHUB_OWNER = 'jjohare';
const GITHUB_REPO = 'logseq';
const GITHUB_DIRECTORY = 'mainKnowledgeGraph/pages';
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

// Express app setup
const app = express();
const port = process.env.PORT || 8443; // Using port 8443 for HTTPS
let httpsOptions;

async function initializeHttpsOptions() {
    httpsOptions = {
        key: await fs.readFile('key.pem'),
        cert: await fs.readFile('cert.pem')
    };
}

async function initialize() {
    await fs.mkdir(PROCESSED_STORAGE_PATH, { recursive: true });
    await fs.mkdir(MARKDOWN_STORAGE_PATH, { recursive: true });

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

function computeHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function loadNodeData() {
    try {
        const data = await fs.readFile(NODES_JSON_PATH, 'utf8');
        return JSON.parse(data).files;
    } catch (err) {
        console.error('Error loading nodes data:', err);
        return [];
    }
}

async function saveNodeData(nodes) {
    try {
        await fs.writeFile(NODES_JSON_PATH, JSON.stringify({ files: nodes }, null, 2));
        console.log('Node data saved successfully.');
    } catch (err) {
        console.error('Error saving nodes data:', err);
    }
}

async function fetchMarkdownFiles() {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(GITHUB_DIRECTORY)}`,
            {
                headers: {
                    Authorization: `token ${GITHUB_ACCESS_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            }
        );

        const markdownFiles = response.data.filter(file => file.name.endsWith('.md'));
        const existingNodes = await loadNodeData();
        const filesToFetch = [];
        const updatedFiles = [];

        for (const file of markdownFiles) {
            const existingNode = existingNodes.find(node => node.name === file.name.replace('.md', ''));
            if (!existingNode || existingNode.sha !== file.sha) {
                filesToFetch.push(file);
            } else {
                updatedFiles.push({
                    name: file.name,
                    sha: file.sha,
                    filePath: existingNode.filePath
                });
            }
        }

        for (const file of filesToFetch) {
            const fileResponse = await axios.get(file.download_url, {
                headers: { Authorization: `token ${GITHUB_ACCESS_TOKEN}` }
            });
            const content = fileResponse.data;
            
            if (content.includes('public:: true')) {
                const filePath = path.join(MARKDOWN_STORAGE_PATH, file.name);
                await fs.writeFile(filePath, content);
                updatedFiles.push({
                    name: file.name,
                    sha: file.sha,
                    filePath: filePath
                });
            }
        }

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
        // Count Logseq style [[links]]
        const logseqRegex = new RegExp(`\\[\\[${node}\\]\\]`, 'gi');
        const logseqMatches = content.match(logseqRegex) || [];
        references[node] = logseqMatches.length;

        // Count hyperlinks
        const hyperlinkRegex = new RegExp(`\\[([^\\]]+)\\]\\(https?:\\/\\/[^\\s]+\\)`, 'g');
        let hyperlinkMatch;
        while ((hyperlinkMatch = hyperlinkRegex.exec(content)) !== null) {
            if (hyperlinkMatch[1].toLowerCase().includes(node.toLowerCase())) {
                references[node] = (references[node] || 0) + 0.1;
            }
        }
    });

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

    // Initialize referencesMap
    for (const source of nodeNames) {
        referencesMap[source] = {};
        for (const target of nodeNames) {
            referencesMap[source][target] = 0;
        }
    }

    // Process files and build referencesMap
    for (const file of files) {
        const source = file.name.replace('.md', '');
        const content = file.content;

        if (!content.includes('public:: true')) {
            continue;
        }

        const references = extractReferences(content, nodeNames);

        for (const [target, weight] of Object.entries(references)) {
            if (target !== source) {
                referencesMap[source][target] += weight;
            }
        }
    }

    // Build edges with bi-directional weights
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

    // Save the updated graph data
    try {
        await saveNodeData(nodeData);
        await fs.writeFile(EDGES_JSON_PATH, JSON.stringify({ edges: edges }, null, 2));
        await fs.writeFile(GRAPH_DATA_PATH, JSON.stringify({ nodes: nodeData, edges: edges }, null, 2));
        console.log('Graph data saved successfully.');
    } catch (err) {
        console.error('Error saving graph data:', err);
    }
}


async function buildEdges(files) {
    const nodeData = await loadNodeData();
    const nodeNames = nodeData.map(file => file.name);
    const edges = [];

    for (const file of files) {
        const source = file.name.replace('.md', '');
        const content = await fs.readFile(file.filePath, 'utf8');

        let nodeEntry = nodeData.find(node => node.name === source);

        if (!nodeEntry || nodeEntry.sha !== file.sha) {
            nodeEntry = {
                name: source,
                sha: file.sha,
                filePath: file.filePath,
                size: Buffer.byteLength(content, 'utf8'),
                httpsLinksCount: (content.match(/https?:\/\/[^\s]+/g) || []).length
            };

            const index = nodeData.findIndex(node => node.name === source);
            if (index === -1) {
                nodeData.push(nodeEntry);
            } else {
                nodeData[index] = nodeEntry;
            }

            const references = extractReferences(content, nodeNames);
            for (const [target, weight] of Object.entries(references)) {
                if (target !== source) {
                    edges.push({ source, target, weight });
                }
            }
        }
    }

    await saveNodeData(nodeData);
    await fs.writeFile(EDGES_JSON_PATH, JSON.stringify({ edges }, null, 2));
    await fs.writeFile(GRAPH_DATA_PATH, JSON.stringify({ nodes: nodeData, edges }, null, 2));
}

async function getGraphData() {
    try {
        return JSON.parse(await fs.readFile(GRAPH_DATA_PATH, 'utf8'));
    } catch (error) {
        console.log('No existing graph data found. Creating new data.');
        return { nodes: [], edges: [] };
    }
}

async function refreshGraphData() {
    const files = await fetchMarkdownFiles();
    await buildEdges(files);
}

app.use(express.static('public'));

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

main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
