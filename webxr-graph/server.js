const express = require('express');
const https = require('https');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Express app setup
const app = express();
const port = process.env.PORT || 8443; // Using port 8443 for HTTPS

// HTTPS options - Make sure these files exist in your project root
const httpsOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

// GitHub repository information
const GITHUB_OWNER = 'jjohare';
const GITHUB_REPO = 'logseq';
const GITHUB_DIRECTORY = 'mainKnowledgeGraph/pages';
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

/**
 * Fetches Markdown files from the specified GitHub repository
 * @returns {Promise<Array>} Array of file objects containing name and content
 */
async function fetchMarkdownFiles() {
    const files = [];
    try {
        console.log(`Fetching contents from: https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_DIRECTORY}`);
        
        const response = await axios.get(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_DIRECTORY}`,
            {
                headers: { 
                    Authorization: `token ${GITHUB_ACCESS_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            }
        );

        console.log('API Response:', response.status, response.statusText);
        console.log('Files found:', response.data.length);

        const markdownFiles = response.data.filter(file => file.name.endsWith('.md'));
        console.log('Markdown files found:', markdownFiles.length);

        for (const file of markdownFiles) {
            console.log(`Fetching content for file: ${file.name}`);
            try {
                // Use the provided download_url, which should already be properly encoded
                const fileResponse = await axios.get(file.download_url, {
                    headers: { Authorization: `token ${GITHUB_ACCESS_TOKEN}` }
                });
                files.push({ name: file.name, content: fileResponse.data });
                console.log(`Content fetched for file: ${file.name}`);
            } catch (fileError) {
                console.error(`Error fetching file ${file.name}:`, fileError.message);
                // If there's an error with a specific file, continue with the next one
                continue;
            }
        }

        console.log(`Successfully fetched ${files.length} Markdown files`);
    } catch (error) {
        console.error('Error fetching Markdown files:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
    return files;
}

/**
 * Parses Markdown files to create graph data
 * @param {Array} files Array of file objects containing name and content
 * @returns {Object} Object containing nodes and edges for the graph
 */
function parseMarkdownFiles(files) {
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    files.forEach((file, index) => {
        const { name, content } = file;

        // Ensure debug information is printed
        console.log(`Parsing file: ${name}`);
        if (!content.includes('public:: true')) {
            console.log(`Skipping file (not marked as public): ${name}`);
            return; // Skip files not marked as public
        }

        // Extract links from the content
        const links = (content.match(/\[\[(.+?)\]\]/g) || []).map(link => link.slice(2, -2));

        const node = {
            id: index,
            name: name,
            size: content.length,
            hyperlinks: (content.match(/https?:\/\/[^\s]+/g) || []).length,
            links: links
        };

        nodes.push(node);
        nodeMap.set(name, index);
        console.log(`Node created: ${node.name}, Size: ${node.size}, Hyperlinks: ${node.hyperlinks}`);
    });

    // Create edges based on the links
    nodes.forEach((node, sourceIndex) => {
        node.links.forEach(targetName => {
            if (nodeMap.has(targetName)) {
                const targetIndex = nodeMap.get(targetName);
                edges.push({
                    source: sourceIndex,
                    target: targetIndex,
                    weight: 1
                });
                console.log(`Edge created between ${nodes[sourceIndex].name} and ${nodes[targetIndex].name}`);
            }
        });
    });

    console.log(`Total nodes: ${nodes.length}`);
    console.log(`Total edges: ${edges.length}`);
    return { nodes, edges };
}

// Serve static files from the 'public' directory
app.use(express.static('public'));

// API endpoint to get graph data
app.get('/graph-data', async (req, res) => {
    try {
        const files = await fetchMarkdownFiles();
        const graphData = parseMarkdownFiles(files);
        res.json(graphData);
        console.log('Graph data sent to client');
    } catch (error) {
        console.error('Error processing graph data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the HTTPS server
https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`HTTPS Server running on https://localhost:${port}`);
    console.log('HINT: If you\'re running this in Docker, make sure port', port, 'is properly exposed');
});

// HINT: For debugging, you might want to add a route to test GitHub API access
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

