import os
import glob
import re
import json
import sys

class MarkdownParseException(Exception):
    pass

class Node:
    def __init__(self, id, name, position=(0, 0, 0), weight=1.0, velocity=(0, 0, 0), pinned=False, block_content='', link_types=[], file_size=0):
        self.id = id
        self.name = name
        self.position = position
        self.weight = weight
        self.velocity = velocity
        self.pinned = pinned
        self.block_content = block_content
        self.link_types = link_types
        self.file_size = file_size

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'position': self.position,
            'weight': self.weight,
            'velocity': self.velocity,
            'pinned': self.pinned,
            'block_content': self.block_content,
            'link_types': self.link_types,
            'file_size': self.file_size
        }

class Edge:
    def __init__(self, start_node, end_node, weight=1.0, is_active=True, link_type=''):
        self.start_node = start_node
        self.end_node = end_node
        self.weight = weight
        self.is_active = is_active
        self.link_type = link_type

    def to_dict(self):
        return {
            'start_node': self.start_node.id,
            'end_node': self.end_node.id,
            'weight': self.weight,
            'is_active': self.is_active,
            'link_type': self.link_type
        }

def parse_markdown_files(folder_path):
    nodes = []
    edges = []
    node_dict = {}

    for file_path in glob.glob(os.path.join(folder_path, '*.md')):
        try:
            print(f'Reading file: {file_path}')  # Debug statement
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
                if not content.strip():
                    print(f'Skipping empty file: {file_path}')  # Debug statement
                    continue

                file_name = os.path.basename(file_path)
                node_id = file_name
                node_name = file_name.split('.')[0]
                block_content = content
                link_types = re.findall(r'\[\[([^\]]+)\]\]', content)
                file_size = os.path.getsize(file_path)

                node = Node(
                    id=node_id,
                    name=node_name,
                    block_content=block_content,
                    link_types=link_types,
                    file_size=file_size
                )
                nodes.append(node)
                node_dict[node_name] = node

                for link in link_types:
                    if link in node_dict:
                        edges.append(Edge(start_node=node_dict[node_name], end_node=node_dict[link], link_type='link'))
                    else:
                        print(f"Link target '{link}' not found for node '{node_name}'")

        except (IOError, OSError) as e:
            print(f"Error reading file {file_path}: {e}")

    return nodes, edges

def save_to_json(data, file_path):
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f'Successfully saved JSON to {file_path}')  # Debug statement
    except (IOError, TypeError) as e:
        print(f"Error saving to JSON file: {e}")
        raise

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python new_parse_markdown_to_json.py <directory>")
        sys.exit(1)

    folder_path = sys.argv[1]

    if not os.path.isdir(folder_path):
        print(f"Error: {folder_path} is not a valid directory")
        sys.exit(1)

    try:
        nodes, edges = parse_markdown_files(folder_path)
        print(f"Nodes parsed: {len(nodes)}")
        print(f"Edges parsed: {len(edges)}")

        nodes_data = [node.to_dict() for node in nodes]
        edges_data = [edge.to_dict() for edge in edges]

        nodes_file_path = os.path.join(os.getcwd(), 'nodes.json')
        edges_file_path = os.path.join(os.getcwd(), 'edges.json')

        save_to_json(nodes_data, nodes_file_path)
        save_to_json(edges_data, edges_file_path)

        print(f"Extracted {len(nodes)} nodes and {len(edges)} edges. Data saved to '{nodes_file_path}' and '{edges_file_path}'.")
    except MarkdownParseException as e:
        print(f"Failed to parse markdown files: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

