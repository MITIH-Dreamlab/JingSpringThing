import bpy
import json
import os
import numpy as np
import mathutils
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

            thickness = EDGE_THICKNESS * (1 + math.log10(self.weight))
            self.blender_object.scale = (thickness, thickness, adjusted_distance)

class World:
    """Represents the simulation world containing nodes and edges."""

    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []
        self.spring_constant: float = SPRING_CONSTANT
        self.damping_factor: float = DAMPING_FACTOR
        self.energy_threshold: float = ENERGY_THRESHOLD

    def add_node(self, node: Node):
        """Adds a node to the world."""
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        """Adds an edge to the world."""
        self.edges.append(edge)

    def create_blender_objects(self):
        """Creates Blender objects for all nodes and edges."""

        def create_node_objects():
            for node in self.nodes.values():
                try:
                    bpy.ops.mesh.primitive_uv_sphere_add(
                        radius=NODE_BASE_SIZE,
                        location=node.position.to_tuple()
                    )
                    obj = bpy.context.object
                    node.blender_object = obj
                    obj.name = node.id
                    print(f"Created Blender object for node {node.id}")
                except Exception as e:
                    print(f"Error creating Blender object for node {node.id}: {e}")

        def create_edge_objects():
            for edge in self.edges:
                try:
                    bpy.ops.mesh.primitive_cylinder_add(
                        radius=EDGE_THICKNESS,
                        depth=1.0,
                        location=(0, 0, 0)
                    )
                    obj = bpy.context.object
                    edge.blender_object = obj
                    edge.update_blender_object()
                    obj.name = f"{edge.start_node.id}_{edge.end_node.id}"
                    print(f"Created Blender object for edge from {edge.start_node.id} to {edge.end_node.id}")
                except Exception as e:
                    print(f"Error creating Blender object for edge {edge.start_node.id}-{edge.end_node.id}: {e}")

        create_node_objects()
        create_edge_objects()

def save_to_json(world: World, filepath: str):
    """Saves the world to a JSON file."""
    try:
        data = {
            'nodes': [node.to_dict() for node in world.nodes.values()],
            'edges': [edge.to_dict() for edge in world.edges]
        }
        with open(filepath, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=4)
        print(f"World saved to {filepath}")
    except Exception as e:
        print(f"Error saving world to JSON: {e}")

def load_json(filepath: str) -> World:
    """Loads a world from a JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as file:
            data = json.load(file)
            world = World()
            for node_data in data['nodes']:
                node = Node(**node_data)
                world.add_node(node)
            for edge_data in data['edges']:
                start_node = world.nodes[edge_data['start_node']]
                end_node = world.nodes[edge_data['end_node']]
                edge = Edge(start_node, end_node, **edge_data)
                world.add_edge(edge)
            print(f"World loaded from {filepath}")
            return world
    except Exception as e:
        print(f"Error loading world from JSON: {e}")
        return World()

def clear_scene():
    """Clears all objects in the Blender scene."""
    try:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        print("Scene cleared")
    except Exception as e:
        print(f"Error clearing Blender scene: {e}")

def enable_material_shading():
    """Enables material shading in the Blender viewport."""
    try:
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        space.shading.type = 'MATERIAL'
        print("Material shading enabled")
    except Exception as e:
        print(f"Error enabling material shading: {e}")

def calculate_total_energy(world: World) -> float:
    """Calculates the total kinetic energy in the world."""
    total_energy = 0.0
    for node in world.nodes.values():
        if not node.pinned:
            speed = node.velocity.length()
            total_energy += 0.5 * node.weight * speed ** 2
    return total_energy

def run_simulation(world: World, max_steps: int = 1000, delta_time: float = 0.1):
    """Runs a physics simulation on the world."""
    def step_simulation():
        for edge in world.edges:
            edge.apply_spring_force()
        for node in world.nodes.values():
            node.update_position(delta_time)
        total_energy = calculate_total_energy(world)
        print(f"Total energy: {total_energy}")
        return total_energy

    step = 0
    total_energy = calculate_total_energy(world)
    while step < max_steps and total_energy > world.energy_threshold:
        total_energy = step_simulation()
        step += 1
        print(f"Step {step}, Total energy: {total_energy}")

    for edge in world.edges:
        edge.update_blender_object()

def load_data(nodes_path: str, edges_path: str) -> World:
    """Load nodes and edges from JSON files and create a world."""
    print(f"Loading nodes from {nodes_path}")
    nodes_data = load_json(nodes_path)
    print(f"Loading edges from {edges_path}")
    edges_data = load_json(edges_path)

    world = World()
    for node_data in nodes_data['nodes']:
        node = Node(**node_data)
        world.add_node(node)

    for edge_data in edges_data['edges']:
        start_node = world.nodes[edge_data['start_node']]
        end_node = world.nodes[edge_data['end_node']]
        edge = Edge(start_node, end_node, **edge_data)
        world.add_edge(edge)

    return world

def main():
    current_dir = os.path.dirname(os.path.realpath(__file__))
    nodes_file_path = os.path.join(current_dir, 'nodes.json')
    edges_file_path = os.path.join(current_dir, 'edges.json')

    clear_scene()
    enable_material_shading()

    world = load_data(nodes_file_path, edges_file_path)
    print(f"Loaded {len(world.nodes)} nodes and {len(world.edges)} edges.")

    world.create_blender_objects()
    run_simulation(world)
    save_to_json(world, 'output.json')

if __name__ == '__main__':
    main()
