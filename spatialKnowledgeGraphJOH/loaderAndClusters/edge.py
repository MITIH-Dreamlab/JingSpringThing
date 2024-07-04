"""
Project: Spatial Knowledge Graph Visualization in Blender
File: edge.py

Description: This module defines the Edge class, which represents a connection
             (edge) between two nodes in the knowledge graph. It handles edge properties,
             including its connection to nodes and the creation of the visual
             cylinder representation in Blender.
"""

import bpy
from vector3 import Vector3 

# Constant for scaling edge resting lengths
EDGE_SCALE = 10.0

class Edge:
    """
    Represents a connection (edge) between two nodes in the graph.
    """
    def __init__(self, start_node, end_node):
        """
        Initializes an Edge object.

        Args:
            start_node (Node): The starting Node object of the edge.
            end_node (Node): The ending Node object of the edge. 
        """
        self.start_node = start_node
        self.end_node = end_node
        self.rest_length = ((start_node.file_size + end_node.file_size) * 0.1 / EDGE_SCALE)  # Calculate rest length
        self.blender_object = None  # Reference to the Blender cylinder object

    def apply_spring_force(self):
        """Applies spring forces to the connected nodes, simulating edge tension."""
        direction = self.end_node.position - self.start_node.position  # Vector from start to end
        distance = direction.length()

        if distance == 0:  # Avoid division by zero if nodes are at the same position
            return 

        force_magnitude = (distance - self.rest_length) * 0.01  # Hooke's Law (spring constant = 0.01)
        force = direction.normalize() * force_magnitude 

        # Apply force to start node (opposite direction)
        self.start_node.apply_force(-force) 
        # Apply force to end node
        self.end_node.apply_force(force)  

    def update_blender_object(self):
        """Updates the Blender cylinder object's position, scale, and rotation."""
        if self.blender_object:
            start_loc = self.start_node.position.to_tuple()
            end_loc = self.end_node.position.to_tuple()

            # 1. Set cylinder location (midpoint of the edge)
            mid_point = [(s + e) / 2 for s, e in zip(start_loc, end_loc)]
            self.blender_object.location = mid_point

            # 2. Scale cylinder length (Z-axis)
            direction = Vector3(*end_loc) - Vector3(*start_loc)
            distance = direction.length()
            self.blender_object.scale = (0.005, 0.005, distance / 2)

            # 3. Rotate cylinder to align with the edge
            v1 = Vector3(0, 0, 1)  # Blender's default cylinder orientation
            v2 = direction.normalize()
            rot_diff = v1.rotation_difference(v2)
            self.blender_object.rotation_euler = rot_diff.to_euler()

    def create_blender_object(self):
        """Creates a cylinder in Blender to represent the edge."""
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.005, 
            depth=1, 
            location=(0, 0, 0)  # Temporary location, we'll update it
        )
        obj = bpy.context.object
        obj.name = f"{self.start_node.name}_to_{self.end_node.name}"
        self.blender_object = obj
        self.update_blender_object()  # Update position, scale, and rotation

