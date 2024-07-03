"""
Blender View
This module contains functions to visualize the spatial knowledge graph in Blender.
"""

import bpy
from ..models.vector3 import Vector3
from ..models.world import World

def create_blender_objects(world: World):
    """
    Creates Blender objects for each node in the world.

    Args:
        world (World): The world containing nodes and edges.
    """
    for node in world.nodes.values():
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.05, location=node.position.to_blender_vector())
        node.blender_object = bpy.context.object
        node.blender_object.name = node.name

def update_blender_objects(world: World):
    """
    Updates Blender objects to reflect changes in the simulation.

    Args:
        world (World): The world containing nodes and edges.
    """
    for node in world.nodes.values():
        node.update_blender_object()
