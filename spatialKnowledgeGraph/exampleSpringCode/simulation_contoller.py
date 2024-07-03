"""
Simulation Controller
This module contains the SimulationController class to manage the simulation execution.
"""

from ..models.world import World

class SimulationController:
    """
    Manages the execution of the simulation.

    Attributes:
        world (World): The world to simulate.
    """

    def __init__(self, world: World):
        """
        Initializes a SimulationController object.

        Args:
            world (World): The world to simulate.
        """
        self.world = world

    def run(self, steps: int, delta_time: float):
        """
        Runs the simulation.

        Args:
            steps (int): Number of simulation steps.
            delta_time (float): Time step for the simulation.
        """
        self.world.run_simulation(steps, delta_time)
