import bpy
import math
import time

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def create_red_ball():
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(0, 0, 0))
    ball = bpy.context.object
    mat = bpy.data.materials.new(name="RedMaterial")
    mat.diffuse_color = (1.0, 0.0, 0.0, 1.0)  # RGBA red color
    ball.data.materials.append(mat)
    ball.name = "OscillatingBall"
    return ball

start_time = time.time()

def oscillate_ball():
    ball = bpy.data.objects.get("OscillatingBall")
    if ball is None:
        print("OscillatingBall not found.")
        return None  # Stops the timer if the ball is not found
    
    # Calculate elapsed time
    elapsed = time.time() - start_time
    cycle_time = 2.0  # seconds
    displacement = 1.0  # meters
    
    # Calculate the new x position based on a sine wave
    x_pos = displacement * math.sin((2 * math.pi / cycle_time) * elapsed)
    ball.location.x = x_pos
    
    bpy.context.view_layer.update()
    
    # Schedule the next call to this function after 10ms
    return 0.01

def main():
    print("Blender has been successfully launched and this script is running.")
    
    # Clear the scene
    clear_scene()
    print("Scene cleared.")
    
    # Create the red ball
    create_red_ball()
    print("Red ball created at origin.")
    
    # Schedule the oscillator function to run every 10ms
    bpy.app.timers.register(oscillate_ball)

if __name__ == "__main__":
    main()

