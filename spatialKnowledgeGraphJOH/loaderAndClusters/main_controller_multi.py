import bpy
import json
import os
import numpy as np
import mathutils
import glob
import re
import sys
from typing import Dict, List, Tuple, Optional

# Constants
NODE_BASE_SIZE = 0.05
EDGE_THICKNESS = 0.01
POSITION_SCALE = 10.0
SPRING_CONSTANT = 0.01
DAMPING_FACTOR = 0.5
ENERGY_THRESHOLD = 1e-6

class Vector3:
    """Represents a 3D vector with basic operations."""

    def __init__(self, x: float = 0, y: float = 0, z: float = 0):
        self.x = x / POSITION_SCALE
        self.y = y / POSITION_SCALE
        self.z = z / POSITION_SCALE

    def __add__(self, other: 'Vector3') -> 'Vector3':
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other: 'Vector3') -> 'Vector3':
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, scalar: float) -> 'Vector3':
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)

    def __iadd__(self, other: 'Vector3') -> 'Vector3':
        self.x += other.x
        self.y += other.y
        self.z += other.z
        return self

    def length(self) -> float:
        return np.sqrt(self.x ** 2 + self.y ** 2 + self.z ** 2)

    def to_tuple(self) -> Tuple[float, float, float]:
        return (self.x, self.y, self.z)

    def normalize(self) -> 'Vector3':
        l = self.length()
        return Vector3(self.x / l, self.y / l, self.z / l) if l != 0 else Vector3(0, 0, 0)

class Node:
    """Represents a node in the graph."""

    def __init__(self, id: str, name: str, position: Tuple[float, float, float] = (0, 0, 0),
                 weight: float = 1.0, velocity: Tuple[float, float, float] = (0, 0, 0),
                 pinned: bool = False, block_content: str = '', link_types: List[str] = [],
                 file_size: int = 0):
        self.id = id
        self.name = name
        self.position = Vector3(*position)
        self.weight = weight
        self.velocity = Vector3(*velocity)
        self.pinned = pinned
        self.block_content = block_content
        self.link_types = link_types
        self.file_size = file_size
        self.force = Vector3()
        self.blender_object: Optional[bpy.types.Object] = None
        self.damping = DAMPING_FACTOR

    def to_dict(self) -> Dict:
        """Converts the node to a dictionary for JSON serialization."""
        return {
            'id': self.id,
            'name': self.name,
            'position': self.position.to_tuple(),
            'weight': self.weight,
            'velocity': self.velocity.to_tuple(),
            'pinned': self.pinned,
            'block_content': self.block_content,
            'link_types': self.link_types,
            'file_size': self.file_size
        }

    def apply_force(self, force: Vector3):
        """Applies a force to the node."""
        self.force += force

    def update_position(self, delta_time: float):
        """Updates the node's position based on applied forces and constraints."""
        if self.pinned or np.isclose(self.weight, 0):
            return

        acceleration = self.force * (1.0 / self.weight)
        self.velocity += acceleration * delta_time
        self.velocity *= (1 - self.damping)
        self.position += self.velocity * delta_time
        self.force = Vector3()

        if self.blender_object:
            self.blender_object.location = self.position.to_tuple()

class Edge:
    """Represents an edge connecting two nodes in the graph."""

    def __init__(self, start_node: Node, end_node: Node, weight: float = 1.0,
                 is_active: bool = True, link_type: str = ''):
        self.start_node = start_node
        self.end_node = end_node
        self.weight = weight
        self.is_active = is_active
        self.link_type = link_type
        self.blender_object: Optional[bpy.types.Object] = None

    def to_dict(self) -> Dict:
        """Converts the edge to a dictionary for JSON serialization."""
        return {
            'start_node': self.start_node.id,
            'end_node': self.end_node.id,
            'weight': self.weight,
            'is_active': self.is_active,
            'link_type': self.link_type
        }

    def apply_spring_force(self):
        """Applies spring-like forces between connected nodes."""
        direction = self.end_node.position - self.start_node.position
        distance = direction.length()
        if np.isclose(distance, 0):
            return

        force_magnitude = SPRING_CONSTANT * (distance - self.weight)
        force = direction.normalize() * force_magnitude

        self.start_node.apply_force(force)
        self.end_node.apply_force(force * -1)

    def update_blender_object(self):
        """Updates the visual representation of the edge in Blender."""
        if self.blender_object:
            start_loc = self.start_node.position.to_tuple()
            end_loc = self.end_node.position.to_tuple()

            direction = mathutils.Vector(end_loc) - mathutils.Vector(start_loc)
            distance = direction.length
            direction.normalize()

            start_radius = self.start_node.blender_object.scale[0] / 2
            end_radius = self.end_node.blender_object.scale[0] / 2
            adjusted_start = mathutils.Vector(start_loc) + direction * start_radius
            adjusted_end = mathutils.Vector(end_loc) - direction * end_radius

            adjusted_direction = adjusted_end - adjusted_start
            adjusted_distance = adjusted_direction.length

            quat = adjusted_direction.to_track_quat('Z', 'Y')
            self.blender_object.rotation_mode = 'QUATERNION'
            self.blender_object.rotation_quaternion = quat

            mid_point = (adjusted_start + adjusted_end) / 2
            self.blender_object.location = mid_point

            thickness = EDGE_THICKNESS * (1 + np.log1p(self.weight))
            self.blender_object.scale = (thickness, thickness, adjusted_distance / 2)

class World:
    """Represents the entire graph world."""

    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []

    def add_node(self, node: Node):
        """Adds a node to the world."""
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        """Adds an edge to the world."""
        self.edges.append(edge)

    def load_data(self, nodes_data: List[Dict], edges_data: List[Dict]):
        """Loads node and edge data from JSON dictionaries."""
        for node_data in nodes_data:
            node = Node(**node_data)
            self.add_node(node)

        for edge_data in edges_data:
            start_node = self.nodes[edge_data['start_node']]
            end_node = self.nodes[edge_data['end_node']]
            edge = Edge(start_node, end_node, **edge_data)
            self.add_edge(edge)

    def create_material_for_node(self, link_count: int) -> bpy.types.Material:
        """Creates a Blender material for a node based on its link count."""
        mat = bpy.data.materials.new(name="NodeMaterial")
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links

        nodes.clear()

        output = nodes.new(type='ShaderNodeOutputMaterial')
        diffuse = nodes.new(type='ShaderNodeBsdfDiffuse')

        color = (1.0, 1.0 - min(1.0, link_count / 10.0), 1.0 - min(1.0, link_count / 10.0), 1.0)
        diffuse.inputs['Color'].default_value = color

        links.new(diffuse.outputs['BSDF'], output.inputs['Surface'])

        return mat

    def create_blender_objects(self):
        """Creates Blender objects for all nodes and edges in the world."""
        def create_node_objects(index=0):
            if index < len(self.nodes):
                node = list(self.nodes.values())[index]
                try:
                    radius = NODE_BASE_SIZE * (1 + np.log1p(node.file_size) / 10)
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=node.position.to_tuple())
                    obj = bpy.context.object
                    obj.name = node.name
                    node.blender_object = obj

                    material = self.create_material_for_node(len(node.link_types))
                    obj.data.materials.append(material)

                    print(f"Created node: {node.name} with radius {radius}")
                except Exception as e:
                    print(f"Error creating node object {node.name}: {e}")

                # Schedule the creation of the next node
                bpy.app.timers.register(lambda: create_node_objects(index + 1), first_interval=0.01)
            else:
                # Start creating edge objects after all nodes are created
                create_edge_objects()

        def create_edge_objects(index=0):
            if index < len(self.edges):
                edge = self.edges[index]
                try:
                    bpy.ops.mesh.primitive_cube_add(size=1)
                    obj = bpy.context.object
                    edge.blender_object = obj

                    start_loc = edge.start_node.position.to_tuple()
                    obj.location = start_loc
                    obj.scale = (EDGE_THICKNESS, EDGE_THICKNESS, 1)

                    print(f"Created edge: from {edge.start_node.name} to {edge.end_node.name}")
                except Exception as e:
                    print(f"Error creating edge object: {e}")

                # Schedule the creation of the next edge
                bpy.app.timers.register(lambda: create_edge_objects(index + 1), first_interval=0.01)
            else:
                print("Finished creating all Blender objects")

        # Start creating node objects
        print("Starting to create node objects...")
        create_node_objects()

def parse_markdown_files(folder_path: str) -> Tuple[List[Node], List[Edge]]:
    """Parses Markdown files to create nodes and edges."""
    nodes = []
    edges = []
    node_dict = {}

    for file_path in glob.glob(os.path.join(folder_path, '*.md')):
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
                if not content.strip():
                    continue

                file_name = os.path.basename(file_path)
                node_id = file_name
                node_name = file_name.split('.')[0]
                block_content = content
                link_types = re.findall(r'\[\[([^\]]+)\]\]', content)
                file_size = os.path.getsize(file_path)

                # Initialize node with random position
                position = (np.random.uniform(-10, 10), np.random.uniform(-10, 10), np.random.uniform(-10, 10))
                node = Node(
                    id=node_id,
                    name=node_name,
                    position=position,
                    block_content=block_content,
                    link_types=link_types,
                    file_size=file_size
                )
                nodes.append(node)
                node_dict[node_name] = node

                for link in link_types:
                    if link in node_dict:
                        edges.append(Edge(start_node=node_dict[node_name], end_node=node_dict[link], link_type='link'))
                    else:
                        print(f"Link target '{link}' not found for node '{node_name}'")

        except (IOError, OSError) as e:
            print(f"Error reading file {file_path}: {e}")

    return nodes, edges

def save_to_json(data: List[Dict], file_path: str):
    """Saves data to a JSON file."""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except (IOError, TypeError) as e:
        print(f"Error saving to JSON file: {e}")
        raise

def load_json(file_path: str) -> Optional[Dict]:
    """Loads data from a JSON file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading JSON file {file_path}: {e}")
        return None

def clear_scene():
    """Clears the current Blender scene."""
    try:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()
        print("Scene cleared.")
    except Exception as e:
        print(f"Error clearing the scene: {e}")

def enable_material_shading():
    """Enables material shading in the Blender viewport."""
    try:
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        space.shading.type = 'MATERIAL'
                        break
        print("Material shading enabled.")
    except Exception as e:
        print(f"Error enabling material shading: {e}")

def calculate_total_energy(world: World) -> float:
    """Calculates the total energy of the system."""
    total_energy = 0
    for edge in world.edges:
        direction = edge.end_node.position - edge.start_node.position
        distance = direction.length()
        spring_energy = 0.5 * SPRING_CONSTANT * (distance - edge.weight)**2
        total_energy += spring_energy
    return total_energy

def run_simulation(world: World, max_steps: int, delta_time: float):
    """Runs the physics simulation for the graph."""
    current_step = 0
    prev_energy = float('inf')

    def step_simulation():
        nonlocal current_step, prev_energy
        try:
            current_energy = calculate_total_energy(world)
            energy_change = abs(current_energy - prev_energy)

            if current_step < max_steps and energy_change > ENERGY_THRESHOLD:
                for edge in world.edges:
                    edge.apply_spring_force()

                for node in world.nodes.values():
                    node.update_position(delta_time)

                for edge in world.edges:
                    edge.update_blender_object()

                # Update the viewport
                bpy.context.view_layer.update()

                current_step += 1
                prev_energy = current_energy
                print(f"Simulation step: {current_step}, Energy: {current_energy}")

                # Schedule the next step
                return 0.01  # Run next step after 0.01 seconds
            else:
                print(f"Simulation completed after {current_step} steps.")
                return None  # Stop the timer

        except Exception as e:
            print(f"Error during simulation step {current_step}: {e}")
            return None  # Stop the timer in case of error

    # Start the simulation steps
    print(f"Starting simulation for max {max_steps} steps.")
    bpy.app.timers.register(step_simulation)

def main(use_local: bool, input_path: str, output_path: str):
    """Main function to orchestrate the graph creation and simulation process."""
    clear_scene()
    enable_material_shading()

    world = World()

    if use_local:
        # Load existing JSON files
        nodes_data = load_json(os.path.join(input_path, 'nodes.json'))
        edges_data = load_json(os.path.join(input_path, 'edges.json'))
        
        if nodes_data is None or edges_data is None:
            print("Failed to load JSON data.")
            return
        
        world.load_data(nodes_data, edges_data)
    else:
        # Parse Markdown files and create new JSON
        nodes, edges = parse_markdown_files(input_path)
        for node in nodes:
            world.add_node(node)
        for edge in edges:
            world.add_edge(edge)

        # Save new JSON files
        save_to_json([node.to_dict() for node in world.nodes.values()], os.path.join(output_path, 'new_nodes.json'))
        save_to_json([edge.to_dict() for edge in world.edges], os.path.join(output_path, 'new_edges.json'))

    print(f"Loaded {len(world.nodes)} nodes and {len(world.edges)} edges.")

    # Create Blender objects
    world.create_blender_objects()

    # Run simulation after a delay to ensure objects are created
    max_steps = 1000
    delta_time = 0.1
    bpy.app.timers.register(lambda: run_simulation(world, max_steps, delta_time), first_interval=1.0)

if __name__ == '__main__':
    # Check if script is run from Blender
    if bpy.context.scene is not None:
        # Parse command-line arguments
        argv = sys.argv
        argv = argv[argv.index("--") + 1:]  # get all args after "--"
        
        if len(argv) < 3:
            print("Usage: blender --background --python script.py -- [-local] <input_path> <output_path>")
            sys.exit(1)

        use_local = False
        if argv[0] == '-local':
            use_local = True
            input_path = argv[1]
            output_path = argv[2]
        else:
            input_path = argv[0]
            output_path = argv[1]

        main(use_local, input_path, output_path)
    else:
        print("This script must be run from within Blender.")
