"""
Main Module
This module integrates all components and runs the simulation.
"""

import os
from models.world import World
from controllers.data_fetcher import fetch_logseq_data_from_github
from controllers.simulation_controller import SimulationController
from controllers.cluster_controller import ClusterController
from views.blender_view import create_blender_objects, update_blender_objects

# Constants
GITHUB_REPO_URL = "https://github.com/yourusername/yourrepo/archive/refs/heads/main.zip"
LOCAL_EXTRACT_PATH = "/path/to/local/logseq_directory"
SIMULATION_STEPS = 100
DELTA_TIME = 0.01

def main():
    # Fetch Logseq data from GitHub
    fetch_logseq_data_from_github(GITHUB_REPO_URL, LOCAL_EXTRACT_PATH)

    # Load data into the world
    world = World()
    world.load_logseq_data(LOCAL_EXTRACT_PATH)

    # Create Blender objects
    create_blender_objects(world)

    # Run the simulation
    simulation_controller = SimulationController(world)
    simulation_controller.run(SIMULATION_STEPS, DELTA_TIME)

    # Update Blender objects
    update_blender_objects(world)
