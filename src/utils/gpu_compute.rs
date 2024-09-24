// gpu_compute.rs

use wgpu::{Device, Queue, Buffer, ShaderModule, BindGroup, ComputePipeline, BindGroupLayout};
use std::io::Error;
use futures::executor::block_on;
use log::{info, error};

/// Manages GPU computations for force-directed graph layout using WebGPU.
pub struct GPUCompute {
    device: Device,
    queue: Queue,
    nodes_buffer: Buffer,
    edges_buffer: Buffer,
    simulation_params_buffer: Buffer,
    bind_group: BindGroup,
    compute_pipeline: ComputePipeline,
}

impl GPUCompute {
    /// Initialises the GPUCompute instance by setting up the GPU device, buffers, and pipeline.
    pub async fn initialize_gpu(&mut self) -> Result<(), Error> {
        // Initialize the GPU instance.
        let instance = wgpu::Instance::default();

        // Request an adapter.
        let adapter = instance.request_adapter(
            &wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            },
        ).await.ok_or_else(|| {
            error!("Failed to find a suitable GPU adapter.");
            Error::from(std::io::Error::new(std::io::ErrorKind::Other, "No suitable GPU adapter found"))
        })?;

        // Request the device and queue.
        let (device, queue) = adapter.request_device(
            &wgpu::DeviceDescriptor {
                label: Some("Compute Device"),
                features: wgpu::Features::empty(),
                limits: wgpu::Limits::default(),
            },
            None,
        ).await.map_err(|e| {
            error!("Failed to create device: {}", e);
            Error::from(std::io::Error::new(std::io::ErrorKind::Other, "Device creation failed"))
        })?;

        // Create shader modules.
        let shader_module = device.create_shader_module(&wgpu::ShaderModuleDescriptor {
            label: Some("Force Calculation Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("force_calculation.wgsl").into()),
        });

        // Create buffers (example sizes; adjust as necessary).
        let nodes_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Nodes Buffer"),
            size: 1024, // Adjust size based on number of nodes.
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        let edges_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Edges Buffer"),
            size: 512, // Adjust size based on number of edges.
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let simulation_params_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Simulation Params Buffer"),
            contents: bytemuck::cast_slice(&[
                60.0_f32, // repulsion_strength
                0.15_f32, // attraction_strength
                0.98_f32, // damping
                0.016_f32, // delta_time (~60 FPS)
            ]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Create bind group layout.
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Compute Bind Group Layout"),
            entries: &[
                // Nodes buffer
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                // Edges buffer
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                // Simulation params buffer
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        // Create bind group.
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Compute Bind Group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: nodes_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: edges_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: simulation_params_buffer.as_entire_binding(),
                },
            ],
        });

        // Create compute pipeline.
        let compute_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Compute Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Force Calculation Pipeline"),
            layout: Some(&compute_pipeline_layout),
            module: &shader_module,
            entry_point: "main",
        });

        // Assign the initialized components to the struct.
        self.device = device;
        self.queue = queue;
        self.nodes_buffer = nodes_buffer;
        self.edges_buffer = edges_buffer;
        self.simulation_params_buffer = simulation_params_buffer;
        self.bind_group = bind_group;
        self.compute_pipeline = compute_pipeline;

        info!("GPU Compute initialized successfully.");

        Ok(())
    }

    /// Performs force calculations on the GPU.
    pub fn compute_forces(&self) -> Result<(), Error> {
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Compute Encoder"),
        });

        {
            let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Compute Pass"),
            });
            cpass.set_pipeline(&self.compute_pipeline);
            cpass.set_bind_group(0, &self.bind_group, &[]);
            cpass.dispatch_workgroups(1, 1, 1); // Adjust based on data size.
        }

        self.queue.submit(Some(encoder.finish()));
        info!("Force calculations dispatched to GPU.");

        Ok(())
    }

    /// Updates node positions based on computed velocities.
    pub fn update_positions(&self) -> Result<(), Error> {
        // This function can be implemented similarly to compute_forces,
        // potentially with a different shader if separate computation is needed.
        // For simplicity, we'll assume positions are updated within the same compute shader.

        // If a separate shader is required, load it and create a new pipeline accordingly.

        // For now, reuse compute_forces.
        self.compute_forces()
    }
}
