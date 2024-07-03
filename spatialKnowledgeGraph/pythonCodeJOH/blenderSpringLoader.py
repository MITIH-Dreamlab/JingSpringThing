import numpy as np
import bpy

# Vector3 class: Represents a 3D vector with basic operations
class Vector3:
    def __init__(self, x=0, y=0, z=0):
        self.x = x
        self.y = y
        self.z = z

    def __add__(self, other):
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other):
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, scalar):
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)

    def length(self):
        return np.sqrt(self.x**2 + self.y**2 + self.z**2)
    
    def normalize(self):
        l = self.length()
        return Vector3(self.x / l, self.y / l, self.z / l) if l != 0 else Vector3(0, 0, 0)

# Node class: Represents each node in the knowledge graph
class Node:
    def __init__(self, id, name, position=None, file_size=0):
        self.id = id
        self.name = name
        self.position = position if position else Vector3()
        self.velocity = Vector3()
        self.force = Vector3()
        self.file_size = file_size
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

# Edge class: Represents relationships in the knowledge graph
class Edge:
    def __init__(self, start_node, end_node):
        self.start_node = start_node
        self.end_node = end_node
        self.rest_length = (start_node.file_size + end_node.file_size) * 0.1  # Example function
    
    def apply_spring_force(self):
        direction = self.end_node.position - self.start_node.position
        distance = direction.length()
        if np.isclose(distance, 0):  # Avoid division by zero
            return
        
        force_magnitude = (distance - self.rest_length) * 0.01  # Spring constant k
        force = direction.normalize() * force_magnitude
        
        self.start_node.apply_force(force)
        self.end_node.apply_force(-force)

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
        import os
        import glob
        import re

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
                    
                    node = Node(id=node_id, name=node_name, file_size=file_size)
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

    def create_blender_objects(self):
        """
        Create corresponding Blender objects for nodes and edges.
        """
        for node in self.nodes.values():
            bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(node.position.x, node.position.y, node.position.z))
            obj = bpy.context.object
            obj.name = node.name
            node.blender_object = obj

        for edge in self.edges:
            start_loc = edge.start_node.blender_object.location
            end_loc = edge.end_node.blender_object.location
            bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=(start_loc - end_loc).length, location=(start_loc + end_loc) / 2)
            obj = bpy.context.object
            obj.name = f"{edge.start_node.name}_to_{edge.end_node.name}"
            edge.blender_object = obj

if __name__ == "__main__":
    import sys

    # Ensure the script is run with a directory argument
    if len(sys.argv) != 2:
        print("Usage: python load_logseq_data.py <directory>")
        sys.exit(1)

    # Get the directory from the command line argument
    folder_path = sys.argv[1]

    # Validate directory
    if not os.path.isdir(folder_path):
        print(f"Error: {folder_path} is not a valid directory")
        sys.exit(1)

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

