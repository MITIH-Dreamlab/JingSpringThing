"""
Project: Spatial Knowledge Graph Visualization in Blender
File: vector3.py

Description: This module defines the Vector3 and Quaternion classes, which provide
             helper functions for 3D vector math, used for calculating positions,
             directions, and rotations in the visualization.
"""

import numpy as np
from mathutils import Quaternion as BQuaternion # Blender's quaternion class

# Constant for scaling node positions
POSITION_SCALE = 10.0

class Vector3:
    """
    Represents a 3D vector and provides common vector operations.
    """
    def __init__(self, x=0, y=0, z=0):
        """
        Initializes a Vector3 object.

        Args:
            x (float): The x-component of the vector.
            y (float): The y-component of the vector.
            z (float): The z-component of the vector.
        """
        self.x = x / POSITION_SCALE
        self.y = y / POSITION_SCALE
        self.z = z / POSITION_SCALE

    def __add__(self, other):
        """Adds two Vector3 objects."""
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other):
        """Subtracts two Vector3 objects."""
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, scalar):
        """Multiplies a Vector3 object by a scalar."""
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)

    def __iadd__(self, other):
        """Adds another Vector3 object to this one in place."""
        self.x += other.x
        self.y += other.y
        self.z += other.z
        return self

    def length(self):
        """Returns the length (magnitude) of the vector."""
        return np.sqrt(self.x ** 2 + self.y ** 2 + self.z ** 2)

    def to_tuple(self):
        """Converts the Vector3 object to a tuple (x, y, z)."""
        return (self.x, self.y, self.z)

    def normalize(self):
        """Normalizes the vector (makes its length 1)."""
        l = self.length()
        return Vector3(self.x / l, self.y / l, self.z / l) if l != 0 else Vector3(0, 0, 0)

    def rotation_difference(self, other):
        """Calculates the rotation difference between this vector and another."""
        v1 = self.normalize()
        v2 = other.normalize()
        dot = np.dot(v1.to_tuple(), v2.to_tuple())
        cross = np.cross(v1.to_tuple(), v2.to_tuple())
        angle = np.arccos(dot)
        axis = Vector3(*cross).normalize()
        return Quaternion(axis, angle)

    def to_euler(self):
        """Converts this Vector3 (treated as an axis and angle) to Euler angles."""
        # Assumes self represents an axis of rotation and you have an angle (from rotation_difference)
        return (self.x, self.y, self.z) 

class Quaternion:
    """
    Represents a quaternion for 3D rotations.
    Uses Blender's built-in mathutils.Quaternion for calculations.
    """
    def __init__(self, axis: Vector3, angle: float):
        """
        Initializes a Quaternion object.

        Args:
            axis (Vector3): The axis of rotation.
            angle (float): The angle of rotation in radians.
        """
        self.axis = axis
        self.angle = angle

    def to_euler(self):
        """Converts the quaternion to Euler angles (in radians)."""
        # Use Blender's Quaternion class (BQuaternion) for accurate conversion
        return BQuaternion((1, 0, 0, 0)).slerp(BQuaternion(self.axis.to_tuple(), self.angle), 1).to_euler()

