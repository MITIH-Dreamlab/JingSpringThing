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

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

async function initializeHttpsOptions() {
    httpsOptions = {
        key: await fs.readFile('key.pem'),
        cert: await fs.readFile('cert.pem')
    };
}

async function initialize() {
    // Create necessary directories
    await fs.mkdir(PROCESSED_STORAGE_PATH, { recursive: true });
    await fs.mkdir(MARKDOWN_STORAGE_PATH, { recursive: true });

    // Create graph data file if it doesn't exist
    if (!await fs.access(GRAPH_DATA_PATH).catch(() => false)) {
        await fs.writeFile(GRAPH_DATA_PATH, JSON.stringify({ nodes: [], edges: [] }, null, 2));
    }
}

function computeHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function loadGraphData() {
    try {
        const data = await fs.readFile(GRAPH_DATA_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading graph data:', err);
        return { nodes: [], edges: [] };
    }
}

async function saveGraphData(graphData) {
    try {
        await fs.writeFile(GRAPH_DATA_PATH, JSON.stringify(graphData, null, 2));
        console.log('Graph data saved successfully.');
    } catch (err) {
        console.error('Error saving graph data:', err);
    }
}

async function fetchMarkdownFiles() {
    const files = [];
    try {
        const encodedDirectory = encodeURIComponent(GITHUB_DIRECTORY).replace(/%2F/g, '/');
        console.log(`Fetching contents from: https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedDirectory}`);
        
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

        for (const file of markdownFiles) {
            console.log(`Fetching content for file: ${file.name}`);
            try {
                const fileResponse = await axios.get(file.download_url, {
                    headers: { Authorization: `token ${GITHUB_ACCESS_TOKEN}` }
                });
                const content = fileResponse.data;
                files.push({ name: file.name, content: content, sha: file.sha });
                console.log(`Content fetched for file: ${file.name}`);
            } catch (fileError) {
                console.error(`Error fetching file ${file.name}:`, fileError.message);
            }
        }

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

async function compareAndUpdateFiles(files) {
    const updatedFiles = [];
    for (const file of files) {
        if (!file.content.includes('public:: true')) {
            console.log(`Skipping non-public file: ${file.name}`);
            continue;
        }

        const localPath = path.join(MARKDOWN_STORAGE_PATH, decodeURIComponent(file.name));
        let needsUpdate = true;

        try {
            const stats = await fs.stat(localPath);
            if (stats.isFile()) {
                const localMetadata = JSON.parse(await fs.readFile(`${localPath}.meta.json`, 'utf8'));
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

    // Prepare node names for regex
    const regexPatterns = nodeNames.map(name => ({
        name: name.replace('.md', ''),
        regex: new RegExp(`\\b${escapeRegExp(name.replace('.md', ''))}\\b`, 'gi') 
    }));

    for (const { name, regex } of regexPatterns) {
        let match;
        let count = 0;
        while ((match = regex.exec(content)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + name.length;

            // Check if it's part of a web hyperlink
            const surroundingText = content.substring(Math.max(0, matchStart - 50), Math.min(content.length, matchEnd + 50));
            if (surroundingText.includes('](http') || surroundingText.includes('](https')) {
                count += 0.1;
            } else {
                count += 1;
            }
        }

        if (count > 0) {
            references[name] = count;
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

async function getGraphData() {
    return loadGraphData();
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