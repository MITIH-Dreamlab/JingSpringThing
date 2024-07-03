import bpy
import os
import glob
import re
import sys
import random
import numpy as np

# Constants for scaling
POSITION_SCALE = 100.0
SIZE_SCALE = 100000.0
EDGE_SCALE = 100.0

# Vector3 class: Represents a 3D vector with basic operations and includes arithmetic operators
class Vector3:
    def __init__(self, x=0, y=0, z=0):
        self.x = x / POSITION_SCALE
        self.y = y / POSITION_SCALE
        self.z = z / POSITION_SCALE

    def __add__(self, other):
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other):
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, scalar):
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)

    def __iadd__(self, other):
        self.x += other.x
        self.y += other.y
        self.z += other.z
        return self

    def length(self):
        return np.sqrt(self.x ** 2 + self.y ** 2 + self.z ** 2)

    def to_tuple(self):
        return (self.x, self.y, self.z)

    def normalize(self):
        l = self.length()
        return Vector3(self.x / l, self.y / l, self.z / l) if l != 0 else Vector3(0, 0, 0)

# Node class: Represents each node in the knowledge graph
class Node:
    def __init__(self, id, name, position=None, file_size=0, link_count=0):
        self.id = id
        self.name = name
        self.position = position if position else Vector3(random.uniform(-10, 10), random.uniform(-10, 10), random.uniform(-10, 10))
        self.velocity = Vector3()
        self.force = Vector3()
        self.file_size = file_size
        self.link_count = link_count
        self.blender_object = None

    def apply_force(self, force):
        self.force += force

    def update_position(self, delta_time):
        if np.isclose(self.file_size, 0):  # Avoid division by zero
            return

        acceleration = self.force * (1.0 / self.file_size)
        self.velocity += acceleration * delta_time
        self.position += self.velocity * delta_time
        self.force = Vector3()  # Reset force

        if self.blender_object:
            self.blender_object.location = self.position.to_tuple()

# Edge class: Represents relationships in the knowledge graph
class Edge:
    def __init__(self, start_node, end_node):
        self.start_node = start_node
        self.end_node = end_node
        self.rest_length = ((start_node.file_size + end_node.file_size) * 0.1 / EDGE_SCALE)
        self.blender_object = None

    def apply_spring_force(self):
        direction = self.end_node.position - self.start_node.position
        distance = direction.length()
        if np.isclose(distance, 0):  # Avoid division by zero
            return

        force_magnitude = (distance - self.rest_length) * 0.01  # Spring constant k
        force = direction.normalize() * force_magnitude

        self.start_node.apply_force(force)
        self.end_node.apply_force(-force)

    def update_blender_object(self):
        if self.blender_object:
            start_loc = self.start_node.position.to_tuple()
            end_loc = self.end_node.position.to_tuple()
            mid_point = [(s + e) / 2 for s, e in zip(start_loc, end_loc)]

            self.blender_object.location = mid_point

            # Update cylinder transformation to match the new positions
            direction = self.end_node.position - self.start_node.position
            distance = direction.length()
            self.blender_object.scale = (self.blender_object.scale[0], self.blender_object.scale[1], distance / 2)
            self.blender_object.rotation_euler = direction.normalize().to_tuple()

# World class: Manages the entire graph data
class World:
    def __init__(self):
        self.nodes = {}
        self.edges = []

    def add_node(self, node):
        self.nodes[node.id] = node

    def add_edge(self, edge):
        self.edges.append(edge)

    def load_logseq_data(self, folder_path):
        for file_path in glob.glob(os.path.join(folder_path, '*.md')):
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    if not content.strip():
                        continue  # Skip empty files

                    file_name = os.path.basename(file_path)
                    node_id = file_name
                    node_name = file_name.split('.')[0]
                    file_size = os.path.getsize(file_path)

                    # Count the number of links in the content
                    link_count = len(re.findall(r'\[\[([^\]]+)\]\]', content))

                    node = Node(id=node_id, name=node_name, file_size=file_size, link_count=link_count)
                    self.add_node(node)

                    link_types = re.findall(r'\[\[([^\]]+)\]\]', content)
                    for link in link_types:
                        if link in self.nodes:
                            edge = Edge(start_node=node, end_node=self.nodes[link])
                            self.add_edge(edge)
                        else:
                            print(f"Link target '{link}' not found for node '{node_name}'")

            except (IOError, OSError) as e:
                print(f"Error reading file {file_path}: {e}")

    def run_simulation(self, steps, delta_time):
        for step in range(steps):
            for edge in self.edges:
                edge.apply_spring_force()

            for node in self.nodes.values():
                node.update_position(delta_time)

            for edge in self.edges:
                edge.update_blender_object()

            # Update the viewport
            bpy.context.view_layer.update()
            bpy.ops.wm.redraw_timer(type='DRAW_WIN_SWAP', iterations=1)

    def create_material_for_node(self, link_count):
        # Create a new material
        mat = bpy.data.materials.new(name="NodeMaterial")
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links

        # Clear default nodes
        for node in nodes:
            nodes.remove(node)

        # Add nodes
        output = nodes.new(type='ShaderNodeOutputMaterial')
        diffuse = nodes.new(type='ShaderNodeBsdfDiffuse')
        
        # Color based on the link count (range from blue to red for simplicity)
        color = (1.0, 1.0 - min(1.0, link_count / 10.0), 1.0 - min(1.0, link_count / 10.0), 1.0)  # RGBA
        diffuse.inputs['Color'].default_value = color

        # Link the nodes
        links.new(diffuse.outputs['BSDF'], output.inputs['Surface'])

        return mat

    def create_blender_objects(self):
        for node in self.nodes.values():
            radius = max(0.01, node.file_size / SIZE_SCALE)  # Adjusting the sphere size based on file size for visibility (scaled down more)
            bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=node.position.to_tuple())
            obj = bpy.context.object
            obj.name = node.name
            node.blender_object = obj

            # Assign material based on link count
            material = self.create_material_for_node(node.link_count)
            if obj.data.materials:
                obj.data.materials[0] = material
            else:
                obj.data.materials.append(material)

        for edge in self.edges:
            start_loc = edge.start_node.position.to_tuple()
            end_loc = edge.end_node.position.to_tuple()
            bpy.ops.mesh.primitive_cylinder_add(radius=0.005, depth=1)  # Adjust cylinder radius as needed (smaller radius)
            obj = bpy.context.object
            obj.name = f"{edge.start_node.name}_to_{edge.end_node.name}"
            edge.blender_object = obj

            # Position the cylinder correctly
            mid_point = [(s + e) / 2 for s, e in zip(start_loc, end_loc)]
            obj.location = mid_point

            # Scale and rotate the cylinder to align between the two nodes
            direction = edge.end_node.position - edge.start_node.position
            distance = direction.length()
            obj.scale = (obj.scale[0], obj.scale[1], distance / 2)
            obj.rotation_euler = direction.normalize().to_tuple()

def main(folder_path):
    try:
        # Create a World instance and load Logseq data
        world = World()
        world.load_logseq_data(folder_path)
        print(f"Loaded {len(world.nodes)} nodes and {len(world.edges)} edges.")

        # Integrate with Blender
        world.create_blender_objects()

        # Run the simulation
        steps = 100  # Number of simulation steps
        delta_time = 0.1  # Time step in seconds
        world.run_simulation(steps, delta_time)

    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    # Ensure the correct argument is provided
    if len(sys.argv) < 2:
        print("Usage: blenderSpringLoader.py <directory>")
        sys.exit(1)

    # Get the directory from the command line arguments
    folder_path = sys.argv[-1]

    # Call main function
    main(folder_path)

