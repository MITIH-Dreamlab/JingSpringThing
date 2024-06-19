"""
Vector3 Class
This module contains the Vector3 class that represents a 3D vector, which is fundamental for positioning nodes in 3D space.
"""

import math
from typing import Union

class Vector3:
    """
    Represents a 3D vector with basic operations.

    Attributes:
        x (float): x-coordinate.
        y (float): y-coordinate.
        z (float): z-coordinate.
    """

    def __init__(self, x: float = 0, y: float = 0, z: float = 0):
        """
        Initializes a Vector3 object.

        Args:
            x (float): x-coordinate.
            y (float): y-coordinate.
            z (float): z-coordinate.
        """
        self.x = x
        self.y = y
        self.z = z

    def distance_to(self, other: "Vector3") -> float:
        """
        Calculates the distance to another Vector3 object.

        Args:
            other (Vector3): The other vector.

        Returns:
            float: The distance to the other vector.
        """
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2 + (self.z - other.z)**2)

    def to_blender_vector(self) -> Union['Vector', 'Vector3']:
        """
        Converts the Vector3 to Blender's Vector type.

        Returns:
            bpy.types.Vector or Vector3: The Blender vector.
        """
        try:
            from bpy.types import Vector
            return Vector((self.x, self.y, self.z))
        except ImportError:
            return self

    def __add__(self, other: "Vector3") -> "Vector3":
        """
        Adds two Vector3 objects.

        Args:
            other (Vector3): The other vector.

        Returns:
            Vector3: The sum of the vectors.
        """
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other: "Vector3") -> "Vector3":
        """
        Subtracts another Vector3 object from this one.

        Args:
            other (Vector3): The other vector.

        Returns:
            Vector3: The difference between the vectors.
        """
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, scalar: float) -> "Vector3":
        """
        Multiplies the vector by a scalar.

        Args:
            scalar (float): The scalar value.

        Returns:
            Vector3: The resultant vector.
        """
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)

    def __str__(self) -> str:
        """
        Converts the vector to a string.

        Returns:
            str: The string representation of the vector.
        """
        return f"({self.x}, {self.y}, {self.z})"
      
