import os
import re
import yaml
import json
import sys

# Custom exception class for specific error handling in the module
class MarkdownParseException(Exception):
    pass

# Node class represents each node in the knowledge graph
class Node:
    def __init__(self, id, name, content):
        self.id = id
        self.name = name
        self.content = content
        self.edges = []

    def to_dict(self):
        """Convert Node object to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'content': self.content,
            'edges': [edge.to_dict() for edge in self.edges]
        }

# Edge class represents relationships in the knowledge graph
class Edge:
    def __init__(self, source, target, link_type):
        self.source = source
        self.target = target
        self.link_type = link_type

    def to_dict(self):
        """Convert Edge object to dictionary"""
        return {
            'source': self.source,
            'target': self.target,
            'link_type': self.link_type
        }

def parse_markdown_file(file_path):
    """
    Parse a markdown file to extract metadata, links, and content.
    
    Args:
        file_path (str): Path to the markdown file.
    
    Returns:
        tuple: metadata (dict), links (list), content (str)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Extract front matter (YAML)
        front_matter = re.search(r'^---(.*?)---', content, re.DOTALL)
        if front_matter:
            front_matter_content = front_matter.group(1)
            metadata = yaml.safe_load(front_matter_content)
            content = content.replace(front_matter.group(0), '')
        else:
            metadata = {}
        
        # Extract links in the markdown content
        links = re.findall(r'\[\[([^\]]+)\]\]', content)

        return metadata, links, content
    except (IOError, yaml.YAMLError) as e:
        print(f"Error parsing file {file_path}: {e}")
        raise MarkdownParseException(f"Error parsing file {file_path}: {e}")

def create_graph_from_logseq(directory):
    """
    Parse all markdown files in the given directory to create a graph structure from Logseq.

    Args:
        directory (str): Path to the directory containing markdown files.

    Returns:
        tuple: nodes (dict), edges (list)
    """
    nodes = {}
    edges = []

    def parse_folder(folder):
        """Parse all markdown files in a given folder"""
        for filename in os.listdir(folder):
            if filename.endswith('.md'):
                file_path = os.path.join(folder, filename)
                print(f"Parsing file: {file_path}")
                metadata, links, content = parse_markdown_file(file_path)
                print(f"Metadata: {metadata}")
                print(f"Links: {links}")

                node_id = metadata.get('id', filename)
                node_name = metadata.get('title', filename.replace('.md', ''))
                node = Node(node_id, node_name, content)
                nodes[node_id] = node

                for link in links:
                    target_node_name = link
                    edge = Edge(node_id, target_node_name, 'link')
                    node.edges.append(edge)
                    edges.append(edge)

    journals_folder = os.path.join(directory, 'journals')
    pages_folder = os.path.join(directory, 'pages')

    if os.path.exists(journals_folder):
        parse_folder(journals_folder)

    if os.path.exists(pages_folder):
        parse_folder(pages_folder)

    return nodes, edges

def save_to_json(nodes, edges, nodes_file_path, edges_file_path):
    """
    Save nodes and edges to JSON files.

    Args:
        nodes (dict): Dictionary of Node objects.
        edges (list): List of Edge objects.
        nodes_file_path (str): Path to the output nodes JSON file.
        edges_file_path (str): Path to the output edges JSON file.
    """
    try:
        nodes_list = [node.to_dict() for node in nodes.values()]
        edges_list = [edge.to_dict() for edge in edges]

        with open(nodes_file_path, 'w', encoding='utf-8') as nodes_file:
            json.dump(nodes_list, nodes_file, ensure_ascii=False, indent=4)

        with open(edges_file_path, 'w', encoding='utf-8') as edges_file:
            json.dump(edges_list, edges_file, ensure_ascii=False, indent=4)
    except (IOError, TypeError) as e:
        print(f"Error saving to JSON file: {e}")
        raise

if __name__ == "__main__":
    # Ensure the script is run with a directory argument
    if len(sys.argv) != 2:
        print("Usage: python parse_markdown_to_json.py <directory>")
        sys.exit(1)

    # Get the directory from command line argument
    logseq_directory = sys.argv[1]

    # Validate directory
    if not os.path.isdir(logseq_directory):
        print(f"Error: {logseq_directory} is not a valid directory")
        sys.exit(1)

    try:
        nodes, edges = create_graph_from_logseq(logseq_directory)
        print(f"Nodes: {nodes}")
        print(f"Edges: {edges}")

        # Save nodes and edges to JSON files
        nodes_file_path = 'nodes.json'
        edges_file_path = 'edges.json'
        save_to_json(nodes, edges, nodes_file_path, edges_file_path)
    except MarkdownParseException as e:
        print(f"Failed to parse markdown files: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
