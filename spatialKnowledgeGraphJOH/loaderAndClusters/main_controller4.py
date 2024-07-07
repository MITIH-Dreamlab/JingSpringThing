import bpy
import json
import os
import numpy as np
import mathutils
import time
import asyncio

# Constants for node, edge sizes, and position scaling
NODE_BASE_SIZE = 0.05  # Base size for the smallest nodes
EDGE_THICKNESS = 0.01  # Thickness of the edges connecting nodes
POSITION_SCALE = 10.0  # Scaling factor for initial node positions

# Physics simulation constants
SPRING_CONSTANT = 0.01  # Strength of the spring force between connected nodes
DAMPING_FACTOR = 0.5  # Reduces oscillations in the system
ENERGY_THRESHOLD = 1e-6  # Threshold for considering the system at equilibrium

# Vector3 class: Represents a 3D vector with basic operations
class Vector3:
    def __init__(self, x=0, y=0, z=0):
        # Initialize a 3D vector, scaling the input values
        self.x = x / POSITION_SCALE
        self.y = y / POSITION_SCALE
        self.z = z / POSITION_SCALE

    def __add__(self, other):
        # Vector addition
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other):
        # Vector subtraction
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, scalar):
        # Scalar multiplication
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)

    def __iadd__(self, other):
        # In-place vector addition
        self.x += other.x
        self.y += other.y
        self.z += other.z
        return self

    def length(self):
        # Calculate the length (magnitude) of the vector
        return np.sqrt(self.x ** 2 + self.y ** 2 + self.z ** 2)

    def to_tuple(self):
        # Convert the vector to a tuple (useful for Blender operations)
        return (self.x, self.y, self.z)

    def normalize(self):
        # Return a normalized version of the vector (unit vector)
        l = self.length()
        if l != 0:
            return Vector3(self.x / l, self.y / l, self.z / l)
        return Vector3(0, 0, 0)

# Node class: Represents each node in the knowledge graph
class Node:
    def __init__(self, data):
        self.id = data.get('id')
        self.name = data.get('name')
        # Assign random initial positions
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
        self.damping = DAMPING_FACTOR

    def apply_force(self, force):
        # Add an external force to the node
        self.force += force

    def update_position(self, delta_time):
        # Update the node's position based on applied forces
        if np.isclose(self.file_size, 0):
            return  # Avoid division by zero for nodes with no file size

        # Calculate acceleration (F = ma, so a = F/m)
        acceleration = self.force * (1.0 / self.file_size)
        
        # Update velocity (with damping to reduce oscillations)
        self.velocity += acceleration * delta_time
        self.velocity *= (1 - self.damping)
        
        # Update position
        self.position += self.velocity * delta_time
        
        # Reset force for the next iteration
        self.force = Vector3()

        # Update the corresponding Blender object position
        if self.blender_object:
            self.blender_object.location = self.position.to_tuple()

# Edge class: Represents relationships between nodes in the knowledge graph
class Edge:
    def __init__(self, data, nodes_dict):
        self.start_node = nodes_dict.get(data.get('start_node'))
        self.end_node = nodes_dict.get(data.get('end_node'))
        self.rest_length = ((self.start_node.file_size + self.end_node.file_size) * 0.1)
        self.blender_object = None

    def apply_spring_force(self):
        # Calculate and apply spring forces between connected nodes
        direction = self.end_node.position - self.start_node.position
        distance = direction.length()
        if np.isclose(distance, 0):
            return  # Avoid division by zero

        # Calculate force magnitude using Hooke's law: F = k * (x - x0)
        force_magnitude = SPRING_CONSTANT * (distance - self.rest_length)
        force = direction.normalize() * force_magnitude

        # Apply equal and opposite forces to connected nodes
        self.start_node.apply_force(force)
        self.end_node.apply_force(force * -1)

    def update_blender_object(self):
        # Update the visual representation of the edge in Blender
        if self.blender_object:
            start_loc = self.start_node.position.to_tuple()
            end_loc = self.end_node.position.to_tuple()

            # Calculate edge direction and length
            direction = mathutils.Vector(end_loc) - mathutils.Vector(start_loc)
            distance = direction.length
            direction.normalize()
            
            # Adjust start and end points to node surfaces
            start_radius = self.start_node.blender_object.scale[0] / 2
            end_radius = self.end_node.blender_object.scale[0] / 2
            adjusted_start = mathutils.Vector(start_loc) + direction * start_radius
            adjusted_end = mathutils.Vector(end_loc) - direction * end_radius
            
            # Recalculate direction and distance
            adjusted_direction = adjusted_end - adjusted_start
            adjusted_distance = adjusted_direction.length
            
            # Set edge rotation
            quat = adjusted_direction.to_track_quat('Z', 'Y')
            self.blender_object.rotation_mode = 'QUATERNION'
            self.blender_object.rotation_quaternion = quat

            # Set edge position (midpoint between nodes)
            mid_point = (adjusted_start + adjusted_end) / 2
            self.blender_object.location = mid_point

            # Set edge scale
            self.blender_object.scale = (EDGE_THICKNESS, EDGE_THICKNESS, adjusted_distance / 2)

# World class: Manages the entire graph data and simulation
class World:
    def __init__(self):
        self.nodes = {}
        self.edges = []

    def add_node(self, node):
        self.nodes[node.id] = node

    def add_edge(self, edge):
        self.edges.append(edge)

    def load_data(self, nodes_data, edges_data):
        # Create Node objects from JSON data
        for node_data in nodes_data:
            node = Node(node_data)
            self.add_node(node)
        
        # Create Edge objects from JSON data
        for edge_data in edges_data:
            edge = Edge(edge_data, self.nodes)
            self.add_edge(edge)

    def create_material_for_node(self, link_count):
        # Create a Blender material for a node based on its link count
        mat = bpy.data.materials.new(name="NodeMaterial")
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links

        # Clear default nodes
        nodes.clear()

        # Add new nodes
        output = nodes.new(type='ShaderNodeOutputMaterial')
        diffuse = nodes.new(type='ShaderNodeBsdfDiffuse')
        
        # Set color based on link count (gradient from blue to red)
        color = (1.0, 1.0 - min(1.0, link_count / 10.0), 1.0 - min(1.0, link_count / 10.0), 1.0)
        diffuse.inputs['Color'].default_value = color

        # Link nodes
        links.new(diffuse.outputs['BSDF'], output.inputs['Surface'])

        return mat

    async def create_blender_objects(self):
        # Asynchronously create Blender objects for nodes and edges
        nodes_list = list(self.nodes.values())
        edges_list = self.edges

        async def create_node_objects():
            for index, node in enumerate(nodes_list):
                try:
                    # Calculate node size based on file size
                    radius = NODE_BASE_SIZE * (1 + np.log1p(node.file_size) / 10)
                    
                    # Create sphere for node
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=node.position.to_tuple())
                    obj = bpy.context.object
                    obj.name = node.name
                    node.blender_object = obj

                    # Assign material
                    material = self.create_material_for_node(node.link_count)
                    obj.data.materials.append(material)

                    print(f"Created node {index + 1}/{len(nodes_list)}: {node.name} with radius {radius}")
                    
                    # Yield control to allow other operations
                    await asyncio.sleep(0)
                except Exception as e:
                    print(f"Error creating node object {node.name}: {e}")

        async def create_edge_objects():
            for index, edge in enumerate(edges_list):
                try:
                    # Create cube for edge
                    bpy.ops.mesh.primitive_cube_add(size=1)
                    obj = bpy.context.object
                    edge.blender_object = obj

                    # Initial positioning and scaling (will be updated later)
                    start_loc = edge.start_node.position.to_tuple()
                    obj.location = start_loc
                    obj.scale = (EDGE_THICKNESS, EDGE_THICKNESS, 1)

                    print(f"Created edge {index + 1}/{len(edges_list)}: from {edge.start_node.name} to {edge.end_node.name}")
                    
                    # Yield control to allow other operations
                    await asyncio.sleep(0)
                except Exception as e:
                    print(f"Error creating edge object: {e}")

        # Create nodes and edges asynchronously
        print("Starting to create node objects...")
        await create_node_objects()
        print("Starting to create edge objects...")
        await create_edge_objects()

        # Update edge positions and orientations
        for edge in self.edges:
            edge.update_blender_object()

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
        # Enable material shading in the viewport for better visualization
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        space.shading.type = 'MATERIAL'
                        break
        print("Material shading enabled.")
    except Exception as e:
        print(f"Error enabling material shading: {e}")

def calculate_total_energy(world):
    # Calculate the total energy in the system (sum of spring potential energies)
    total_energy = 0
    for edge in world.edges:
        direction = edge.end_node.position - edge.start_node.position
        distance = direction.length()
        spring_energy = 0.5 * SPRING_CONSTANT * (distance - edge.rest_length)**2
        total_energy += spring_energy
    return total_energy

def run_simulation(world, max_steps, delta_time):
    current_step = 0
    prev_energy = float('inf')

    def step_simulation():
        nonlocal current_step, prev_energy
        try:
            current_energy = calculate_total_energy(world)
            energy_change = abs(current_energy - prev_energy)
            
            if current_step < max_steps and energy_change > ENERGY_THRESHOLD:
                # Apply forces and update positions
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

                # Print progress every 100 steps
                if current_step % 100 == 0:
                    print(f"Step {current_step}: Energy = {current_energy}")

                # Schedule the next step
                return 0.01  # Run again after 10ms
            else:
                if current_step >= max_steps:
                    print(f"Simulation stopped after reaching maximum steps: {max_steps}")
                else:
                    print(f"Equilibrium reached after {current_step} steps.")
                print(f"Final system energy: {current_energy}")
                return None  # Stop the timer
        except Exception as e:
            print(f"Error during simulation step {current_step}: {e}")
            return None  # Stop the timer

    # Start the simulation steps
    print(f"Starting simulation with max steps: {max_steps}")
    bpy.app.timers.register(step_simulation)

async def main():
    try:
        current_dir = os.path.dirname(os.path.realpath(__file__))
        
        nodes_file_path = os.path.join(current_dir, 'nodes.json')
        edges_file_path = os.path.join(current_dir, 'edges.json')

        # Load JSON data
        nodes_data = load_json(nodes_file_path)
        edges_data = load_json(edges_file_path)

        if nodes_data is None or edges_data is None:
            print("Failed to load JSON data.")
            return

        # Clear the Blender scene
        clear_scene()

        # Create a World instance and load the data
        world = World()
        world.load_data(nodes_data, edges_data)
        print(f"Loaded {len(world.nodes)} nodes and {len(world.edges)} edges.")

        # Create Blender objects for nodes and edges
        await world.create_blender_objects()

        # Enable material shading for better visualization
        enable_material_shading()

        # Run the simulation
        max_steps = 10000  # Maximum number of simulation steps
        delta_time = 0.01  # Time step for each iteration
        run_simulation(world, max_steps, delta_time)

    except Exception as e:
        print(f"Error in main execution: {e}")

# Run the main function
if __name__ == '__main__':
    asyncio.run(
