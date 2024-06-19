"""
World Class
This module contains the World class that holds all nodes, edges, and clusters in the spatial knowledge graph.
"""

import os
from typing import Dict, List
from .node import Node
from .edge import Edge
from .cluster import Cluster
from .vector3 import Vector3

class World:
    """
    Represents the entire world or graph containing nodes and edges.

    Attributes:
        nodes (Dict[int, Node]): Dictionary of nodes in the graph.
        edges (List[Edge]): List of edges in the graph.
        clusters (List[Cluster]): List of clusters in the graph.
        total_potential_energy (float): Total potential energy of the system.
        total_kinetic_energy (float): Total kinetic energy of the system.
    """

    def __init__(self):
        """Initializes a World object."""
        self.nodes: Dict[int, Node] = {}
        self.edges: List[Edge] = []
        self.clusters: List[Cluster] = []
        self.total_potential_energy: float = 0.0
        self.total_kinetic_energy: float = 0.0

    def load_logseq_data(self, graph_dir: str):
        """
        Loads Logseq graph data from a directory.

        Args:
            graph_dir (str): Path to the directory containing Logseq data.
        """
        pages_dir = os.path.join(graph_dir, "pages")

        node_id_counter = 1
        for file_name in os.listdir(pages_dir):
            if file_name.endswith(".md"):
                file_path = os.path.join(pages_dir, file_name)
                node_name = file_name[:-3]  # Remove '.md' extension

                # Create a Node and load its data
                node = Node(node_id_counter, node_name, Vector3(0, 0, 0))
                node.load_data_from_logseq(file_path)
                
                # Only add public nodes to the World
                if node.is_public:
                    self.nodes[node_id_counter] = node
                    node_id_counter += 1

        # Placeholder for Edge Creation
        # Implement based on how you extract link information from Logseq data

    def run_simulation(self, steps: int, delta_time: float):
        """
        Runs the physics simulation for the specified number of steps.

        Args:
            steps (int): Number of simulation steps.
            delta_time (float): Time step for the simulation.
        """
        for _ in range(steps):
            for edge in self.edges:
                edge.calculate_force()
            for node in self.nodes.values():
                node.calculate_motion(delta_time)
                node.update_blender_object()
