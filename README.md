# WebXR Graph Visualization

This project visualizes GitHub Markdown files as a 3D graph using WebXR. It fetches Markdown files from a specified GitHub repository, parses them to create nodes and edges, and then uses Three.js to render this graph in an immersive 3D space.

## Features

- Fetch and parse Markdown files from GitHub
- Generate nodes and edges based on Markdown content
- Render a 3D graph using WebXR and Three.js
- HTTPS setup with self-signed certificate
- Efficiently checks for file changes before downloading

## Getting Started

### Prerequisites

- Docker
- Node.js
- GitHub Personal Access Token

### Setup

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/webxr-graph.git
   cd webxr-graph

