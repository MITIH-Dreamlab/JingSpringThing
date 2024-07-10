// Required modules
const express = require('express');
const https = require('https');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Express app setup
const app = express();
const port = process.env.PORT || 8443; // Using 8443 as an alternative HTTPS port

// HTTPS options - Make sure these files exist in your project root
const httpsOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

// GitHub repository information
// HINT: Double-check these values match your GitHub repository structure
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
        
        // HINT: This is where we're making the initial API call to GitHub
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

        // Filter for markdown files
        const markdownFiles = response.data.filter(file => file.name.endsWith('.md'));
        console.log('Markdown files found:', markdownFiles.length);

        // Fetch content for each markdown file
        for (const file of markdownFiles) {
            console.log(`Fetching content for file: ${file.name}`);
            const fileResponse = await axios.get(file.download_url, {
                headers: { Authorization: `token ${GITHUB_ACCESS_TOKEN}` }
            });
            files.push({ name: file.name, content: fileResponse.data });
        }

        console.log(`Successfully fetched ${files.length} Markdown files`);
    } catch (error) {
        console.error('Error fetching Markdown files:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        // HINT: If you're seeing errors here, check your GitHub token and repository details
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

        // HINT: Make sure your markdown files contain this tag if you want them to be included
        if (!content.includes('public:: true')) {
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
            }
        });
    });

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

