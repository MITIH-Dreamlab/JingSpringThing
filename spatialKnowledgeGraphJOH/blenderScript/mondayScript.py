import bpy
import os
import glob
import re
import random
import numpy as np
from mathutils import Vector
from typing import Dict, List, Tuple, Optional
import sys  # Ensure sys is imported

# Constants for the simulation
NODE_BASE_SIZE = 0.1
EDGE_THICKNESS = 0.01  # This might need fine-tuning
POSITION_SCALE = 5.0
SPRING_CONSTANT = 0.5  # Arbitrary value for springs (can be adjusted)
DAMPING_FACTOR = 0.3  # Arbitrary value for damping (can be adjusted)
ENERGY_THRESHOLD = 1e-5  # Threshold for considering the system at equilibrium
MAX_FILE_SIZE = 1000000  # Maximum file size for scaling (1MB)
MIN_NODE_SIZE = 0.05
MAX_NODE_SIZE = 0.2  # Adjusted to ensure collision detection, can be scaled later

def dual_print(message: str):
    """
    Print a message to both the console and Blender's info area.
    """
    print(message)
    sys.stdout.flush()  # Ensure the message is immediately printed to the console

class Vector3:
    """
    Custom 3D vector class that wraps Blender's Vector class.
    """
    def __init__(self, x: float = 0, y: float = 0, z: float = 0):
        self.vec = Vector((x / POSITION_SCALE, y / POSITION_SCALE, z / POSITION_SCALE))

    def __add__(self, other):
        return Vector3(*(self.vec + other.vec))

    def __sub__(self, other):
        return Vector3(*(self.vec - other.vec))

    def __mul__(self, scalar):
        return Vector3(*(self.vec * scalar))

    def length(self):
        return self.vec.length

    def normalize(self):
        return Vector3(*self.vec.normalized())

    def to_tuple(self):
        return tuple(self.vec)

class Node:
    """
    Represents a node in the graph.
    """
    def __init__(self, id: str, name: str, position: Tuple[float, float, float] = (0, 0, 0),
                 weight: float = 1.0, velocity: Tuple[float, float, float] = (0, 0, 0),
                 pinned: bool = False, block_content: str = '', link_types: List[str] = None,
                 file_size: int = 0):
        self.id = id
        self.name = name
        self.position = Vector3(*position)
        self.weight = max(weight, 0.1)  # Ensure weight is never zero
        self.velocity = Vector3(*velocity)
        self.pinned = pinned
        self.block_content = block_content
        self.link_types = link_types or []
        self.file_size = file_size
        self.force = Vector3()
        self.blender_object: Optional[bpy.types.Object] = None
        self.damping = DAMPING_FACTOR
        self.size = self.calculate_size()

    def calculate_size(self):
        """Calculate the size of the node based on its file size."""
        normalized_size = min(self.file_size / MAX_FILE_SIZE, 1)
        return MIN_NODE_SIZE + normalized_size * (MAX_NODE_SIZE - MIN_NODE_SIZE)

    def apply_force(self, force: Vector3):
        """Apply a force to the node."""
        self.force = self.force + force

    def update_position(self, delta_time: float):
        """Update the node's position based on applied forces."""
        if self.pinned:
            return 0
        acceleration = self.force * (1.0 / self.weight)
        self.velocity = self.velocity + acceleration * delta_time
        self.velocity = self.velocity * (1 - self.damping)
        new_position = self.position + self.velocity * delta_time
        movement = (new_position - self.position).length()
        self.position = new_position
        self.force = Vector3()  # Reset the force after applying
        if self.blender_object:
            self.blender_object.location = self.position.to_tuple()
        return movement

class Edge:
    """
    Represents an edge in the graph, connecting two nodes.
    """
    def __init__(self, start_node: Node, end_node: Node, weight: float = 1.0,
                 is_active: bool = True, link_type: str = ''):
        self.start_node = start_node
        self.end_node = end_node
        self.weight = weight
        self.is_active = is_active
        self.link_type = link_type
        self.blender_object: Optional[bpy.types.Object] = None

    def apply_spring_force(self):
        """Apply spring forces to the connected nodes."""
        direction = self.end_node.position - self.start_node.position
        distance = direction.length()
        if distance == 0:
            return 0
        rest_length = self.start_node.size + self.end_node.size
        force_magnitude = SPRING_CONSTANT * (distance - rest_length)
        force = direction.normalize() * force_magnitude
        self.start_node.apply_force(force)
        self.end_node.apply_force(force * -1)
        return abs(force_magnitude)

    def update_blender_object(self):
        """Update the Blender object representing this edge based on node positions."""
        if self.blender_object:
            start_loc = Vector(self.start_node.position.to_tuple())
            end_loc = Vector(self.end_node.position.to_tuple())
            direction = end_loc - start_loc
            length = direction.length
            if length > 0:
                midpoint = start_loc.lerp(end_loc, 0.5)  # Correct the midpoint calculation
                self.blender_object.location = midpoint
                self.blender_object.scale = (EDGE_THICKNESS, EDGE_THICKNESS, length / 2)  
                self.blender_object.rotation_mode = 'QUATERNION'
                self.blender_object.rotation_quaternion = direction.to_track_quat('Z', 'Y')

class World:
    """
    Represents the entire graph world, containing nodes and edges.
    """
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []

    def add_node(self, node: Node):
        """Add a node to the world."""
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        """Add an edge to the world."""
        self.edges.append(edge)

    def randomize_node_positions(self):
        """Randomize the positions of all nodes."""
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
        """Create Blender objects for all nodes and edges in the world."""
        for node in self.nodes.values():
            bpy.ops.mesh.primitive_uv_sphere_add(radius=node.size, location=node.position.to_tuple())
            node.blender_object = bpy.context.active_object
            node.blender_object.name = f"Node_{node.name}"
        
        self.randomize_node_positions()
        
        for edge in self.edges:
            bpy.ops.mesh.primitive_cylinder_add(radius=EDGE_THICKNESS, depth=1)
            edge.blender_object = bpy.context.active_object
            edge.blender_object.name = f"Edge_{edge.start_node.name}_{edge.end_node.name}"
            edge.update_blender_object()

def parse_markdown_files() -> Tuple[List[Node], List[Edge]]:
    """Parse Markdown files to create nodes and edges."""
    nodes = []
    edges = []
    node_dict = {}

    for file_path in glob.glob('*.md'):
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
                if not content.strip():
                    continue

                file_name = os.path.basename(file_path)
                node_id = file_name
                node_name = file_name.split('.')[0]
                link_types = re.findall(r'\[\[([^\]]+)\]\]', content)
                file_size = os.path.getsize(file_path)

                position = (random.uniform(-10, 10), random.uniform(-10, 10), random.uniform(-10, 10))
                node = Node(id=node_id, name=node_name, position=position,
                            block_content=content, link_types=link_types, file_size=file_size)
                nodes.append(node)
                node_dict[node_name] = node

                for link in link_types:
                    if link in node_dict:
                        edges.append(Edge(start_node=node_dict[node_name], end_node=node_dict[link], link_type='link'))
                    else:
                        dual_print(f"Link target '{link}' not found for node '{node_name}'")
        except Exception as e:
            dual_print(f"Error reading file {file_path}: {e}")

    return nodes, edges

def clear_scene():
    """Clear all objects from the current Blender scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    dual_print("Scene cleared.")

def enable_material_shading():
    """Enable material shading in the 3D viewport."""
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    break
    dual_print("Material shading enabled.")

def calculate_total_energy(world: World) -> float:
    """Calculate the total energy of the system."""
    kinetic_energy = sum(0.5 * node.weight * node.velocity.length()**2 for node in world.nodes.values())
    potential_energy = sum(0.5 * SPRING_CONSTANT * (edge.start_node.position - edge.end_node.position).length()**2 for edge in world.edges)
    return kinetic_energy + potential_energy

def run_simulation(world: World, max_steps: int, delta_time: float):
    """Run the physics simulation to layout the graph."""
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
        
        if step % 20 == 0:  # Print more frequently for better debugging
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
    """Main function to orchestrate the entire process."""
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

        max_steps = 1000
        delta_time = 0.05
        num_iterations = 1  # Use only one iteration for now to debug the snapping issue

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

