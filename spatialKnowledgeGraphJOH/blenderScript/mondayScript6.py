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

# Constants for the simulation
NODE_BASE_SIZE = 0.03  # Base size for all nodes
EDGE_THICKNESS = 0.05  # Thickness of the edges (cylinders)
POSITION_SCALE = 10.0 # Scale for node positions in the world
SPRING_CONSTANT = 0.01  # Strength of the spring force between connected nodes
DAMPING_FACTOR = 0.95  # Damping to reduce oscillations, higher value = more damping
ENERGY_THRESHOLD = 1e-4  # Threshold for considering the system at equilibrium
MAX_FILE_SIZE = 1000000  # Maximum file size for scaling node size (1MB)
NODE_SIZE_EXPONENT = 0.5  # Controls how quickly node size grows with file size

def dual_print(message: str):
    """
    Print a message to both the console and Blender's info area.
    """
    print(message)
    sys.stdout.flush()  # Ensure the message is immediately printed to the console

class Vector3:
    """
    Custom 3D vector class to wrap Blender's Vector class.
    Used for node positions, velocities, and forces.
    """
    def __init__(self, x: float = 0, y: float = 0, z: float = 0):
        # Scale the input coordinates
        self.vec = Vector((x / POSITION_SCALE, y / POSITION_SCALE, z / POSITION_SCALE))

    def __add__(self, other):
        return Vector3(*(self.vec + other.vec))

    def __sub__(self, other):
        return Vector3(*(self.vec - other.vec))

    def __mul__(self, scalar):
        return Vector3(*(self.vec * scalar))

    def __neg__(self):
        """Support unary negative operation"""
        return Vector3(*(-self.vec))

    def length(self):
        return self.vec.length

    def normalize(self):
        return Vector3(*self.vec.normalized())

    def to_tuple(self):
        return tuple(self.vec)

class Node:
    """
    Represents a node in the graph, corresponding to a Markdown file.
    """
    def __init__(self, id: str, name: str, position: Tuple[float, float, float] = (0, 0, 0),
                 weight: float = 1.0, velocity: Tuple[float, float, float] = (0, 0, 0),
                 pinned: bool = False, block_content: str = '', link_types: List[str] = None,
                 file_size: int = 0):
        self.id = id  # Unique identifier for the node
        self.name = name  # Name of the node (likely the filename without extension)
        self.position = Vector3(*position)  # Position of the node in 3D space
        self.weight = max(weight, 0.1)  # Mass/weight of the node, can affect physics
        self.velocity = Vector3(*velocity)  # Current velocity of the node
        self.pinned = pinned  # If True, the node is fixed and won't move during simulation
        self.block_content = block_content  # The content of the Markdown file
        self.link_types = link_types or []  # List of links to other nodes
        self.file_size = file_size  # Size of the file, used for scaling node size
        self.force = Vector3()  # Force accumulator for physics calculations
        self.blender_object: Optional[bpy.types.Object] = None  # Reference to the Blender sphere object
        self.damping = DAMPING_FACTOR  # Damping factor for this node, can be individualized
        self.size = self.calculate_size()  # Radius of the node

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
        """
        self.force = self.force + force

    def update_position(self, delta_time: float):
        """
        Update the node's position based on applied forces and velocity.
        Returns the distance moved.
        """
        if self.pinned:
            return 0
        acceleration = self.force * (1.0 / self.weight)
        self.velocity = self.velocity + acceleration * delta_time
        self.velocity = self.velocity * self.damping  # Apply damping directly on velocity
        new_position = self.position + self.velocity * delta_time
        movement = (new_position - self.position).length()
        self.position = new_position
        self.force = Vector3()  # Reset force after applying
        if self.blender_object:
            self.blender_object.location = self.position.to_tuple()
        return movement

class Edge:
    """
    Represents an edge in the graph, connecting two nodes.
    """
    def __init__(self, start_node: Node, end_node: Node, weight: float = 1.0,
                 is_active: bool = True, link_type: str = ''):
        self.start_node = start_node  # The node where the edge starts
        self.end_node = end_node  # The node where the edge ends
        self.weight = weight  # Weight of the edge, can affect physics
        self.is_active = is_active  # Whether the edge is currently active (used for visualization?)
        self.link_type = link_type  # Type of the link (e.g., "link", "embed", etc.)
        self.blender_object: Optional[bpy.types.Object] = None  # Reference to the Blender cylinder object

    def apply_spring_force(self):
        """
        Calculate and apply a spring force between the two connected nodes.
        Returns the magnitude of the applied force.
        """
        direction = self.end_node.position - self.start_node.position  # Vector pointing from start to end
        distance = direction.length()  # Distance between nodes
        if distance == 0:
            return 0
        force_magnitude = SPRING_CONSTANT * distance  # Spring force is proportional to distance
        force = direction.normalize() * force_magnitude  # Apply force along the direction vector
        self.start_node.apply_force(force)
        self.end_node.apply_force(-force)  # Apply opposite force to the other node
        return abs(force_magnitude)

    def update_blender_object(self):
        """
        Update the position, scale, and rotation of the Blender cylinder object
        to match the positions of the connected nodes.
        """
        if self.blender_object:
            start_loc = Vector(self.start_node.position.to_tuple())
            end_loc = Vector(self.end_node.position.to_tuple())
            
            direction = end_loc - start_loc  # Vector pointing from start to end
            length = direction.length  # Distance between nodes
            
            if length > 0:
                midpoint = start_loc.lerp(end_loc, 0.5)  # Calculate midpoint using linear interpolation
                self.blender_object.location = midpoint
                
                # Adjust edge length to account for node sizes
                edge_length = length - (self.start_node.size + self.end_node.size) / 2 
                self.blender_object.scale = (EDGE_THICKNESS, EDGE_THICKNESS, edge_length)
                self.blender_object.rotation_mode = 'QUATERNION'
                self.blender_object.rotation_quaternion = direction.to_track_quat('Z', 'Y')  # Align cylinder

class World:
    """
    Represents the entire graph world, containing all nodes and edges.
    """
    def __init__(self):
        self.nodes: Dict[str, Node] = {}  # Dictionary to store nodes by their IDs
        self.edges: List[Edge] = []  # List to store all edges

    def add_node(self, node: Node):
        """
        Add a new node to the world.
        """
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        """
        Add a new edge to the world.
        """
        self.edges.append(edge)

    def randomize_node_positions(self):
        """
        Give each node a random position within a certain range.
        Useful for initial layout.
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
        for all elements in the world.
        """
        for node in self.nodes.values():
            bpy.ops.mesh.primitive_uv_sphere_add(radius=node.size, location=node.position.to_tuple())
            node.blender_object = bpy.context.active_object
            node.blender_object.name = f"Node_{node.name}"
        
        for edge in self.edges:
            bpy.ops.mesh.primitive_cylinder_add(radius=EDGE_THICKNESS, depth=1)
            edge.blender_object = bpy.context.active_object
            edge.blender_object.name = f"Edge_{edge.start_node.name}_{edge.end_node.name}"
            edge.update_blender_object()

def parse_markdown_files() -> Tuple[List[Node], List[Edge]]:
    """
    Parse Markdown files in the current directory to create nodes and edges.
    Returns a tuple containing lists of nodes and edges.
    """
    nodes = []
    edges = []
    node_dict = {}  # Temporary dictionary to keep track of nodes by name for linking

    for file_path in glob.glob('*.md'):
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
                if not content.strip():  # Skip empty files
                    continue

                file_name = os.path.basename(file_path)
                node_id = file_name  # Use filename as unique ID
                node_name = file_name.split('.')[0]  # Node name without extension
                link_types = re.findall(r'\[\[([^\]]+)\]\]', content)  # Extract links from [[ ]]
                file_size = os.path.getsize(file_path)  # Get file size

                # Assign random position
                position = (random.uniform(-10, 10), random.uniform(-10, 10), random.uniform(-10, 10))
                node = Node(id=node_id, name=node_name, position=position,
                            block_content=content, link_types=link_types, file_size=file_size)
                nodes.append(node)
                node_dict[node_name] = node

                # Create edges for found links
                for link in link_types:
                    if link in node_dict:
                        edges.append(Edge(start_node=node_dict[node_name], end_node=node_dict[link], link_type='link'))
                    else:
                        dual_print(f"Link target '{link}' not found for node '{node_name}'")

        except Exception as e:
            dual_print(f"Error reading file {file_path}: {e}")

    return nodes, edges

def clear_scene():
    """
    Delete all existing objects in the current Blender scene.
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

def main():
    """
    Main function to execute the script.
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

        max_steps = 1000  # Maximum number of simulation steps
        delta_time = 0.05  # Time step for each simulation iteration
        num_iterations = 1  # Number of iterations to run the simulation 

        dual_print("Running the simulation...")
    #    for i in range(num_iterations):
    #        dual_print(f"Iteration {i+1}/{num_iterations}")
    #        run_simulation(world, max_steps, delta_time)
    #        bpy.ops.wm.redraw_timer(type='DRAW_WIN_SWAP', iterations=1) 

        dual_print("Script execution completed successfully.")
        
    except Exception as e:
        dual_print(f"Error in main execution: {str(e)}")
        import traceback
        dual_print(traceback.format_exc())

    finally:
        dual_print("Script execution finished.")

if __name__ == "__main__":
    main()

