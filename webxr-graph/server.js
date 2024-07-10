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
  const edges = {}; // Use an object to store edge counts

  files.forEach((file) => {
    const { name, content } = file;
    if (!content.includes('public:: true')) {
      return; 
    }

    // Extract ID from the Markdown front matter
    let fileIdMatch = content.match(/---\n(?:.*\n)?id:\s*([\w-]+)(?:\n.*)?---/);
    let fileId = fileIdMatch ? fileIdMatch[1] : name.replace('.md', ''); 

    if (!edges[fileId]) {
      edges[fileId] = {};
    }

    const node = {
      id: fileId, // Use extracted ID
      name: name,
      size: content.length,
      hyperlinks: (content.match(/https?:\/\/[^\s]+/g) || []).length,
    };
    nodes.push(node);

    const links = (content.match(/\[\[(.+?)\]\]/g) || []).map(link => link.slice(2, -2));
    links.forEach((linkText) => {
      let targetFileIdMatch = linkText.match(/---\n(?:.*\n)?id:\s*([\w-]+)(?:\n.*)?---/);
      let targetFileId = targetFileIdMatch ? targetFileIdMatch[1] : linkText.replace('.md', '');
      if (targetFileId) {
        edges[fileId][targetFileId] = (edges[fileId][targetFileId] || 0) + 1;
      }
    });
  });

  // Convert edges object to an array of edges with source, target, and weight
  const edgeArray = [];
  for (const source in edges) {
    for (const target in edges[source]) {
      edgeArray.push({
        source: source,
        target: target,
        weight: edges[source][target],
      });
    }
  }

  return { nodes, edges: edgeArray };
}
// Serve static files from the 'public' directory
app.use(express.static('public'));

// API endpoint to get graph data
app.get('/graph-data', async (req, res) => {
  try {
    const files = await fetchMarkdownFiles();
    const graphData = parseMarkdownFiles(files);

    // Write graphData to a JSON file inside the volume
    const jsonData = JSON.stringify(graphData, null, 2); // Pretty-print JSON
    const filePath = '/usr/src/app/processed_files/graph-data.json'; // Path inside the container

    fs.writeFile(filePath, jsonData, 'utf8', (err) => {
      if (err) {
        console.error('Error writing graph data to file:', err);
      } else {
        console.log('Graph data saved to:', filePath);
      }
    }); 

    res.json(graphData);
  } catch (error) {
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

