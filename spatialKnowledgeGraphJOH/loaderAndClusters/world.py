"""
Project: Spatial Knowledge Graph Visualization in Blender
File: world.py

Description: This file contains the World class, which represents the entire knowledge graph.
             It manages nodes and edges, handles data loading from JSON,
             and controls the force-directed layout simulation.
"""

import bpy
import os
import json
from vector3 import Vector3
from edge import Edge
from node import Node
from markdown_parser import parse_markdown_files, save_to_json 

# Constant for scaling edge lengths
EDGE_SCALE = 10.0

class World:
    """
    Represents the entire knowledge graph and manages nodes and edges.
    """
    def __init__(self):
        """Initializes the World object with empty dictionaries for nodes and edges."""
        self.nodes = {}  # Dictionary to store nodes, keyed by node ID
        self.edges = []  # List to store edges

    def add_node(self, node):
        """Adds a Node object to the world's node dictionary."""
        self.nodes[node.id] = node

    def add_edge(self, edge):
        """Adds an Edge object to the world's edge list."""
        self.edges.append(edge)

    def load_logseq_data(self, folder_path):
        """
        Loads Logseq data by first parsing Markdown files and then loading the
        generated JSON data.

        Args:
            folder_path (str): Path to the folder containing your Markdown files.
        """
        try:
            # 1. Parse Markdown files and create JSON files
            nodes, edges = parse_markdown_files(folder_path)
            nodes_data = [node.to_dict() for node in nodes]
            edges_data = [edge.to_dict() for edge in edges]
            nodes_file_path = os.path.join(folder_path, 'nodes.json')
            edges_file_path = os.path.join(folder_path, 'edges.json')
            save_to_json(nodes_data, nodes_file_path)
            save_to_json(edges_data, edges_file_path)

            # 2. Load data from the generated JSON files
            with open(nodes_file_path, 'r', encoding='utf-8') as nodes_file:
                nodes_data = json.load(nodes_file)

            with open(edges_file_path, 'r', encoding='utf-8') as edges_file:
                edges_data = json.load(edges_file)

            # Create Node objects from JSON data
            for node_data in nodes_data:
                position = Vector3(*node_data['position'])
                node = Node(node_data['id'], node_data['name'], position, 
                            node_data['file_size'], len(node_data['link_types']))
                self.add_node(node)

            # Create Edge objects from JSON data
            for edge_data in edges_data:
                start_node = self.nodes.get(edge_data['start_node']) # Use .get() to avoid KeyError if node is not found
                end_node = self.nodes.get(edge_data['end_node'])
                if start_node and end_node: # Only create edge if both nodes exist
                    edge = Edge(start_node, end_node)
                    self.add_edge(edge)
                else:
                    print(f"Error: Could not find start or end node for edge {edge_data}")

            print(f"Nodes loaded: {len(self.nodes)}")
            print(f"Edges loaded: {len(self.edges)}")

        except (IOError, OSError, json.JSONDecodeError) as e:
            print(f"Error loading data: {e}")

    def run_simulation(self, steps, delta_time):
        """
        Runs the force-directed layout simulation to determine node positions.

        Args:
            steps (int): Number of simulation steps.
            delta_time (float): Time step for each iteration.
        """
        for _ in range(steps):
            # Apply spring forces from each edge
            for edge in self.edges:
                edge.apply_spring_force()

            # Update node positions based on the forces
            for node in self.nodes.values():
                node.update_position(delta_time)

            # Update Blender object transformations for each edge
            for edge in self.edges:
                edge.update_blender_object()

            # Update the Blender viewport
            bpy.context.view_layer.update()
            bpy.ops.wm.redraw_timer(type='DRAW_WIN_SWAP', iterations=1)

    def create_blender_objects(self):
        """
        Creates Blender objects for all nodes and edges in the graph. 
        """
        for node in self.nodes.values():
            node.create_blender_object()

        for edge in self.edges:
            edge.create_blender_object()

