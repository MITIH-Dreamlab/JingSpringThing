"""
Node Class
This module contains the Node class that represents a node in the Logseq graph.
"""

from typing import Optional
from .vector3 import Vector3
import bpy

class Node:
    """
    Represents a node in the graph.

    Attributes:
        id (int): Node identifier.
        name (str): Node name.
        position (Vector3): Node position in 3D space.
        weight (float): Node weight.
        velocity (Vector3): Node velocity in 3D space.
        pined (bool): Whether the node is pinned in the graph.
        cluster_visited (bool): Whether the node has been visited by the cluster algorithm.
        clustered (bool): Whether the node is part of a cluster.
        blender_object (bpy.types.Object): Corresponding Blender object.
        page_content (str): Content of the corresponding Logseq markdown file.
        is_public (bool): Whether the node is public based on its content.
    """

    def __init__(self, node_id: int, name: str, position: Vector3, weight: float = 1.0):
        """
        Initializes a Node object.

        Args:
            node_id (int): Node identifier.
            name (str): Node name.
            position (Vector3): Node position.
            weight (float): Node weight.
        """
        self.id = node_id
        self.name = name
        self.position = position
        self.weight = weight
        self.velocity = Vector3(0, 0, 0)
        self.pined = False
        self.cluster_visited = False
        self.clustered = False
        self.blender_object: bpy.types.Object = None
        self.page_content: str = ""
        self.is_public: bool = False

    def load_data_from_logseq(self, file_path: str):
        """
        Loads node data from a Logseq markdown file.

        Args:
            file_path (str): Path to the markdown file.
        """
        def is_page_public(page_content: str) -> bool:
            """
            Detects if a Logseq page is public based on its Markdown content.

            Args:
                page_content (str): Content of the markdown file.

            Returns:
                bool: True if the page is public, False otherwise.
            """
            for line in page_content.splitlines():
                if line.strip().startswith("public::"):
                    value = line.split("::")[1].strip()
                    return value.lower() == "true"
            return False

        with open(file_path, 'r', encoding='utf-8') as f:
            self.page_content = f.read()
        self.is_public = is_page_public(self.page_content)

    def distance_to(self, other: "Node") -> float:
        """
        Calculates the distance to another Node object.

        Args:
            other (Node): The other node.

        Returns:
            float: The distance to the other node.
        """
        return self.position.distance_to(other.position)

    def zero_force(self):
        """Placeholder method to reset any accumulated forces on the node."""
        pass

    def calculate_motion(self, delta_time: float):
        """
        Calculates the motion of the node based on forces acting on it.

        Args:
            delta_time (float): The time step for the simulation.
        """
        if not self.pined:
            pass  # Implement motion calculation logic

    def update_blender_object(self):
        """Updates the corresponding Blender object to reflect any changes in position."""
        if self.blender_object:
            self.blender_object.location = self.position.to_blender_vector()
