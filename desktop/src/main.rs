#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use include_dir::{include_dir, Dir};
use std::borrow::Cow;
use tao::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::WindowBuilder,
};
use wry::{http::Response, WebViewBuilder};

static DIST_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../dist");

fn mime_type(path: &str) -> &'static str {
    if path.ends_with(".html") {
        "text/html"
    } else if path.ends_with(".js") || path.ends_with(".mjs") {
        "application/javascript"
    } else if path.ends_with(".css") {
        "text/css"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".wasm") {
        "application/wasm"
    } else if path.ends_with(".onnx") {
        "application/octet-stream"
    } else if path.ends_with(".json") {
        "application/json"
    } else {
        "application/octet-stream"
    }
}

fn main() -> wry::Result<()> {
    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title("Hunbatz Artwork Studio")
        .with_inner_size(tao::dpi::LogicalSize::new(1360.0, 860.0))
        .build(&event_loop)
        .expect("Failed to create window");

    let builder = WebViewBuilder::new()
        .with_custom_protocol("hunbatz".into(), |_webview_id, request| {
            let uri_path = request.uri().path().trim_start_matches('/');
            let path = if uri_path.is_empty() {
                "index.html"
            } else {
                uri_path
            };

            let file = DIST_DIR
                .get_file(path)
                .or_else(|| DIST_DIR.get_file("index.html"));

            match file {
                Some(f) => Response::builder()
                    .header("Content-Type", mime_type(f.path().to_str().unwrap_or(path)))
                    .body(Cow::Borrowed(f.contents()))
                    .unwrap(),
                None => Response::builder()
                    .status(404)
                    .body(Cow::Borrowed(b"Not Found" as &[u8]))
                    .unwrap(),
            }
        })
        .with_url("hunbatz://localhost/index.html");

    #[cfg(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    ))]
    let _webview = builder.build(&window)?;

    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    )))]
    let _webview = {
        use tao::platform::unix::WindowExtUnix;
        use wry::WebViewBuilderExtUnix;
        let vbox = window.default_vbox().unwrap();
        builder.build_gtk(vbox)?
    };

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            *control_flow = ControlFlow::Exit;
        }
    });
}
