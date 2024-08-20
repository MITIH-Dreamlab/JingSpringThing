// server.js
const express = require('express');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

// Constants for file paths and configurations
const PROCESSED_STORAGE_PATH = '/usr/src/app/data/processed_files';
const MARKDOWN_STORAGE_PATH = path.join(PROCESSED_STORAGE_PATH, 'markdown');
const GRAPH_DATA_PATH = path.join(PROCESSED_STORAGE_PATH, 'graph-data.json');
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_DIRECTORY = process.env.GITHUB_DIRECTORY;
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const RAGFLOW_BASE_URL = process.env.RAGFLOW_BASE_URL;
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY;

// Express app setup
const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(cors());  // Enable CORS for all routes

const port = process.env.PORT || 8443; // Using port 8443 for HTTPS
let httpsOptions;

// WebSocket server
let wss;

// Store the active conversation ID
let activeConversationId = null;

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
        const graphData = JSON.parse(data);
        console.log(`Loaded graph data: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
        return graphData;
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
    const currentFiles = new Set(githubFiles.map(file => file.name));
    
    // Check local files and remove those not present on GitHub
    const localFiles = await fs.readdir(MARKDOWN_STORAGE_PATH);
    for (const localFile of localFiles) {
        if (!currentFiles.has(localFile) && localFile.endsWith('.md')) {
            const localPath = path.join(MARKDOWN_STORAGE_PATH, localFile);
            await fs.unlink(localPath).catch(console.error);
            await fs.unlink(`${localPath}.meta.json`).catch(console.error);
            console.log(`Removed local file: ${localFile}`);
        }
    }

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
            // Use the download_url directly instead of constructing it
            const response = await axios.get(file.download_url, {
                headers: { Authorization: `token ${GITHUB_ACCESS_TOKEN}` }
            });
            const content = response.data;

            if (content.includes('public:: true')) {
                const localPath = path.join(MARKDOWN_STORAGE_PATH, file.name);
                await fs.writeFile(localPath, content, 'utf8');

                // Extract hyperlinks
                const hyperlinks = content.match(/https?:\/\/[^\s)]+/g) || [];

                // Create metadata object with SHA and hyperlinks
                const metadata = {
                    sha: file.sha,
                    hyperlinks: hyperlinks
                };

                // Write metadata to file
                await fs.writeFile(`${localPath}.meta.json`, JSON.stringify(metadata, null, 2), 'utf8');
                updatedFiles.push({ name: file.name, filePath: localPath, content });
                console.log(`Successfully updated file: ${file.name}`);
            } else {
                console.log(`Skipped non-public file: ${file.name}`);
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
    console.log('Extracting references from content');
    console.log('Node names to search for:', nodeNames);
    
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
                console.log(`Hyperlink reference found for ${name}: ${surroundingText}`);
            } else {
                count += 1;
                console.log(`Direct reference found for ${name}: ${surroundingText}`);
            }
        }
        if (count > 0) {
            references[name] = parseFloat(count.toFixed(2));
            console.log(`Total references for ${name}: ${references[name]}`);
        }
    }
    
    console.log('Extracted references:', references);
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
/**
 * Builds the edges of the graph based on file references.
 * @param {Array} updatedFiles - Array of updated file objects.
 * @returns {Promise<void>}
 */
async function buildEdges(updatedFiles) {
    let graphData = await loadGraphData();
    const nodeNames = new Set(graphData.nodes.map(node => node.name));
    
    console.log('Building edges for updated files:', updatedFiles.map(f => f.name));
    console.log('Existing Node Names:', Array.from(nodeNames));

    // If no files were updated, but graph is empty, process all files
    if (updatedFiles.length === 0 && graphData.nodes.length === 0) {
        const allFiles = await fs.readdir(MARKDOWN_STORAGE_PATH);
        for (const fileName of allFiles) {
            if (fileName.endsWith('.md')) {
                const filePath = path.join(MARKDOWN_STORAGE_PATH, fileName);
                const content = await fs.readFile(filePath, 'utf8');
                updatedFiles.push({ name: fileName, filePath, content });
            }
        }
        console.log(`Processing all ${updatedFiles.length} files due to empty graph`);
    }

    for (const file of updatedFiles) {
        const source = decodeURIComponent(file.name).replace('.md', '');
        const content = file.content;
        
        console.log(`Processing file: ${file.name} (decoded: ${source})`);
        
        let nodeEntry = graphData.nodes.find(node => node.name === source);
        if (!nodeEntry) {
            nodeEntry = {
                name: source,
                size: Buffer.byteLength(content, 'utf8'),
                httpsLinksCount: (content.match(/https?:\/\/[^\s]+/g) || []).length
            };
            graphData.nodes.push(nodeEntry);
            nodeNames.add(source);
            console.log(`Added new node: ${source}`);
        } else {
            nodeEntry.size = Buffer.byteLength(content, 'utf8');
            nodeEntry.httpsLinksCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
            console.log(`Updated existing node: ${source}`);
        }
        
        const references = extractReferences(content, Array.from(nodeNames));
        console.log(`References for ${source}:`, references);
        
        for (const [target, weight] of Object.entries(references)) {
            if (target !== source) {
                let edge = graphData.edges.find(e => e.source === source && e.target === target);
                if (edge) {
                    edge.weight = parseFloat((edge.weight + weight).toFixed(2));
                    console.log(`Updated edge weight: ${source} -> ${target}, new weight: ${edge.weight}`);
                } else {
                    graphData.edges.push({ source, target, weight: parseFloat(weight.toFixed(2)) });
                    console.log(`Added new edge: ${source} -> ${target}, weight: ${weight}`);
                }
            }
        }
    }
    
    // Remove edges that reference non-existent nodes
    graphData.edges = graphData.edges.filter(edge => 
        nodeNames.has(edge.source) && nodeNames.has(edge.target)
    );
    
    console.log('Final node count:', graphData.nodes.length);
    console.log('Final edge count:', graphData.edges.length);
    
    await saveGraphData(graphData);
    console.log('Graph data saved successfully');
}




/**
 * Refreshes the graph data by fetching new files and rebuilding edges.
 * @returns {Promise<boolean>} True if the graph was updated, false otherwise.
 */
async function refreshGraphData() {
    try {
        const githubFiles = await fetchMarkdownMetadata();
        console.log(`Fetched ${githubFiles.length} files from GitHub`);
        
        const filesToUpdate = await compareAndIdentifyUpdates(githubFiles);
        console.log(`Identified ${filesToUpdate.length} files to update`);

        if (filesToUpdate.length > 0) {
            const updatedFiles = await fetchAndUpdateFiles(filesToUpdate);
            console.log(`Successfully updated ${updatedFiles.length} files`);
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

/**
 * Creates a new conversation with the RAGFlow server.
 * @param {string} userId - Unique identifier for the user.
 * @returns {Promise<string>} The conversation ID.
 */
async function createConversation(userId) {
    try {
        const response = await axios.get(`${RAGFLOW_BASE_URL}api/new_conversation`, {
            headers: { 'Authorization': `Bearer ${RAGFLOW_API_KEY}` },
            params: { user_id: userId }
        });
        return response.data.data.id;
    } catch (error) {
        console.error('Error creating conversation:', error);
        throw new Error('Failed to create conversation');
    }
}

/**
 * Sends a message to the RAGFlow server and gets the response.
 * @param {string} conversationId - The ID of the active conversation.
 * @param {string} message - The user's message.
 * @returns {Promise<Object>} The response from RAGFlow.
 */
async function sendMessage(conversationId, message) {
    try {
        const response = await axios.post(`${RAGFLOW_BASE_URL}api/completion`, {
            conversation_id: conversationId,
            messages: [{ role: 'user', content: message }],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${RAGFLOW_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error('Failed to send message');
    }
}



// Set up Express routes
app.use(express.static('public'));

// Chat-related routes
// Chat-related routes
app.post('/api/chat/init', async (req, res) => {
    try {
        const userId = req.body.userId || 'default-user';
        activeConversationId = await createConversation(userId);
        res.json({ success: true, conversationId: activeConversationId });
    } catch (error) {
        console.error('Error initializing chat:', error);
        res.status(500).json({ error: 'Failed to initialize chat' });
    }
});

app.post('/api/chat/message', async (req, res) => {
    if (!activeConversationId) {
        return res.status(400).json({ error: 'Chat not initialized' });
    }
    try {
        const response = await sendMessage(activeConversationId, req.body.message);
        res.json(response);
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

// Get chat history
app.get('/api/chat/history/:id', async (req, res) => {
    try {
        const conversationId = req.params.id;
        // Here you would typically fetch the chat history for the given conversation ID
        // For now, we'll just return a dummy history
        const history = [
            { role: 'system', content: 'Chat initialized' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there! How can I help you?' }
        ];
        res.json({ retcode: 0, data: { message: history } });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ retcode: 1, error: 'Failed to fetch chat history' });
    }
});


// Define routes
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

app.post('/api/chat/init', async (req, res) => {
    try {
        const userId = req.body.userId || 'default-user';
        activeConversationId = await createConversation(userId);
        res.json({ success: true, conversationId: activeConversationId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to initialize chat' });
    }
});

app.post('/api/chat/message', async (req, res) => {
    if (!activeConversationId) {
        return res.status(400).json({ error: 'Chat not initialized' });
    }
    try {
        const response = await sendMessage(activeConversationId, req.body.message);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: 'Failed to process message' });
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
                // Handle WebSocket messages if needed
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