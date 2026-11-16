use glam::Vec2;

#[derive(Debug, Clone, Copy)]
pub struct PenSample {
    pub position: Vec2,
    pub pressure: f32,
    pub tilt: Vec2,
    pub barrel_roll: f32,
    pub timestamp_ms: u64,
}

pub struct Layer {
    pub id: u64,
    pub name: String,
    pub opacity: f32,
    pub visible: bool,
    pub width: u32,
    pub height: u32,
    /// Raw RGBA8 tile buffer (offloaded/compressed when inactive)
    pub pixels: Vec<u8>,
}

pub struct Document {
    pub width: u32,
    pub height: u32,
    pub layers: Vec<Layer>,
    pub active_layer: usize,
}

impl Document {
    pub fn new(width: u32, height: u32) -> Self {
        let base_layer = Layer {
            id: 1,
            name: "Layer 1".to_string(),
            opacity: 1.0,
            visible: true,
            width,
            height,
            pixels: vec![0; (width * height * 4) as usize],
        };
        Self {
            width,
            height,
            layers: vec![base_layer],
            active_layer: 0,
        }
    }

    pub fn apply_pen_sample(&mut self, sample: PenSample, color: [u8; 4], radius: f32) {
        let Some(layer) = self.layers.get_mut(self.active_layer) else { return };
        let r = (radius * sample.pressure.max(0.05)).ceil() as i32;
        let cx = sample.position.x as i32;
        let cy = sample.position.y as i32;

        for dy in -r..=r {
            for dx in -r..=r {
                if dx * dx + dy * dy <= r * r {
                    let px = cx + dx;
                    let py = cy + dy;
                    if px >= 0 && py >= 0 && (px as u32) < layer.width && (py as u32) < layer.height {
                        let idx = ((py as u32 * layer.width + px as u32) * 4) as usize;
                        layer.pixels[idx..idx + 4].copy_from_slice(&color);
                    }
                }
            }
        }
    }
}
