"""
Cluster Controller
This module contains the ClusterController class to manage cluster detection and visualization.
"""

from ..models.world import World
from ..models.node import Node
from ..models.cluster import Cluster

class ClusterController:
    """
    Handles cluster detection and management.

    Attributes:
        _world (World): The world to manage clusters within.
    """

    def __init__(self, world: World):
        """
        Initializes a ClusterController object.

        Args:
            world (World): The world to manage clusters within.
        """
        self._world = world

    def check_if_cluster(self, node: Node):
        """
        Checks if the given node belongs to a cluster and handles cluster creation.

        Args:
            node (Node): The node to check for cluster membership.
        """
        node.cluster_visited = True
        if not node.phantom:  # Assuming you might use 'phantom' later
            cluster = self._region(node)
            if len(cluster) >= 3:
                temp_cluster = Cluster()
                temp_cluster.nodes.append(node)

                for item in cluster:
                    if not item.cluster_visited:
                        item.cluster_visited = True
                        temp = self._region(item)
                        if len(temp) >= 3:
                            cluster.extend(temp)

                    if not item.clustered:
                        item.clustered = True
                        temp_cluster.nodes.append(item)

                if len(temp_cluster.nodes) >= 3:
                    self._world.clusters.append(temp_cluster)

    def _region(self, node: Node) -> list:
        """
        Finds the region of nodes connected to the given node.

        Args:
            node (Node): The starting node.

        Returns:
            list: List of connected nodes.
        """
        cluster = []
        for n in self._world.nodes.values():
            if not n.phantom:  # Assuming you might use 'phantom' later
                if n != node and node.distance_to(n) < 0.15:
                    cluster.append(n)
        return cluster

    def find_clusters(self):
        """Finds and groups nodes into clusters."""
        for node in self._world.nodes.values():
            if not node.cluster_visited:
                self.check_if_cluster(node)
