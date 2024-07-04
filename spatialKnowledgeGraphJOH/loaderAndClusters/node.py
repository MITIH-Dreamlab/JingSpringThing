"""
Project: Spatial Knowledge Graph Visualization in Blender
File: node.py

Description: This module contains the Node class, representing a single node
             in the knowledge graph. It handles node properties, including position,
             velocity, and Blender object creation.
"""

import random
import bpy
from vector3 import Vector3 

# Constant for scaling node size
SIZE_SCALE = 1000000.0

class Node:
    """
    Represents a node in the knowledge graph.
    """
    def __init__(self, id, name, position=None, file_size=0, link_count=0):
        """
        Initializes a Node object.

        Args:
            id (str): Unique identifier for the node.
            name (str): Name of the node.
            position (Vector3, optional): Initial position of the node. 
                                           If None, a random position is generated.
            file_size (int, optional): Size of the corresponding Markdown file in bytes. 
            link_count (int, optional): Number of links in the Markdown file.
        """
        self.id = id
        self.name = name
        self.position = position if position else Vector3(random.uniform(-10, 10), random.uniform(-10, 10), random.uniform(-10, 10))
        self.velocity = Vector3()  # Initial velocity
        self.force = Vector3()      # Initial force
        self.file_size = file_size
        self.link_count = link_count
        self.blender_object = None  # Reference to the Blender object representing this node

    def apply_force(self, force):
        """Applies a force to the node, affecting its velocity and position."""
        self.force += force

    def update_position(self, delta_time):
        """
        Updates the node's position based on the applied forces and velocity.

        Args:
            delta_time (float): The time step for the simulation iteration.
        """
        if np.isclose(self.file_size, 0):  # Avoid division by zero for nodes with zero size
            return
        
        acceleration = self.force * (1.0 / self.file_size) 
        self.velocity += acceleration * delta_time
        self.position += self.velocity * delta_time
        self.force = Vector3()  # Reset force for next iteration

        if self.blender_object:
            self.blender_object.location = self.position.to_tuple()

    def create_blender_object(self):
        """Creates a sphere in Blender to represent the node."""
        radius = max(0.01, self.file_size / SIZE_SCALE) # Calculate radius based on file size
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=self.position.to_tuple())
        obj = bpy.context.object
        obj.name = self.name
        self.blender_object = obj

