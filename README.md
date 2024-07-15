# WebXR Graph Visualization

This project visualizes GitHub Markdown files as a 3D graph using WebXR. It fetches Markdown files from a specified GitHub repository, parses them to create nodes and edges, and then uses Three.js to render this graph in an immersive 3D space.

## Features

- Fetch and parse Markdown files from GitHub
- Generate nodes and edges based on Markdown content
- Render a 3D graph using WebXR and Three.js
- HTTPS setup with self-signed certificate
- Efficiently checks for file changes before downloading
- Randomize node positions with spacebar
- Color nodes based on hyperlink count

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
Set up Environment Variables: Create a .env file in the root directory and add your GitHub access token:

GITHUB_ACCESS_TOKEN=your_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
GITHUB_DIRECTORY=path/to/markdown/files
Build and Run with Docker:

./start_docker.sh
This script builds the Docker image and runs the container, mapping port 8443 and mounting the processed_files directory.

Access the Application: Open a WebXR-compatible browser and navigate to https://localhost:8443

## Architecture
Class Diagram
'''mermaid
classDiagram
    class Server {
        +fetchMarkdownMetadata()
        +compareAndIdentifyUpdates()
        +fetchAndUpdateFiles()
        +extractReferences()
        +buildEdges()
        +refreshGraphData()
    }
    class GraphSimulation {
        +updateNodeData()
        +updateEdgeData()
        +updateNodePositions()
        +setSimulationParameters()
    }
    class WebXRVisualization {
        +initScene()
        +setupXR()
        +animate()
        +updateGraphObjects()
        +randomizeNodePositions()
    }
    Server --> GraphSimulation : updates
    GraphSimulation --> WebXRVisualization : renders
'''
Sequence Diagram
'''mermaid
sequenceDiagram
    participant Client
    participant Server
    participant GitHub
    participant GraphSimulation
    participant WebXRVisualization

    Client->>Server: Request graph data
    Server->>GitHub: Fetch Markdown metadata
    GitHub-->>Server: Return metadata
    Server->>Server: Compare and identify updates
    Server->>GitHub: Fetch updated files
    GitHub-->>Server: Return file contents
    Server->>Server: Extract references and build edges
    Server->>GraphSimulation: Update graph data
    GraphSimulation->>WebXRVisualization: Render updated graph
    WebXRVisualization-->>Client: Display 3D graph
Key Components
server.js: Handles server-side operations, including GitHub API interactions and graph data processing.
script.js: Manages client-side WebXR visualization and user interactions.
GraphSimulation: Handles the physics simulation for node positioning.
Usage
Use a WebXR-compatible browser to view the 3D graph.
Press the spacebar to randomize node positions.
Nodes are colored based on their hyperlink count, ranging from blue (low) to red (high).
Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

License
This project is licensed under the Creative Commons CC0 license.

