# WebXR Graph Visualization of Logseq Knowledge Graphs with RAGFlow Integration

This project visualises privately hosted GitHub Markdown files created by LogSeq and integrates with RAGFlow for question-answering capabilities in a 3D, WebXR-compatible environment.

![Graph Visualization](./optimized-output.gif)


![image](https://github.com/user-attachments/assets/fcbd6eb1-e2a1-4fea-a3df-4303b17e2b48)

![image](https://github.com/user-attachments/assets/873809d5-d8bd-44c3-884c-ce9418e273ef)


## Project Overview

This application transforms a LogSeq personal knowledge base into an interactive 3D graph, viewable in mixed reality. It automatically parses pages from a private GitHub repository, and processes them via perplexity API to update and provide additional citations. These changes are submitted back to the source repo as PRs. It then builds it's own edge linkages between connected nodes, with edges as a function of the bidirectionsl references between any two nodes. Both processed and raw files are analysed, and JSON metadata is generated for both versions, enabling a comparison of graph nodes and edges. This figure is further nuanced by the richness of the citation and web links in the connected nodes. All this is combined into a force-directed 3D graph using WebXR and Three.js. The visual graph can be interrogated via Microsoft graphRAG in a text interface.

Key features include:
- **3D Visualisation** of knowledge graph nodes and edges
- **WebXR Compatibility** for immersive exploration
- **Rust calls to Perplexity AI** for file pre-processing
- **Integration with RAGFlow** for AI-powered question answering
- **Real-Time Updates** via WebSocket for both client and server
- **Mandatory GPU Acceleration** on the server-side for graph computations using WebGPU
- **Optional GPU Acceleration** on the client-side for enhanced performance
- **One-Time File Pre-Processing** for GitHub file updates, comparing processed and raw files

## Architecture

The project consists of a Rust-based server running in a Docker container and a JavaScript client-side application.

### Class Diagram

```mermaid
classDiagram
    class Server {
        +start()
        +initialize()
        +listen(port: u16)
        +setup_websocket()
    }
    class AppState {
        +graph_data: Arc<RwLock<GraphData>>
        +file_cache: Arc<RwLock<HashMap<String, String>>>
    }
    class GraphHandler {
        +get_graph_data(State<AppState>) -> Result<Json<GraphData>>
        +refresh_graph(State<AppState>) -> Result<Json<GraphData>>
    }
    class FileHandler {
        +fetch_and_process_files(State<AppState>) -> Result<Json<Vec<String>>>
    }
    class RAGFlowHandler {
        +send_message(State<AppState>, Json<Message>) -> Result<Json<Response>>
    }
    class GraphService {
        +get_graph_data(AppState) -> Result<GraphData>
        +refresh_graph_data(AppState) -> Result<GraphData>
        +build_edges(AppState) -> Result<Vec<Edge>>
    }
    class FileService {
        +fetch_files_from_github() -> Result<Vec<GithubFile>>
        +compare_and_identify_updates(github_files: Vec<GithubFile>) -> Result<Vec<String>>
        +send_to_perplexity(file: String) -> Result<ProcessedFile>
        +save_file_metadata(metadata: Metadata) -> Result<()>
    }
    class RAGFlowService {
        +create_conversation(user_id: String) -> Result<String>
        +send_message(conversation_id: String, message: String) -> Result<String>
        +get_chat_history(conversation_id: String) -> Result<Vec<Message>>
    }
    class PerplexityService {
        +process_file(file: String) -> Result<ProcessedFile>
    }
    class GraphData {
        +edges: Vec<Edge>
        +nodes: Vec<Node>
    }
    class Metadata {
        +file_name: String
        +last_modified: DateTime<Utc>
        +processed_file: String
        +original_file: String
    }
    class Node {
        +id: String
        +label: String
        +metadata: HashMap<String, String>
    }
    class WebSocketManager {
        +setup_websocket() -> Result<()>
        +broadcast_message(message: String) -> Result<()>
    }
    class GPUCompute {
        +initialize_gpu() -> Result<()>
        +compute_forces() -> Result<()>
        +update_positions() -> Result<()>
    }

    Server --> AppState
    Server --> WebSocketManager
    Server --> GPUCompute
    AppState --> GraphData
    GraphHandler --> GraphService
    FileHandler --> FileService
    RAGFlowHandler --> RAGFlowService
    FileService --> PerplexityService
    FileService --> Metadata
    GraphService --> GraphData
    GraphData --> Node
```

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant WebXRVisualization
    participant GraphDataManager
    participant Server
    participant ServerGraphSimulation
    participant GitHub
    participant PerplexityAPI
    participant RAGFlowIntegration

    activate Server
    Server->>Server: initialize()
    Server->>Server: setup_https_options()
    Server->>Server: initialize_gpu()
    Server->>Server: create HTTPS server & WebSocket server
    Server->>Server: listen on port 8443
    Server->>Server: refresh_graph_data()
    Server->>GitHub: fetch_markdown_metadata()
    GitHub-->>Server: Markdown file metadata
    Server->>Server: compare_and_identify_updates()
    loop for each file to update
        Server->>GitHub: fetch file content
        GitHub-->>Server: file content
        Server->>Server: save file content & metadata
        Server->>PerplexityAPI: send file for processing
        PerplexityAPI-->>Server: processed file
        Server->>Server: store processed file & generated metadata
        Server->>GitHub: Submit file pull request
        Server->>Server: generate edges and nodes from raw & processed files
    end
    Server->>Server: build_edges()
    Server->>Server: load_graph_data()
    Server->>ServerGraphSimulation: initialize(graph_data)
    Server->>ServerGraphSimulation: start_simulation()
    
    activate Client
    Client->>WebXRVisualization: initialize()
    WebXRVisualization->>GraphSimulation: initialize()
    WebXRVisualization->>Interface: initialize()
    WebXRVisualization->>ChatManager: initialize()
    WebXRVisualization->>GraphDataManager: initialize()
    
    GraphDataManager->>Server: WebSocket connection
    Server-->>GraphDataManager: Connection established
    
    Client->>Server: GET /graph-data
    Server-->>Client: graph data (JSON)
    
    GraphDataManager->>Server: { type: 'startSimulation' } (WebSocket)
    
    loop Simulation loop
        ServerGraphSimulation->>ServerGraphSimulation: compute_forces()
        ServerGraphSimulation->>ServerGraphSimulation: update_positions()
        ServerGraphSimulation->>GraphDataManager: { type: 'nodePositions', positions: [...] } (WebSocket)
        GraphDataManager->>GraphSimulation: updateNodePositions(positions)
        GraphSimulation->>WebXRVisualization: updateGraph()
    end
    
    Client->>ChatManager: sendMessage(question)
    ChatManager->>Server: POST /api/chat/message
    Server->>RAGFlowIntegration: send_message(conversation_id, message)
    RAGFlowIntegration-->>Server: response
    Server-->>ChatManager: response
    ChatManager->>WebXRVisualization: updateChatDisplay(response)
    
    Client->>Interface: user input (e.g., SpaceMouse movement)
    Interface->>WebXRVisualization: updateCameraPosition()
    
    Client->>Server: POST /refresh-graph
    Server->>Server: refresh_graph_data()
    Server->>GitHub: fetch_markdown_metadata()
    GitHub-->>Server: Markdown file metadata
    Server->>Server: compare_and_identify_updates()
    loop for each file to update
        Server->>GitHub: fetch file content
        GitHub-->>Server: file content
        Server->>Server: save file content & metadata
        
        Server->>Perplexity: send file for processing
        PerplexityAPI-->>Server: processed file & JSON metadata
        Server->>Server: store processed file & metadata
        Server->>Server: generate edges and nodes from raw & processed files
    end
    Server->>Server: build_edges()
    Server->>Server: load_graph_data()
    Server->>ServerGraphSimulation: update_graph_data(new_graph_data)
    ServerGraphSimulation->>GraphDataManager: { type: 'graphUpdate', data: new_graph_data } (WebSocket)
    GraphDataManager->>GraphSimulation: updateData(new_graph_data)
    GraphSimulation->>WebXRVisualization: updateGraph()
    
    deactivate Client
    deactivate Server
```

## File Structure

### Server-Side (Rust)

- **src/**
  - `main.rs`: Entry point for the Rust server
  - `app_state.rs`: Shared application state
  - `handlers/`
    - `graph_handler.rs`: Handles graph data requests
    - `file_handler.rs`: Manages file operations and GitHub interactions
    - `ragflow_handler.rs`: Handles RAGFlow API interactions
  - `services/`
    - `graph_service.rs`: Core graph processing and management
    - `file_service.rs`: File handling and Perplexity integration
    - `ragflow_service.rs`: RAGFlow conversation management
    - `perplexity_service.rs`: Interaction with Perplexity API
  - `models/`
    - `graph.rs`: Graph data structures
    - `metadata.rs`: File metadata representation
    - `node.rs`: Graph node structure
  - `utils/`
    - `websocket_manager.rs`: Server-side WebSocket management
    - `gpu_compute.rs`: GPU acceleration for server-side computations using WebGPU

### Client-Side (JavaScript)

- **Core**: `public/js/`
  - `index.js`: Entry point for client-side application
  - `app.js`: Main application setup and initialization

- **Components**: `public/js/components/`
  - `webXRVisualization.js`: Manages WebXR rendering and interactions
  - `graphSimulation.js`: Handles graph physics and layout
  - `interface.js`: User input handling
  - `chatManager.js`: Manages chat interface and RAGFlow interactions

- **Services**: `public/js/services/`
  - `graphDataManager.js`: Manages graph data and WebSocket communication
  - `websocketService.js`: Client-side WebSocket handling

- **ThreeJS Components**: `public/js/threeJS/`
  - `threeSetup.js`: Three.js scene initialization
  - `threeGraph.js`: Three.js graph rendering

- **XR Components**: `public/js/xr/`
  - `xrSetup.js`: WebXR session setup
  - `xrInteraction.js`: XR-specific interaction handling

- **Utilities**: `public/js/`
  - `gpuUtils.js`: Optional GPU acceleration for client-side computations

### Tests

Unit tests are provided for all major components, both on the server and client side, under the `tests` directory.

## Installation and Setup

### Prerequisites

- Docker with NVIDIA GPU support
- Rust (for local development)
- Node.js and npm (for local development)
- GitHub Personal Access Token
- RAGFlow API Key
- Perplexity API
- GPU-enabled server for mandatory server-side acceleration
- (Optional) GPU-enabled client device for enhanced performance

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/webxr-graph.git
   cd webxr-graph
   ```

2. Create a `.env` file in the root directory:
   ```
   GITHUB_ACCESS_TOKEN=your_token_here
   GITHUB_OWNER=your_github_username
   GITHUB_REPO=your_repo_name
   GITHUB_DIRECTORY=path/to/markdown/files
   RAGFLOW_API_KEY=your_ragflow_api_key_here
   RAGFLOW_BASE_URL=http://your_ragflow_base_url/v1/
   PERPLEXITY_API=http://your_perplexity_url/
   ```

### Running with Docker

1. Build and run the Docker container:
   ```bash
   docker-compose up --build
   ```

2. Access the application at `https://localhost:8443` using a WebXR-compatible browser.

## Network Considerations


Memory updated
To optimize network efficiency when updating node positions in a force-directed graph over WebSocket, especially for scaling with a large number of nodes and frequent updates, consider the following strategies:

1. Use Delta Updates (Differences)
Instead of sending the absolute position of each node on every update, send only the delta (change) in position. Since each node's position is typically updated incrementally, this reduces the size of the data transmitted.

Reasoning: The delta is smaller and more compressible than absolute positions, especially when the changes are minor.
Implementation: On the server, calculate the change (delta_x, delta_y, delta_z) in position for each node and send those values. The client updates the node position incrementally.
json
Copy code
{
  "node_id": "A",
  "delta": [0.1, -0.2, 0.05]
}
Pros:

Reduces bandwidth usage significantly for small, frequent updates.
Scales well with more nodes, as fewer bytes per node are transmitted.
Cons:

Requires reliable order of messages, so ensure WebSocket guarantees message ordering (which it generally does).
2. Quaternions for Rotation
If the nodes or edges require rotation (e.g., 3D visualizations), using quaternions for orientation updates instead of Euler angles or rotation matrices is optimal.

Reasoning: Quaternions are more compact and efficient for representing rotations. They also avoid gimbal lock, common with Euler angles.
Implementation: Instead of transmitting a full rotation matrix or angles, send a quaternion array ([x, y, z, w]).
json
Copy code
{
  "node_id": "A",
  "quat": [0.707, 0, 0, 0.707]
}
Pros:

Compact representation of orientation.
Efficient to transmit and avoids precision issues over time.
Cons:

Quaternions require client-side handling (which is supported by Three.js).
3. Sparse Updates (Only Update Moving Nodes)
Only send updates for nodes whose positions or rotations have changed significantly (based on a threshold).

Reasoning: Many nodes in a force-directed graph may not move or move very little. Updating only the nodes that change beyond a certain threshold drastically reduces unnecessary transmissions.
Implementation: Server tracks each node’s last known position/rotation and only sends updates if the difference exceeds a certain threshold.
json
Copy code
[
  {
    "node_id": "A",
    "delta": [0.05, -0.03, 0.01]
  },
  {
    "node_id": "B",
    "delta": [0.2, 0.1, 0]
  }
]
Pros:

Prevents overwhelming the network with redundant updates.
Ideal for graphs where only small portions of the graph change frequently.
Cons:

Some latency may occur for certain updates if nodes move slowly but steadily.
4. Compression of Updates
Apply lightweight compression to WebSocket messages (like gzip or Brotli) on the server side before sending, and decompress on the client.

Reasoning: Graph update data is often repetitive and highly compressible.
Implementation: WebSocket servers (and clients) often support built-in compression. Use this feature to reduce bandwidth usage.
Pros:

Significant bandwidth reduction for large graphs.
Compression libraries are standard in WebSocket implementations.
Cons:

Adds minimal CPU overhead on both server and client.
Some browsers and WebSocket libraries may need specific configurations.
5. Batch Updates
Group several node updates into a single WebSocket message rather than sending individual updates for each node. This reduces the number of messages and the overhead of each transmission.

Reasoning: WebSocket messages have a fixed overhead. Sending fewer messages, each containing more data, is more efficient.
Implementation: Accumulate updates over a short period (e.g., 50ms) and send them as a batch.
json
Copy code
{
  "batch": [
    {
      "node_id": "A",
      "delta": [0.1, 0.05, -0.1]
    },
    {
      "node_id": "B",
      "delta": [0, 0.03, 0.2]
    }
  ]
}
Pros:

Reduces WebSocket overhead for each update.
Better performance for large-scale graphs with many nodes updating simultaneously.
Cons:

Adds slight delay between updates (though minimal and configurable).
6. Client-Side Interpolation
Use client-side interpolation to smooth out the position transitions between updates. This reduces the number of server-to-client messages needed for smoother animations.

Reasoning: Sending fewer updates and letting the client interpolate positions results in smoother animations with fewer updates.
Implementation: On each update, send the position and velocity or next expected position of a node. The client can interpolate between the last known position and the next expected one.
json
Copy code
{
  "node_id": "A",
  "target_position": [1.0, 2.0, 1.5],
  "velocity": [0.1, -0.2, 0.05]
}
Pros:

Reduces the frequency of updates needed.
Smoother visual transitions.
Cons:

Requires more client-side computation for interpolation.
Summary of Strategies:
Delta Updates: Send only position changes to minimize data size.
Quaternions for Rotation: More efficient and stable than Euler angles.
Sparse Updates: Only update nodes that moved significantly.
Compression: Use WebSocket compression for large graphs.
Batching: Send updates in batches to reduce overhead.
Client-Side Interpolation: Reduce update frequency by interpolating on the client.
By combining delta updates, quaternions (for orientation), sparse updates, and batching, you can significantly reduce network bandwidth usage and improve scalability as your force-directed graph grows in size. Additionally, client-side interpolation can smooth out any visual delays, further enhancing the user experience while keeping network traffic manageable.


### Local Development


### Running Tests

- For Rust tests:
  ```bash
  cargo test
  ```

- For JavaScript tests:
  ```bash
  npm test
  ```

### Test Coverage

We have implemented comprehensive test coverage for both server-side and client-side components:

#### Server-side Tests (Rust)

- **Unit Tests**: Located in `tests/server/` directory
  - `app_state_test.rs`: Tests for AppState functionality
  - `metadata_test.rs`: Tests for Metadata struct and its methods
  - `file_handler_test.rs`: Tests for file handling operations
  - `graph_service_test.rs`: Tests for graph processing and management
  - `ragflow_service_test.rs`: Tests for RAGFlow service operations

- **Integration Tests**: Located in `tests/server/integration_tests.rs`
  - End-to-end workflow tests
  - Graph update workflow tests

#### Client-side Tests (JavaScript)

- Located in `tests/client/` directory
  - `interface.test.js`: Tests for user interface components
  - `graphService.test.js`: Tests for client-side graph data management
  - `websocketService.test.js`: Tests for WebSocket communication
  - ... (other client-side test files)

Our test suite follows best practices for Test-Driven Development (TDD):
- Extensive use of mocking for API interactions and external services
- Comprehensive coverage of both success and error scenarios
- Integration tests to ensure proper interaction between components

To run all tests and view coverage reports:

```bash
cargo test --all-features --no-fail-fast
npm run test -- --coverage
```


1. Install Rust dependencies:
   ```bash
   cargo build
   ```

2. Install JavaScript dependencies:
   ```bash
   npm install
   ```

3. Run the Rust server:
   ```bash
   cargo run
   ```

4. Serve the frontend (you may need to set up a separate web server)

### Running Tests

- For Rust tests:
  ```bash
  cargo test
  ```

- For JavaScript tests:
  ```bash
  npm test
  ```

## Development Status

The project is under active development. Areas of focus include:
- Optimising WebGPU integration for graph computations
- Finalising the integration with Perplexity for file processing
- Expanding unit tests and improving test coverage
- Enhancing the Rust-based server performance

## Contributing

Contributions are welcome! Please submit issues or pull requests.

## License

This project is licensed under the Creative Commons CC0 license.

---


## Development Status

The project is under active development. Recent improvements include:
- Enhanced test coverage for both server-side and client-side components
- Implementation of integration tests for end-to-end workflows
- Improved mocking for API interactions in PerplexityService and RAGFlowService

Areas of ongoing focus include:
- Optimising WebGPU integration for graph computations
- Finalising the integration with Perplexity for file processing
- Expanding unit tests and improving test coverage
- Enhancing the Rust-based server performance
