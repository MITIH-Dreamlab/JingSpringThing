import bpy
import json
import os
import numpy as np
import sys
import time

# Constants for scaling
POSITION_SCALE = 10.0
SIZE_SCALE = 1000000.0
EDGE_SCALE = 10.0

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
    def __init__(self, data):
        self.id = data.get('id')
        self.name = data.get('name')
        # Assign random positions initially
        self.position = Vector3(
            np.random.uniform(-10, 10), 
            np.random.uniform(-10, 10), 
            np.random.uniform(-10, 10)
        )
        self.velocity = Vector3()
        self.force = Vector3()
        self.file_size = data.get('file_size', 1.0)
        self.link_count = len(data.get('link_types', []))
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

        # Update the corresponding Blender object position
        if self.blender_object:
            self.blender_object.location = self.position.to_tuple()

# Edge class: Represents relationships in the knowledge graph
class Edge:
    def __init__(self, data, nodes_dict):
        self.start_node = nodes_dict.get(data.get('start_node'))
        self.end_node = nodes_dict.get(data.get('end_node'))
        self.rest_length = ((self.start_node.file_size + self.end_node.file_size) * 0.1 / EDGE_SCALE)
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
            self.blender_object.scale = (0.005, 0.005, distance / 2)
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

    def load_data(self, nodes_data, edges_data):
        for node_data in nodes_data:
            node = Node(node_data)
            self.add_node(node)
        
        for edge_data in edges_data:
            edge = Edge(edge_data, self.nodes)
            self.add_edge(edge)

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
        nodes_list = list(self.nodes.values())
        edges_list = self.edges

        def create_node_objects(index=0):
            try:
                if index < len(nodes_list):
                    node = nodes_list[index]
                    radius = max(0.01, node.file_size / SIZE_SCALE)  # Adjust sphere size based on file size
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

                    # Schedule the creation of the next node
                    bpy.app.timers.register(lambda: create_node_objects(index + 1), first_interval=0.01)
            except Exception as e:
                print(f"Error creating node object at index {index}: {e}")

        def create_edge_objects(index=0):
            try:
                if index < len(edges_list):
                    edge = edges_list[index]
                    start_loc = edge.start_node.position.to_tuple()
                    end_loc = edge.end_node.position.to_tuple()
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.005, depth=1)
                    obj = bpy.context.object
                    edge.blender_object = obj

                    # Position the cylinder correctly
                    mid_point = [(s + e) / 2 for s, e in zip(start_loc, end_loc)]
                    obj.location = mid_point

                    # Scale and rotate the cylinder to align between the two nodes
                    direction = edge.end_node.position - edge.start_node.position
                    distance = direction.length()
                    obj.rotation_mode = 'QUATERNION'
                    obj.scale = (0.005, 0.005, distance / 2)

                    # Schedule the creation of the next edge
                    bpy.app.timers.register(lambda: create_edge_objects(index + 1), first_interval=0.01)
            except Exception as e:
                print(f"Error creating edge object at index {index}: {e}")
        
        # Start creating node objects
        print("Starting to create node objects...")
        create_node_objects()

        # After all nodes are created, start creating edge objects
        bpy.app.timers.register(lambda: create_edge_objects(), first_interval=0.01)

def load_json(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading JSON file {file_path}: {e}")
        return None

def clear_scene():
    try:
        # Delete all objects in the scene
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()
        print("Scene cleared.")
    except Exception as e:
        print(f"Error clearing the scene: {e}")

def enable_material_shading():
    try:
        # Enable material shading in the viewport
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        space.shading.type = 'MATERIAL'
                        break
        print("Material shading enabled.")
    except Exception as e:
        print(f"Error enabling material shading: {e}")

def run_simulation(world, steps, delta_time):
    current_step = 0

    def step_simulation():
        nonlocal current_step
        try:
            if current_step < steps:
                for edge in world.edges:
                    edge.apply_spring_force()

                for node in world.nodes.values():
                    node.update_position(delta_time)

                for edge in world.edges:
                    edge.update_blender_object()

                # Update the viewport
                bpy.context.view_layer.update()

                current_step += 1

                # Schedule the next step
                bpy.app.timers.register(step_simulation, first_interval=0.01)
            else:
                print(f"Simulation completed after {steps} steps.")
        except Exception as e:
            print(f"Error during simulation step {current_step}: {e}")

    # Start the simulation steps
    print(f"Starting simulation for {steps} steps.")
    step_simulation()

def main():
    current_dir = os.path.dirname(os.path.realpath(__file__))
    
    nodes_file_path = os.path.join(current_dir, 'nodes.json')
    edges_file_path = os.path.join(current_dir, 'edges.json')

    nodes_data = load_json(nodes_file_path)
    edges_data = load_json(edges_file_path)

    if nodes_data is None or edges_data is None:
        print("Failed to load JSON data.")
        return

    # Clear the scene
    clear_scene()

    # Create a World instance and load the data
    world = World()
    world.load_data(nodes_data, edges_data)
    print(f"Loaded {len(world.nodes)} nodes and {len(world.edges)} edges.")

    # Integrate with Blender
    world.create_blender_objects()

    # Enable material shading for better visualization
    enable_material_shading()

    # Run the simulation using timers
    steps = 1000  # Number of simulation steps
    delta_time = 0.01  # Time step in seconds
    bpy.app.timers.register(lambda: run_simulation(world, steps, delta_time), first_interval=1.0)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"Error in main execution: {e}")

