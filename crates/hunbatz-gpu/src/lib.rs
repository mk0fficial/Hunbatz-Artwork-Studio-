use std::sync::Arc;
use wgpu::util::DeviceExt;

pub struct GpuRenderer<'window> {
    pub surface: wgpu::Surface<'window>,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub config: wgpu::SurfaceConfiguration,
}

impl<'window> GpuRenderer<'window> {
    pub async fn new(
        target: impl Into<wgpu::SurfaceTarget<'window>>,
        width: u32,
        height: u32,
    ) -> Self {
        // Automatically picks Vulkan (Android/Linux), Metal (iOS/iPadOS/Mac), DX12 (Windows)
        // with automatic fallback to OpenGL ES for older tablets/Linux GPUs.
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        let surface = instance.create_surface(target).expect("Failed to create GPU surface");
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .expect("No compatible GPU adapter found");

        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor::default(), None)
            .await
            .expect("Failed to acquire GPU device");

        let caps = surface.get_capabilities(&adapter);
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: caps.formats[0],
            width: width.max(1),
            height: height.max(1),
            present_mode: wgpu::PresentMode::Fifo, // VSync / 120Hz ProMotion & S-Pen sync
            alpha_mode: caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 1, // Minimal stylus-to-photon latency
        };
        surface.configure(&device, &config);

        Self { surface, device, queue, config }
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if width > 0 && height > 0 {
            self.config.width = width;
            self.config.height = height;
            self.surface.configure(&self.device, &self.config);
        }
    }
}
