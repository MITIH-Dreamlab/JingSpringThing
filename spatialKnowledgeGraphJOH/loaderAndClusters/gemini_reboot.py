import bpy
import json
import os
import numpy as np
import mathutils
import sys
import random
from typing import Dict, List, Tuple, Optional

# Constants for the simulation
NODE_BASE_SIZE = 0.05  # Base radius of the sphere representing a node
EDGE_THICKNESS = 0.01  # Thickness of the cylinder representing an edge
POSITION_SCALE = 10.0  # Scaling factor for node positions in 3D space
SPRING_CONSTANT = 0.01  # Spring constant, influences force between connected nodes
DAMPING_FACTOR = 0.5  # Damping factor for node velocity, simulates friction
ENERGY_THRESHOLD = 1e-6  # Stop simulation when energy change is below this value

print("Script started. Constants defined.")

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

    def __neg__(self) -> 'Vector3':
        return Vector3(-self.x, -self.y, -self.z)

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
        if l != 0:
            return Vector3(self.x / l, self.y / l, self.z / l)
        return Vector3(0, 0, 0)

print("Vector3 class defined.")

class Node:
    """Represents a node in the knowledge graph."""

    def __init__(self, id: str, name: str, weight: float = 1.0, 
                 velocity: Tuple[float, float, float] = (0, 0, 0),
                 pinned: bool = False, block_content: str = '', 
                 link_types: List[str] = None, file_size: int = 0):
        self.id = id
        self.name = name
        self.position = Vector3(random.uniform(-10, 10),
                                random.uniform(-10, 10),
                                random.uniform(-10, 10))
        self.weight = weight
        self.velocity = Vector3(*velocity)
        self.pinned = pinned
        self.block_content = block_content
        self.link_types = link_types or []
        self.file_size = file_size
        self.force = Vector3()
        self.blender_object: Optional[bpy.types.Object] = None
        self.damping = DAMPING_FACTOR
        print(f"Node created: {self.id} at position {self.position.to_tuple()}")

    def to_dict(self) -> Dict:
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
        self.force += force
        print(f"Force applied to node {self.id}: {force.to_tuple()}")

    def update_position(self, delta_time: float):
        if self.pinned or np.isclose(self.weight, 0):
            print(f"Node {self.id} is pinned or has zero weight. Not updating position.")
            return

        acceleration = self.force * (1.0 / self.weight)
        self.velocity += acceleration * delta_time
        self.velocity *= (1 - self.damping)
        movement = self.velocity * delta_time
        self.position += movement

        print(f"Node {self.id} update:")
        print(f"  Force: {self.force.to_tuple()}")
        print(f"  Acceleration: {acceleration.to_tuple()}")
        print(f"  Velocity: {self.velocity.to_tuple()}")
        print(f"  Movement: {movement.to_tuple()}")
        print(f"  New position: {self.position.to_tuple()}")

        self.force = Vector3()

        if self.blender_object:
            self.blender_object.location = self.position.to_tuple()

print("Node class defined.")

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
        print(f"Edge created: {self.start_node.id} -> {self.end_node.id}")

    def to_dict(self) -> Dict:
        return {
            'start_node': self.start_node.id,
            'end_node': self.end_node.id,
            'weight': self.weight,
            'is_active': self.is_active,
            'link_type': self.link_type
        }

    def apply_spring_force(self):
        if not self.is_active:
            print(f"Edge {self.start_node.id} -> {self.end_node.id} is inactive. Skipping force calculation.")
            return

        direction = self.end_node.position - self.start_node.position
        distance = direction.length()

        if np.isclose(distance, 0):
            print(f"Skipping force calculation for edge {self.start_node.id} -> {self.end_node.id} (zero distance)")
            return

        force_magnitude = SPRING_CONSTANT * (distance - self.weight)
        force = direction.normalize() * force_magnitude

        print(f"Edge {self.start_node.id} -> {self.end_node.id}:")
        print(f"  Distance: {distance:.6f}, Force magnitude: {force_magnitude:.6f}")
        print(f"  Force applied to start node: {force.to_tuple()}")
        print(f"  Force applied to end node: {(-force).to_tuple()}")

        self.start_node.apply_force(force)
        self.end_node.apply_force(-force)

    def update_blender_object(self):
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

            print(f"Updated Blender object for edge {self.start_node.id} -> {self.end_node.id}")

print("Edge class defined.")

class World:
    """Represents the entire graph world."""

    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []
        print("World instance created.")

    def add_node(self, node: Node):
        self.nodes[node.id] = node
        print(f"Node {node.id} added to the world.")

    def add_edge(self, edge: Edge):
        self.edges.append(edge)
        print(f"Edge {edge.start_node.id} -> {edge.end_node.id} added to the world.")

    def load_data(self, nodes_data: List[Dict], edges_data: List[Dict]):
        print("Loading data into the world...")
        for node_data in nodes_data:
            node = Node(
                id=node_data['id'],
                name=node_data['name'],
                weight=node_data.get('weight', 1.0),
                velocity=node_data.get('velocity', (0, 0, 0)),
                pinned=node_data.get('pinned', False),
                block_content=node_data.get('block_content', ''),
                link_types=node_data.get('link_types', []),
                file_size=node_data.get('file_size', 0)
            )
            self.add_node(node)

        for edge_data in edges_data:
            start_node_id = edge_data['start_node']
            end_node_id = edge_data['end_node']
            
            if start_node_id == end_node_id:
                print(f"Skipping self-referential edge: {start_node_id} -> {end_node_id}")
                continue
            
            start_node = self.nodes[start_node_id]
            end_node = self.nodes[end_node_id]
            edge = Edge(
                start_node, 
                end_node, 
                weight=edge_data.get('weight', 1.0),
                is_active=edge_data.get('is_active', True),
                link_type=edge_data.get('link_type', '')
            )
            self.add_edge(edge)
        print("Data loading complete.")

    def create_material_for_node(self, link_count: int) -> bpy.types.Material:
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

        print(f"Created material for node with {link_count} links")
        return mat

    def create_blender_objects(self):
        print("Creating Blender objects...")
        for node in self.nodes.values():
            try:
                radius = NODE_BASE_SIZE * (1 + np.log1p(node.file_size) / 10)
                bpy.ops.mesh.primitive_uv_sphere_add(
                    radius=radius, location=node.position.to_tuple()
                )
                obj = bpy.context.object
                obj.name = node.name
                node.blender_object = obj

                material = self.create_material_for_node(len(node.link_types))
                obj.data.materials.append(material)

                print(f"Created node: {node.name} with radius {radius} at {node.position.to_tuple()}")
            except Exception as e:
                print(f"Error creating node object {node.name}: {e}")

        for edge in self.edges:
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

        for edge in self.edges:
            edge.update_blender_object()

        print("Blender object creation complete.")

print("World class defined.")

def load_json(file_path: str) -> Optional[Dict]:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print(f"JSON data loaded from {file_path}")
            return data
    except Exception as e:
        print(f"Error loading JSON file {file_path}: {e}")
        return None

def clear_scene():
    try:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()
        print("Scene cleared.")
    except Exception as e:
        print(f"Error clearing the scene: {e}")

def enable_material_shading():
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
    total_energy = 0
    for edge in world.edges:
        direction = edge.end_node.position - edge.start_node.position
        distance = direction.length()
        spring_energy = 0.5 * SPRING_CONSTANT * (distance - edge.weight)**2
        total_energy += spring_energy
    print(f"Total system energy: {total_energy:.6f}")
    return total_energy

def run_simulation(world: World, max_steps: int, delta_time: float):
    current_step = 0
    prev_energy = float('inf')

    def step_simulation():
        nonlocal current_step, prev_energy
        try:
            current_energy = calculate_total_energy(world)
            energy_change = abs(current_energy - prev_energy)

            print(f"\nStep {current_step}:")
            print(f"Current Energy: {current_energy:.6f}")
            print(f"Energy Change: {energy_change:.6f}")

            if current_step < max_steps and energy_change > ENERGY_THRESHOLD:
                for edge in world.edges:
                    edge.apply_spring_force()

                max_movement = 0
                for node in world.nodes.values():
                    old_position = node.position
                    node.update_position(delta_time)
                    movement = (node.position - old_position).length()
                    max_movement = max(max_movement, movement)

                for edge in world.edges:
                    edge.update_blender_object()

                print(f"Max node movement: {max_movement:.6f}")

                bpy.context.view_layer.update()

                current_step += 1
                prev_energy = current_energy

                if max_movement < 1e-6:
                    print("Simulation stopped due to minimal movement")
                    return None

                return 0.01  # Schedule next step
            else:
                if current_step >= max_steps:
                    print(f"Simulation stopped after reaching maximum steps: {max_steps}")
                else:
                    print(f"Equilibrium reached after {current_step} steps.")
                print(f"Final system energy: {current_energy}")
                return None  # Stop the timer
        except Exception as e:
            print(f"Error during simulation step {current_step}: {e}")
            return None

    print(f"Starting simulation with max steps: {max_steps}")
    bpy.app.timers.register(step_simulation)

def main():
    print("Main function started.")
    try:
        current_dir = os.path.dirname(os.path.realpath(__file__))
        print(f"Current directory: {current_dir}")

        nodes_file_path = os.path.join(current_dir, 'nodes.json')
        edges_file_path = os.path.join(current_dir, 'edges.json')

        nodes_data = load_json(nodes_file_path)
        edges_data = load_json(edges_file_path)

        if nodes_data is None or edges_data is None:
            print("Failed to load JSON data. Exiting.")
            return

        clear_scene()
        enable_material_shading()

        world = World()
        world.load_data(nodes_data, edges_data)
        print(f"Loaded {len(world.nodes)} nodes and {len(world.edges)} edges into the World.")

        world.create_blender_objects()

        max_steps = 10000
        delta_time = 0.01
        run_simulation(world, max_steps, delta_time)

    except Exception as e:
        print(f"Error in main execution: {e}")

print("Script definitions complete. Running main function.")
if __name__ == '__main__':
    main()

