use hunbatz_core::{Document, PenSample};
use glam::Vec2;
use std::sync::Mutex;

uniffi::setup_scaffolding!();

#[derive(uniffi::Object)]
pub struct HunbatzEngine {
    doc: Mutex<Document>,
}

#[uniffi::export]
impl HunbatzEngine {
    #[uniffi::constructor]
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            doc: Mutex::new(Document::new(width, height)),
        }
    }

    pub fn on_pen_input(&self, x: f32, y: f32, pressure: f32, tilt_x: f32, tilt_y: f32) {
        if let Ok(mut doc) = self.doc.lock() {
            doc.apply_pen_sample(
                PenSample {
                    position: Vec2::new(x, y),
                    pressure,
                    tilt: Vec2::new(tilt_x, tilt_y),
                    barrel_roll: 0.0,
                    timestamp_ms: 0,
                },
                [20, 20, 25, 255],
                12.0,
            );
        }
    }
}
