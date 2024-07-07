import bpy
import os
import glob
import re
import math
import random
import json
import numpy as np
from mathutils import Vector
from typing import Dict, List, Tuple, Optional

bl_info = {
    "name": "Markdown Graph Visualizer",
    "author": "Your Name",
    "version": (1, 0),
    "blender": (4, 1, 1),
    "location": "View3D > Sidebar > Markdown Graph",
    "description": "Visualizes Markdown files as a 3D graph",
    "warning": "",
    "doc_url": "",
    "category": "3D View",
}

# Constants
NODE_BASE_SIZE = 0.05
EDGE_THICKNESS = 0.01
POSITION_SCALE = 10.0
SPRING_CONSTANT = 0.01
DAMPING_FACTOR = 0.5
ENERGY_THRESHOLD = 1e-6

class Vector3:
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
    def __init__(self, id: str, name: str, position: Tuple[float, float, float] = (0, 0, 0),
                 weight: float = 1.0, velocity: Tuple[float, float, float] = (0, 0, 0),
                 pinned: bool = False, block_content: str = '', link_types: List[str] = None,
                 file_size: int = 0):
        self.id = id
        self.name = name
        self.position = Vector3(*position)
        self.weight = weight
        self.velocity = Vector3(*velocity)
        self.pinned = pinned
        self.block_content = block_content
        self.link_types = link_types or []
        self.file_size = file_size
        self.force = Vector3()
        self.blender_object: Optional[bpy.types.Object] = None
        self.damping = DAMPING_FACTOR

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

    def update_position(self, delta_time: float):
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
    def __init__(self, start_node: Node, end_node: Node, weight: float = 1.0,
                 is_active: bool = True, link_type: str = ''):
        self.start_node = start_node
        self.end_node = end_node
        self.weight = weight
        self.is_active = is_active
        self.link_type = link_type
        self.blender_object: Optional[bpy.types.Object] = None

    def to_dict(self) -> Dict:
        return {
            'start_node': self.start_node.id,
            'end_node': self.end_node.id,
            'weight': self.weight,
            'is_active': self.is_active,
            'link_type': self.link_type
        }

    def apply_spring_force(self):
        direction = self.end_node.position - self.start_node.position
        distance = direction.length()
        if np.isclose(distance, 0):
            return

        force_magnitude = SPRING_CONSTANT * (distance - self.weight)
        force = direction.normalize() * force_magnitude

        self.start_node.apply_force(force)
        self.end_node.apply_force(force * -1)

    def update_blender_object(self):
        if self.blender_object:
            start_loc = self.start_node.position.to_tuple()
            end_loc = self.end_node.position.to_tuple()

            direction = Vector(end_loc) - Vector(start_loc)
            distance = direction.length
            direction.normalize()

            start_radius = self.start_node.blender_object.scale[0] / 2
            end_radius = self.end_node.blender_object.scale[0] / 2
            adjusted_start = Vector(start_loc) + direction * start_radius
            adjusted_end = Vector(end_loc) - direction * end_radius

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
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []

    def add_node(self, node: Node):
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        self.edges.append(edge)

    def load_data(self, nodes_data: List[Dict], edges_data: List[Dict]):
        for node_data in nodes_data:
            node = Node(**node_data)
            self.add_node(node)

        for edge_data in edges_data:
            start_node = self.nodes[edge_data['start_node']]
            end_node = self.nodes[edge_data['end_node']]
            edge = Edge(start_node, end_node, **edge_data)
            self.add_edge(edge)

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

        return mat

    def create_blender_objects(self):
        def create_node_objects():
            for node in self.nodes.values():
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

        def create_edge_objects():
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

        print("Starting to create node objects...")
        create_node_objects()
        print("Starting to create edge objects...")
        create_edge_objects()

        for edge in self.edges:
            edge.update_blender_object()

def parse_markdown_files() -> Tuple[List[Node], List[Edge]]:
    nodes = []
    edges = []
    node_dict = {}

    for file_path in glob.glob('*.md'):
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
                if not content.strip():
                    continue

                if not content.lstrip().startswith("public:: true"):
                    continue

                file_name = os.path.basename(file_path)
                node_id = file_name
                node_name = file_name.split('.')[0]
                block_content = content
                link_types = re.findall(r'\[\[([^\]]+)\]\]', content)
                file_size = os.path.getsize(file_path)

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

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    print("Scene cleared.")

def enable_material_shading():
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    break
    print("Material shading enabled.")

def calculate_total_energy(world: World) -> float:
    total_energy = 0
    for edge in world.edges:
        direction = edge.end_node.position - edge.start_node.position
        distance = direction.length()
        spring_energy = 0.5 * SPRING_CONSTANT * (distance - edge.weight)**2
        total_energy += spring_energy
    return total_energy

def run_simulation(world: World, max_steps: int, delta_time: float):
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

                bpy.context.view_layer.update()

                current_step += 1
                prev_energy = current_energy

                if current_step % 100 == 0:
                    print(f"Step {current_step}: Energy = {current_energy}")

                return 0.01
            else:
                if current_step >= max_steps:
                    print(f"Simulation stopped after reaching maximum steps: {max_steps}")
                else:
                    print(f"Equilibrium reached after {current_step} steps.")
                print(f"Final system energy: {current_energy}")
                return None
        except Exception as e:
            print(f"Error during simulation step {current_step}: {e}")
            return None

    print(f"Starting simulation with max steps: {max_steps}")
    bpy.app.timers.register(step_simulation)

class MARKDOWN_OT_visualize_graph(bpy.types.Operator):
    bl_idname = "markdown.visualize_graph"
    bl_label = "Visualize Markdown Graph"
    bl_description = "Create a 3D graph visualization from Markdown files in the current directory"

    def execute(self, context):
        try:
            nodes, edges = parse_markdown_files()
            print(f"Parsed {len(nodes)} nodes and {len(edges)} edges from Markdown files.")

            clear_scene()

            world = World()
            for node in nodes:
                world.add_node(node)
            for edge in edges:
                world.add_edge(edge)

            print(f"Loaded {len(world.nodes)} nodes and {len(world.edges)} edges into the World.")

            world.create_blender_objects()

            enable_material_shading()

            max_steps = 10000
            delta_time = 0.01
            run_simulation(world, max_steps, delta_time)

            return {'FINISHED'}
        except Exception as e:
            self.report({'ERROR'}, f"Error: {str(e)}")
            return {'CANCELLED'}

class MARKDOWN_PT_graph_panel(bpy.types.Panel):
    bl_label = "Markdown Graph"
    bl_idname = "MARKDOWN_PT_graph_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Markdown Graph'

    def draw(self, context):
        layout = self.layout
        layout.operator(MARKDOWN_OT_visualize_graph.bl_idname)

classes = (
    MARKDOWN_OT_visualize_graph,
    MARKDOWN_PT_graph_panel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)

def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)

if __name__ == "__main__":
    register()
