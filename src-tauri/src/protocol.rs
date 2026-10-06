//! `wallvid://` protocol: streams local video files to the webviews with HTTP
//! range support and CORS headers, so frames can be uploaded to WebGL
//! textures without tainting the canvas.

use crate::state::AppState;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::{AppHandle, Manager};

const CHUNK: u64 = 4 * 1024 * 1024;

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Some(b) = std::str::from_utf8(&bytes[i + 1..i + 3])
                .ok()
                .and_then(|h| u8::from_str_radix(h, 16).ok())
            {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn mime(path: &PathBuf) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("webm") => "video/webm",
        Some("mkv") => "video/webm",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        // .mov/.m4v are served as mp4 so Chromium attempts H.264 playback.
        _ => "video/mp4",
    }
}

fn reply(status: StatusCode, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(body)
        .unwrap()
}

pub fn handle(app: &AppHandle, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    if request.method() == "OPTIONS" {
        return Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range")
            .body(Vec::new())
            .unwrap();
    }
    let raw = request.uri().path().trim_start_matches('/');
    let path = PathBuf::from(percent_decode(raw));
    let st = app.state::<AppState>();
    if !st.is_media_allowed(&path) {
        return reply(StatusCode::FORBIDDEN, b"forbidden".to_vec());
    }
    let mut file = match std::fs::File::open(&path) {
        Ok(f) => f,
        Err(_) => return reply(StatusCode::NOT_FOUND, b"not found".to_vec()),
    };
    let len = file.metadata().map(|m| m.len()).unwrap_or(0);
    if len == 0 {
        return reply(StatusCode::OK, Vec::new());
    }

    let (mut start, mut end) = (0u64, len - 1);
    if let Some(range) = request.headers().get(header::RANGE).and_then(|v| v.to_str().ok()) {
        if let Some(spec) = range.strip_prefix("bytes=") {
            let first = spec.split(',').next().unwrap_or("");
            let mut it = first.splitn(2, '-');
            let a = it.next().unwrap_or("").trim();
            let b = it.next().unwrap_or("").trim();
            if a.is_empty() {
                // suffix range: last N bytes
                if let Ok(n) = b.parse::<u64>() {
                    start = len.saturating_sub(n);
                }
            } else {
                start = a.parse().unwrap_or(0);
                if let Ok(e) = b.parse::<u64>() {
                    end = e.min(len - 1);
                }
            }
        }
    }
    if start >= len {
        return Response::builder()
            .status(StatusCode::RANGE_NOT_SATISFIABLE)
            .header(header::CONTENT_RANGE, format!("bytes */{len}"))
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Vec::new())
            .unwrap();
    }
    end = end.min(start + CHUNK - 1);
    let n = (end - start + 1) as usize;
    let mut buf = vec![0u8; n];
    if file.seek(SeekFrom::Start(start)).is_err() || file.read_exact(&mut buf).is_err() {
        return reply(StatusCode::INTERNAL_SERVER_ERROR, b"read error".to_vec());
    }
    Response::builder()
        .status(StatusCode::PARTIAL_CONTENT)
        .header(header::CONTENT_TYPE, mime(&path))
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{len}"))
        .header(header::CONTENT_LENGTH, n.to_string())
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(buf)
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::percent_decode;
    #[test]
    fn decodes_windows_paths() {
        assert_eq!(percent_decode("C%3A%5CUsers%5Cme%5Cclip%20one.mp4"), "C:\\Users\\me\\clip one.mp4");
        assert_eq!(percent_decode("abc%2"), "abc%2");
    }
}
