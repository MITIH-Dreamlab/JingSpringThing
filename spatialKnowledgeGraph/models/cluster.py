"""
Cluster Class
This module contains the Cluster class representing a cluster of interconnected nodes.
"""

from typing import List
from .node import Node
from .vector3 import Vector3

class Cluster:
    """
    Represents a cluster of nodes in the graph.

    Attributes:
        nodes (List[Node]): List of nodes in the cluster.
    """

    def __init__(self):
        """Initializes a Cluster object."""
        self.nodes: List[Node] = []

    def visualize_cluster(self):
        """Placeholder method to visualize the cluster in Blender."""
        pass
        
    def calculate_centroid(self) -> Vector3:
        """
        Calculates the centroid of the cluster.

        Returns:
            Vector3: The centroid of the cluster.
        """
        x = sum(node.position.x for node in self.nodes) / len(self.nodes)
        y = sum(node.position.y for node in self.nodes) / len(self.nodes)
        z = sum(node.position.z for node in self.nodes) / len(self.nodes)
        return Vector3(x, y, z)
