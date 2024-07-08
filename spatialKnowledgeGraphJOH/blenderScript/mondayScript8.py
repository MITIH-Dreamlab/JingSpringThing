import bpy
import os
import glob
import re
import random
import numpy as np
from mathutils import Vector
from typing import Dict, List, Tuple, Optional
import sys
import math

# -----------------------------------------------------------------------------
# Constants for Configuration
# -----------------------------------------------------------------------------

NODE_BASE_SIZE = 0.03  # Base size (radius) for all nodes
EDGE_THICKNESS = 0.05  # Thickness of the edges (cylinders)
POSITION_SCALE = 10.0  # Scale factor for node positions in the 3D world
SPRING_CONSTANT = 0.01  # Strength of the spring force 
DAMPING_FACTOR = 0.95  # Damping to reduce oscillations, higher value = more damping 
ENERGY_THRESHOLD = 1e-4  # Threshold for considering the system at equilibrium
MAX_FILE_SIZE = 1000000  # Maximum file size for scaling node size (1MB)
NODE_SIZE_EXPONENT = 0.5  # Controls how quickly node size grows with file size
MAX_HYPERLINK_COUNT = 20  # Maximum expected number of hyperlinks in a node (adjust as needed)
MAX_EDGE_WEIGHT = 10  # Maximum expected edge weight (adjust as needed)


# -----------------------------------------------------------------------------
# Utility Functions
# -----------------------------------------------------------------------------

def dual_print(message: str):
    """
    Print a message to both the console and Blender's info area.
    Useful for debugging and progress monitoring.
    """
    print(message)
    sys.stdout.flush()  # Ensure the message is immediately printed to the console

# -----------------------------------------------------------------------------
# Vector3 Class: Representing 3D Vectors
# -----------------------------------------------------------------------------

class Vector3:
    """
    Custom 3D vector class to wrap Blender's Vector class.
    Used for representing node positions, velocities, and forces.
    Provides basic vector operations: 
      - Addition, subtraction
      - Scalar multiplication 
      - Normalization (making a vector unit length)
      - Conversion to tuples (for Blender compatibility)
    """
    def __init__(self, x: float = 0, y: float = 0, z: float = 0):
        # Scale the input coordinates by the POSITION_SCALE factor
        self.vec = Vector((x / POSITION_SCALE, y / POSITION_SCALE, z / POSITION_SCALE))

    def __add__(self, other):
        return Vector3(*(self.vec + other.vec))

    def __sub__(self, other):
        return Vector3(*(self.vec - other.vec))

    def __mul__(self, scalar):
        return Vector3(*(self.vec * scalar))

    def __neg__(self):
        """Support unary negative operation (e.g., -vector)"""
        return Vector3(*(-self.vec))

    def length(self):
        return self.vec.length

    def normalize(self):
        return Vector3(*self.vec.normalized())

    def to_tuple(self):
        return tuple(self.vec)

# -----------------------------------------------------------------------------
# Node Class: Representing Nodes in the Graph
# -----------------------------------------------------------------------------

class Node:
    """
    Represents a node in the knowledge graph, corresponding to a Markdown file.
    Attributes:
      - id: Unique identifier (e.g., filename)
      - name: Node name (e.g., filename without extension)
      - position: Position in 3D space (Vector3)
      - weight: Mass/weight, affects physics (should be non-zero)
      - velocity: Current velocity (Vector3)
      - pinned: If True, the node is fixed in place
      - block_content: Content of the Markdown file
      - link_types: List of links to other nodes 
      - file_size: Size of the file, used for scaling node size
      - force: Force accumulator for physics calculations (Vector3)
      - blender_object: Reference to the Blender sphere object
      - damping: Damping factor, can be individualized per node
      - size: Radius of the node sphere
      - hyperlink_count: Number of web hyperlinks in the node
    Methods:
      - calculate_size: Determine node size based on file size.
      - apply_force: Add a force to the node's accumulated force.
      - update_position: Update position based on forces and velocity.
    """
    def __init__(self, id: str, name: str, position: Tuple[float, float, float] = (0, 0, 0),
                 weight: float = 1.0, velocity: Tuple[float, float, float] = (0, 0, 0),
                 pinned: bool = False, block_content: str = '', link_types: List[str] = None,
                 file_size: int = 0):
        self.id = id  # Unique identifier for the node (e.g., filename)
        self.name = name  # Name of the node (e.g., filename without extension)
        self.position = Vector3(*position)  # Position in 3D space
        self.weight = max(weight, 0.1)  # Mass/weight, affects physics (should be non-zero)
        self.velocity = Vector3(*velocity)  # Current velocity
        self.pinned = pinned  # If True, the node is fixed in place
        self.block_content = block_content  # Content of the Markdown file
        self.link_types = link_types or []  # List of links to other nodes
        self.file_size = file_size  # Size of the file, used for scaling node size
        self.force = Vector3()  # Force accumulator for physics calculations
        self.blender_object: Optional[bpy.types.Object] = None  # Reference to the Blender sphere object
        self.damping = DAMPING_FACTOR  # Damping factor, can be individualized per node
        self.size = self.calculate_size()  # Radius of the node sphere
        self.hyperlink_count = 0  # Number of web hyperlinks in the node

    def calculate_size(self):
        """
        Calculate the size (radius) of the node based on its file size.
        Uses an exponential function for non-linear scaling. 
        """
        normalized_size = self.file_size / MAX_FILE_SIZE
        return NODE_BASE_SIZE * math.exp(NODE_SIZE_EXPONENT * normalized_size)

    def apply_force(self, force: Vector3):
        """
        Add a force vector to the node's accumulated force.
        Forces are accumulated and applied during the physics update step.
        """
        self.force = self.force + force

    def update_position(self, delta_time: float):
        """
        Update the node's position based on applied forces and velocity.
        Applies damping to the velocity to reduce oscillations.
        Returns the distance the node has moved.
        """
        if self.pinned:
            return 0
        acceleration = self.force * (1.0 / self.weight)
        self.velocity = self.velocity + acceleration * delta_time
        self.velocity = self.velocity * self.damping 
        new_position = self.position + self.velocity * delta_time
        movement = (new_position - self.position).length()
        self.position = new_position
        self.force = Vector3()  # Reset force after applying 
        if self.blender_object:
            self.blender_object.location = self.position.to_tuple()
        return movement


# -----------------------------------------------------------------------------
# Edge Class: Representing Edges (Connections) in the Graph
# -----------------------------------------------------------------------------

class Edge:
    """
    Represents an edge in the graph, connecting two nodes.
    Attributes:
      - start_node: The node where the edge begins
      - end_node: The node where the edge ends
      - weight: Weight of the edge, affects physics and visuals
      - is_active: Whether the edge is currently active 
      - link_type: Type of the link (e.g., "link")
      - blender_object: Reference to the Blender cylinder object
      - force: The spring force currently acting on the edge (Vector3)
    Methods:
      - apply_spring_force: Calculate and apply spring force between nodes.
      - update_blender_object: Update the cylinder's position and orientation in Blender.
    """
    def __init__(self, start_node: Node, end_node: Node, weight: float = 1.0,
                 is_active: bool = True, link_type: str = ''):
        self.start_node = start_node  # The node where the edge begins
        self.end_node = end_node  # The node where the edge ends
        self.weight = weight  # Weight of the edge, can affect physics and visuals
        self.is_active = is_active  # Whether the edge is currently active 
        self.link_type = link_type  # Type of the link (e.g., "link")
        self.blender_object: Optional[bpy.types.Object] = None  # Reference to the Blender cylinder
        self.force = Vector3() # The spring force acting on the edge

    def apply_spring_force(self):
        """
        Calculate and apply a spring force between the two connected nodes.
        The force is proportional to the distance between the nodes.
        Returns the magnitude of the applied force.
        """
        direction = self.end_node.position - self.start_node.position  
        distance = direction.length() 
        if distance == 0:
            return 0
        force_magnitude = SPRING_CONSTANT * self.weight * (distance - self.rest_length) 
        force = direction.normalize() * force_magnitude  
        self.force = force  # Store the calculated force in the edge
        self.start_node.apply_force(force)
        self.end_node.apply_force(-force)  
        return abs(force_magnitude)

    def update_blender_object(self):
        """
        Update the position, scale, and rotation of the Blender cylinder object
        to visually connect the centers of the two nodes it represents.
        """
        if self.blender_object:
            start_loc = Vector(self.start_node.position.to_tuple()) 
            end_loc = Vector(self.end_node.position.to_tuple())

            direction = end_loc - start_loc  
            length = direction.length 

            if length > 0:
                midpoint = start_loc.lerp(end_loc, 0.5)  # Linear interpolation for midpoint
                self.blender_object.location = midpoint

                # Account for node sizes when calculating edge length
                edge_length = length - (self.start_node.size + self.end_node.size) / 2 
                self.blender_object.scale = (EDGE_THICKNESS, EDGE_THICKNESS, edge_length)
                self.blender_object.rotation_mode = 'QUATERNION'
                self.blender_object.rotation_quaternion = direction.to_track_quat('Z', 'Y')  # Align cylinder


# -----------------------------------------------------------------------------
# World Class: Managing the Graph
# -----------------------------------------------------------------------------

class World:
    """
    Represents the entire graph world, containing all nodes and edges.
    Attributes:
      - nodes: Dictionary storing nodes by their unique IDs
      - edges: List storing all edges
    Methods:
      - add_node: Add a new node to the world.
      - add_edge: Add a new edge to the world.
      - randomize_node_positions: Randomly position nodes for initial layout.
      - create_blender_objects: Generate Blender objects for nodes and edges.
    """
    def __init__(self):
        self.nodes: Dict[str, Node] = {}  # Store nodes by their unique IDs
        self.edges: List[Edge] = []  # Store all edges

    def add_node(self, node: Node):
        """Add a new node to the world."""
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        """Add a new edge to the world."""
        self.edges.append(edge)

    def randomize_node_positions(self):
        """
        Assign random positions to all nodes within a specific range. 
        Used to initialize the graph layout before applying physics.
        """
        for node in self.nodes.values():
            new_position = Vector3(
                random.uniform(-10, 10),
                random.uniform(-10, 10),
                random.uniform(-10, 10)
            )
            node.position = new_position
            if node.blender_object:
                node.blender_object.location = new_position.to_tuple()

    def create_blender_objects(self):
        """
        Create Blender objects (spheres for nodes, cylinders for edges)
        for all nodes and edges in the world. 
        Assigns materials to the objects to visualize node size, 
        hyperlink count, and edge weight.
        """
        for node in self.nodes.values():
            bpy.ops.mesh.primitive_uv_sphere_add(radius=node.size, location=node.position.to_tuple())
            node.blender_object = bpy.context.active_object
            node.blender_object.name = f"Node_{node.name}"

            # Assign material based on hyperlink count
            material = create_material_for_node(node.hyperlink_count)
            if node.blender_object.data.materials:
                node.blender_object.data.materials[0] = material
            else:
                node.blender_object.data.materials.append(material)

        for edge in self.edges:
            bpy.ops.mesh.primitive_cylinder_add(radius=EDGE_THICKNESS, depth=1)
            edge.blender_object = bpy.context.active_object
            edge.blender_object.name = f"Edge_{edge.start_node.name}_{edge.end_node.name}"
            edge.update_blender_object()

            # Assign material based on edge weight
            material = create_material_for_edge(edge.weight)
            if edge.blender_object.data.materials:
                edge.blender_object.data.materials[0] = material
            else:
                edge.blender_object.data.materials.append(material)


# -----------------------------------------------------------------------------
# Function for Parsing Markdown Files
# -----------------------------------------------------------------------------

def parse_markdown_files() -> Tuple[List[Node], List[Edge]]:
    """
    Parse Markdown files in the current directory to create nodes and edges.
    Extracts node information (filename, content, links) and creates Node objects.
    Identifies links between nodes and creates Edge objects, preventing duplicates.
    Returns a tuple containing a list of nodes and a list of edges.
    """
    nodes = []
    edges = []
    node_dict = {}  # Temporary dictionary to quickly look up nodes by their name

    for file_path in glob.glob('*.md'):
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
                if not content.strip():  # Skip empty files
                    continue

                file_name = os.path.basename(file_path)  
                node_id = file_name  
                node_name = file_name.split('.')[0] 
                link_types = re.findall(r'\[\[([^\]]+)\]\]', content)  # Find links in [[ ]] format
                file_size = os.path.getsize(file_path) 

                # Count web hyperlinks in the content
                hyperlink_pattern = re.compile(r'https?://[^\s]+')
                hyperlinks = hyperlink_pattern.findall(content)

                # Assign a random initial position for the node
                position = (random.uniform(-10, 10), random.uniform(-10, 10), random.uniform(-10, 10))
                node = Node(
                    id=node_id, 
                    name=node_name, 
                    position=position,
                    block_content=content, 
                    link_types=link_types, 
                    file_size=file_size
                )
                node.hyperlink_count = len(hyperlinks)  # Assign the hyperlink count
                nodes.append(node)
                node_dict[node_name] = node

                # Create edges, avoiding duplicates (corrected condition)
                for link in link_types:
                    if link in node_dict and not any(e.start_node == node_dict[node_name] and e.end_node == node_dict[link] for e in edges):
                        edges.append(Edge(start_node=node_dict[node_name], end_node=node_dict[link], weight=1, link_type='link'))
                    else:
                        dual_print(f"Link target '{link}' not found for node '{node_name}' or edge already exists.")

        except Exception as e:
            dual_print(f"Error reading file {file_path}: {e}")

    return nodes, edges

# -----------------------------------------------------------------------------
# Functions for Scene Setup and Cleanup
# -----------------------------------------------------------------------------

def clear_scene():
    """
    Delete all objects in the current Blender scene.
    """
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    dual_print("Scene cleared.")

def enable_material_shading():
    """
    Enable material shading in the 3D viewport for better visualization.
    """
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    break
    dual_print("Material shading enabled.")

# -----------------------------------------------------------------------------
# Functions for Physics Calculation and Simulation (Currently Commented Out)
# -----------------------------------------------------------------------------

def calculate_total_energy(world: World) -> float:
    """
    Calculate the total energy of the system (kinetic + potential).
    Used to determine when the simulation reaches equilibrium.
    """
    kinetic_energy = sum(0.5 * node.weight * node.velocity.length()**2 for node in world.nodes.values())
    potential_energy = sum(0.5 * SPRING_CONSTANT * (edge.start_node.position - edge.end_node.position).length()**2 for edge in world.edges)
    return kinetic_energy + potential_energy

def run_simulation(world: World, max_steps: int, delta_time: float):
    """
    Run the physics simulation for a given number of steps.
    Applies forces from edges to nodes, updates node positions,
    and updates the visualization of edges in Blender.
    Monitors the total energy of the system to detect equilibrium.
    """
    for step in range(max_steps):
        max_force = 0
        max_movement = 0

        for edge in world.edges:
            force = edge.apply_spring_force()
            max_force = max(max_force, force)

        for node in world.nodes.values():
            movement = node.update_position(delta_time)
            max_movement = max(max_movement, movement)

        for edge in world.edges:
            edge.update_blender_object()

        total_energy = calculate_total_energy(world)

        if step % 20 == 0:
            dual_print(f"Step {step}: Energy = {total_energy:.6f}, Max Force = {max_force:.6f}, Max Movement = {max_movement:.6f}")
            bpy.context.view_layer.update()
            for area in bpy.context.screen.areas:
                area.tag_redraw()

        if max_movement < ENERGY_THRESHOLD:
            dual_print(f"Equilibrium reached after {step} steps.")
            break

    dual_print("Simulation complete.")
    bpy.context.view_layer.update()
    for area in bpy.context.screen.areas:
        area.tag_redraw()

# -----------------------------------------------------------------------------
# Functions for Material Creation
# -----------------------------------------------------------------------------

def create_material_for_node(hyperlink_count: int):
    """
    Create a new material for a node with a color based on the number of hyperlinks.
    Uses a color ramp to interpolate between blue (few links) and red (many links).
    """
    mat = bpy.data.materials.new(name=f"NodeMaterial_Links_{hyperlink_count}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    for node in nodes:
        nodes.remove(node)

    output = nodes.new(type='ShaderNodeOutputMaterial')
    diffuse = nodes.new(type='ShaderNodeBsdfDiffuse')
    color_ramp = nodes.new(type='ShaderNodeValToRGB')

    color_ramp.color_ramp.elements[0].color = (0, 0, 1, 1)  # Blue
    color_ramp.color_ramp.elements[1].color = (1, 0, 0, 1)  # Red

    links.new(color_ramp.outputs['Color'], diffuse.inputs['Color'])
    links.new(diffuse.outputs['BSDF'], output.inputs['Surface'])

    normalized_count = hyperlink_count / MAX_HYPERLINK_COUNT
    color_ramp.inputs['Fac'].default_value = normalized_count

    return mat

def create_material_for_edge(weight: float):
    """
    Create a new material with a color based on edge weight.
    """
    mat = bpy.data.materials.new(name=f"EdgeMaterial_{weight}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear default nodes
    for node in nodes:
        nodes.remove(node)

    # Add nodes (example using a simple color ramp)
    output = nodes.new(type='ShaderNodeOutputMaterial')
    diffuse = nodes.new(type='ShaderNodeBsdfDiffuse')
    color_ramp = nodes.new(type='ShaderNodeValToRGB')

    # Set color ramp control points (example: blue to red)
    color_ramp.color_ramp.elements[0].color = (0, 0, 1, 1)  # Blue
    color_ramp.color_ramp.elements[1].color = (1, 0, 0, 1)  # Red

    # Link nodes
    links.new(color_ramp.outputs['Color'], diffuse.inputs['Color'])
    links.new(diffuse.outputs['BSDF'], output.inputs['Surface'])

    # Set color based on weight (interpolate between 0 and 1)
    color_ramp.inputs['Fac'].default_value = weight / MAX_EDGE_WEIGHT

    return mat

# -----------------------------------------------------------------------------
# Main Function: Script Execution
# -----------------------------------------------------------------------------

def main():
    """
    Main function to execute the script.
    Parses Markdown files, creates the graph world, visualizes the graph in Blender,
    and (optionally) runs the physics simulation.
    """
    try:
        dual_print("Parsing Markdown files...")
        nodes, edges = parse_markdown_files()
        dual_print(f"Parsed {len(nodes)} nodes and {len(edges)} edges from Markdown files.")

        dual_print("Clearing the scene...")
        clear_scene()

        dual_print("Building the world...")
        world = World()
        for node in nodes:
            world.add_node(node)
        for edge in edges:
            world.add_edge(edge)

        dual_print(f"Loaded {len(world.nodes)} nodes and {len(world.edges)} edges into the World.")

        dual_print("Creating Blender objects...")
        world.create_blender_objects()

        dual_print("Enabling material shading...")
        enable_material_shading()

        # *** SIMULATION IS CURRENTLY COMMENTED OUT ***
        # max_steps = 1000 
        # delta_time = 0.05  
        # num_iterations = 1  

        # dual_print("Running the simulation...")
        # for i in range(num_iterations):
        #     dual_print(f"Iteration {i+1}/{num_iterations}")
        #     run_simulation(world, max_steps, delta_time)
        #     bpy.ops.wm.redraw_timer(type='DRAW_WIN_SWAP', iterations=1)

        dual_print("Script execution completed successfully.")

    except Exception as e:
        dual_print(f"Error in main execution: {str(e)}")
        import traceback
        dual_print(traceback.format_exc())

    finally:
        dual_print("Script execution finished.")

if __name__ == "__main__":
    main()

