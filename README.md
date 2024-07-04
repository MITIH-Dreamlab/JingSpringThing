This is the github from the experiment described in this LinkedIn blog post.
https://www.linkedin.com/feed/update/urn:li:activity:7208897952885436416

The code provided is a good starting point for building an immersive spatial knowledge graph using Blender and Python. Let's go through the main components and discuss their roles:

1. `Vector3` class: This class represents a simple 3D vector and provides methods for calculating the distance between vectors and converting to Blender's built-in `Vector` type. It serves as a basic building block for positioning nodes in 3D space.

2. `Node` class: This class represents a node in your Logseq graph. It contains properties such as `id`, `name`, `position`, `weight`, `velocity`, and `pined`. It also includes methods for calculating distances between nodes, updating motion based on forces, and updating the corresponding Blender object. You can add additional properties specific to Logseq, such as `block_content` and `link_types`, to store relevant data from Logseq.

3. `Edge` class: This class represents a connection between nodes in your Logseq graph. It contains properties such as `start` and `end` nodes, `weight`, and `is_active`. It also includes methods for calculating forces based on Logseq data, calculating potential energy, activating/deactivating the edge, and updating the corresponding Blender object. You can add Logseq-specific properties like `link_type` to store the type of Logseq link.

4. `World` class: This class holds the entire graph data, including nodes, edges, and clusters. It provides methods for normalizing edge weights and calculating total potential and kinetic energy. You can expand this class to include additional global calculations or data management.

5. `Cluster` class: This class represents a cluster of interconnected nodes. It contains a list of nodes and can be expanded to include properties or methods for visualizing clusters in Blender.

6. `ClusterController` class: This class handles cluster detection. It takes a `World` instance and provides methods for checking if a node belongs to a cluster and finding the region of connected nodes.

The code also includes an example of how to use these classes in Blender. It demonstrates creating Blender objects for nodes and edges, performing cluster detection, and running a physics simulation loop to update node positions based on forces.

To further develop this project, you can consider the following steps:

1. Integrate with Logseq: Implement methods to load nodes and edges from Logseq data into your `World` instance. This may involve parsing Logseq's data format and mapping it to your `Node` and `Edge` classes.

2. Enhance physics simulation: Implement more sophisticated physics calculations for forces, motion, and energy. You can consider using libraries like Bullet Physics or writing your own physics engine tailored to your specific requirements.

3. Improve visualization: Customize the appearance of nodes and edges in Blender based on Logseq data. You can assign different colors, sizes, or shapes to nodes and edges based on their properties or link types.

4. Implement user interaction: Add mechanisms for users to interact with the spatial knowledge graph in Blender, such as selecting nodes, filtering edges, or manipulating the graph layout.

5. Optimize performance: As your graph grows in size, you may need to optimize the performance of your code. This can involve using efficient data structures, parallelizing computations, or employing spatial partitioning techniques like octrees or BSP trees.

Remember to iteratively test and refine your code as you add new features and integrate with Logseq. This project has the potential to provide a visually immersive and interactive way to explore and navigate knowledge graphs.


### Diagrams

#### Updated Class Diagram:

```mermaid
classDiagram
    class Vector3 {
        +x: float
        +y: float
        +z: float
        +distance_to(other: Vector3): float
        +to_blender_vector(): bpy.types.Vector
        +__add__(other: Vector3): Vector3
        +__sub__(other: Vector3): Vector3
        +__mul__(scalar: float): Vector3
    }

    class Node {
        +id: int
        +name: str
        +position: Vector3
        +weight: float
        +velocity: Vector3
        +pined: bool
        +cluster_visited: bool
        +clustered: bool
        +blender_object: bpy.types.Object
        +page_content: str
        +is_public: bool
        +distance_to(other: Node): float
        +apply_force(force: Vector3)
        +zero_force()
        +calculate_motion(delta_time: float)
        +update_blender_object()
        +load_data_from_logseq(file_path: str)
    }

    class Edge {
        +start: Node
        +end: Node
        +weight: float
        +is_active: bool
        +blender_object: bpy.types.Object
        +calculate_force()
        +get_potential_energy(): float
        +deactivate()
        +activate()
        +update_blender_object()
    }

    class World {
        +nodes: Dict[int, Node]
        +edges: List[Edge]
        +clusters: List[Cluster]
        +total_potential_energy: float
        +total_kinetic_energy: float
        +normalize_edge_weights()
        +load_logseq_data(graph_dir: str)
        +run_simulation(steps: int, delta_time: float)
    }

    class Cluster {
        +nodes: List[Node]
        +visualize_cluster()
        +calculate_centroid(): Vector3
    }

    class ClusterController {
        -_world: World
        +check_if_cluster(node: Node)
        -_region(node: Node): List[Node]
        +find_clusters()
    }

    Node -- Vector3
    Edge -- Node
    World -- Node
    World -- Edge
    World -- Cluster
    ClusterController -- World
    Cluster -- Node
```

#### Sequence Diagram:

Below is the sequence diagram showing the process flow, including fetching Logseq data from GitHub, parsing nodes, and running the simulation.

```mermaid
sequenceDiagram
    participant User
    participant GitHub
    participant World
    participant Node
    participant Edge
    participant ClusterController
    participant Cluster
    participant Blender

    User->>GitHub: Fetch Logseq graph data
    GitHub->>User: Send graph zip file
    User->>World: Load Logseq data directory
    World->>Node: Create Node from data
    Node->>Node: Load data from markdown
    Node->>World: Check if page is public
    World->>Edge: Create edges from node links

    loop Simulation Steps
        World->>Edge: calculate_force()
        Edge->>Node: apply_force()
        World->>Node: calculate_motion(delta_time)

        ClusterController->>Node: check_if_cluster(node)
        Node->>ClusterController: return cluster status

        Node->>Blender: update_blender_object()
    end

    ClusterController->>World: find_clusters()
    ClusterController->>Cluster: group Nodes into Clusters
    Cluster->>Blender: visualize_cluster()
    Blender->>User: Render Scene
```

### Description
- **Fetching Logseq Graph Data**: The function `fetch_logseq_data_from_github` downloads and extracts Logseq graph data from a GitHub repository.
- **Public Page Detection**: The function `is_page_public` determines if a page is public by examining the content of the markdown file.
- **Vector3 Class**: Represents a 3D vector with basic mathematical operations.
- **Node Class**: Represents a node in the graph, including loading data from a Logseq markdown file and determining if it is public.
- **Edge Class**: Represents an edge in the graph with placeholders for force calculations and potential energy.
- **World Class**: Manages the entire graph data, loads Logseq data, and runs the physics simulation.
- **Cluster and ClusterController Classes**: Manage the detection and representation of clusters within the graph.
- **Blender Integration**: Creates Blender objects for each node and runs a simulation to update their positions.

### Next Steps
1. **Implement Edge Creation Logic**: Extract link information from node markdown content and create `Edge` objects.
2. **Test and Validate**: Continuously test the complete workflow from GitHub data fetching to visualization in Blender.
3. **Explore Omniverse API**: Once basic functionality is working in Blender, integrate Omniverse for advanced features like materials, physics, and collaboration.

```mermaid
classDiagram
    class Vector3 {
        +x: float
        +y: float
        +z: float
        +__add__(other: Vector3): Vector3
        +__sub__(other: Vector3): Vector3
        +__mul__(scalar: float): Vector3
        +length(): float
        +normalize(): Vector3
        +to_tuple(): tuple
    }

    class Node {
        +id: str
        +name: str
        +position: Vector3
        +velocity: Vector3
        +force: Vector3
        +file_size: float
        +link_count: int
        +blender_object: bpy.types.Object 
        +apply_force(force: Vector3)
        +update_position(delta_time: float)
    }

    class Edge {
        +start_node: Node
        +end_node: Node
        +rest_length: float
        +blender_object: bpy.types.Object 
        +apply_spring_force()
        +update_blender_object() 
    }

    class World {
        +nodes: dict[str, Node]
        +edges: list[Edge]
        +add_node(node: Node)
        +add_edge(edge: Edge)
        +load_logseq_data(folder_path: str)
        +run_simulation(steps: int, delta_time: float)
        +create_blender_objects()
    }

    Node -- Vector3
    Edge -- Node
    World -- Node
    World -- Edge
```

```mermaid
sequenceDiagram
    participant User
    participant FileLoader
    participant World
    participant Node
    participant Edge
    participant Blender

    User->>FileLoader: Load Logseq Markdown data
    FileLoader->>World: Data (nodes, edges, properties)
    loop for each Node in data
        World->>Node: Create Node instance
    end
    loop for each Edge in data
        World->>Edge: Create Edge instance 
    end
    World->>Blender: Create Blender objects for nodes and edges
    loop for each simulation step
        World->>Edge: Apply spring forces
        Edge->>Node: Apply force to connected nodes
        World->>Node: Update node positions
        World->>Blender: Update Blender scene
    end
```

File Structure: Organize your Python code into multiple files: vector3.py, node.py, edge.py, world.py, file_loader.py (or similar names).
Mapping C# Components to Python Functions:
VSCode.cs:
SyncSolution(), UpdateSolution(): These functionalities are likely not needed in Blender as you'll interact directly with the scene.
CallVSCode(): Replace this with Blender-specific scene update functions.
ScrubSolutionContent(), ScrubProjectContent(), ScrubFile(): These are likely not needed in Python.
VSCodePreferencesItem(): Replace with a Blender UI panel if you need custom settings.
OnOpenedAsset(): Not directly applicable, but you might have similar logic for interacting with nodes in Blender.
CheckForUpdate(), InstallUnityDebugger(): Not needed in Python.
OnPlaymodeStateChanged(), OnScriptReload(): Blender has different event mechanisms for scene updates.
WriteWorkspaceSettings(): Not needed in Python.
World.cs:
NormalizeEdgeWeights(): Port this logic to the World class in Python.
CenterCamera(): Implement using Blender's camera API.
Event handling will need adaptation to Blender's mechanisms.
Node.cs, Edge.cs, Spring.cs, Cluster.cs, ClusterController.cs:
Create equivalent classes in Python with similar functionalities.
Adapt force calculations and spring behavior to work with Blender's physics.
ThreadDistributer.cs, Parsers, VRActionResponder.cs:
Port ThreadDistributer if you need multithreading in Python.
Implement parsing logic for Logseq Markdown files in Python.
Adapt interaction code to use Omniverse's VR input framework.
