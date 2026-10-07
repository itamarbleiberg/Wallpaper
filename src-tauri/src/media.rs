//! Media jobs: URL import via yt-dlp and "baking" a perfect loop with ffmpeg
//! (trim, speed, ping-pong / crossfade, frame interpolation, 4K upscale).

use crate::state::{AppState, JobHandle};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEvent {
    pub id: String,
    pub kind: String,
    pub status: String, // running | done | error | cancelled
    pub progress: f64,
    pub message: String,
    pub path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub ffmpeg: Option<String>,
    pub ffprobe: Option<String>,
    pub ytdlp: Option<String>,
    pub library_dir: String,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BakeRequest {
    pub input: String,
    pub in_point: f64,
    pub out_point: f64,
    pub speed: f64,
    pub loop_mode: String,     // loop | pingpong | crossfade
    pub crossfade: f64,        // seconds (output time)
    pub interpolation: String, // none | blend | motion
    pub upscale: String,       // none | 1440p | 4k
    pub sharpen: f64,          // 0..1.5
    pub encoder: String,       // x264 | nvenc | qsv | amf
    pub keep_audio: bool,
}

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn new_id(prefix: &str) -> String {
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{prefix}-{ms:x}-{}", COUNTER.fetch_add(1, Ordering::Relaxed))
}

fn exe(name: &str) -> String {
    if cfg!(windows) { format!("{name}.exe") } else { name.to_string() }
}

pub fn find_tool(app: &AppHandle, name: &str) -> Option<PathBuf> {
    let file = exe(name);
    let st = app.state::<AppState>();
    let mut candidates = vec![];
    if let Ok(res) = app.path().resource_dir() {
        candidates.push(res.join("resources").join("bin").join(&file));
        candidates.push(res.join("bin").join(&file));
    }
    candidates.push(st.tools_dir.join(&file));
    if let Ok(cur) = std::env::current_exe() {
        if let Some(dir) = cur.parent() {
            candidates.push(dir.join(&file));
        }
    }
    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            candidates.push(dir.join(&file));
        }
    }
    candidates.into_iter().find(|p| p.is_file())
}

pub fn tool_status(app: &AppHandle) -> ToolStatus {
    let s = |n| find_tool(app, n).map(|p| p.to_string_lossy().to_string());
    ToolStatus {
        ffmpeg: s("ffmpeg"),
        ffprobe: s("ffprobe"),
        ytdlp: s("yt-dlp"),
        library_dir: app.state::<AppState>().library_dir.to_string_lossy().to_string(),
    }
}

fn command(path: &Path) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    c
}

fn emit(app: &AppHandle, id: &str, kind: &str, status: &str, progress: f64, message: &str, path: Option<String>) {
    let _ = app.emit(
        "job-progress",
        JobEvent {
            id: id.into(),
            kind: kind.into(),
            status: status.into(),
            progress,
            message: message.into(),
            path,
        },
    );
}

fn register(app: &AppHandle, id: &str) -> JobHandle {
    let h: JobHandle = Arc::new(Mutex::new(None));
    app.state::<AppState>().jobs.lock().unwrap().insert(id.to_string(), h.clone());
    h
}

fn finish(app: &AppHandle, id: &str) -> bool {
    // Returns true if the job was cancelled (removed by cancel_job).
    app.state::<AppState>().jobs.lock().unwrap().remove(id).is_none()
}

pub fn cancel(app: &AppHandle, id: &str) {
    if let Some(h) = app.state::<AppState>().jobs.lock().unwrap().remove(id) {
        if let Some(child) = h.lock().unwrap().as_mut() {
            let _ = child.kill();
        }
    }
}

/// Ensure a built-in nature clip is on disk; download it once if missing.
/// `preset_id` gives a stable filename so each clip is fetched only once.
/// Returns the local path immediately if cached, else starts a job and returns
/// an empty path with `job_id` set so the UI can show progress.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NatureResult {
    pub path: String,
    pub job_id: Option<String>,
}

pub fn ensure_nature(app: &AppHandle, preset_id: String, url: String) -> Result<NatureResult, String> {
    let dir = app.state::<AppState>().library_dir.join("nature");
    let _ = std::fs::create_dir_all(&dir);
    let safe: String = preset_id.chars().filter(|c| c.is_alphanumeric() || *c == '-').collect();
    let dest = dir.join(format!("{safe}.mp4"));
    if dest.is_file() && std::fs::metadata(&dest).map(|m| m.len() > 1024).unwrap_or(false) {
        return Ok(NatureResult { path: dest.to_string_lossy().to_string(), job_id: None });
    }
    let ytdlp = find_tool(app, "yt-dlp");
    let ffmpeg = find_tool(app, "ffmpeg");
    let id = new_id("nat");
    let handle = register(app, &id);
    let app2 = app.clone();
    let jid = id.clone();
    std::thread::spawn(move || {
        emit(&app2, &jid, "download", "running", 0.0, "Fetching nature clip…", None);
        let tmp = dest.with_extension("part.mp4");
        let ok = if let Some(yt) = &ytdlp {
            // Prefer yt-dlp: handles direct links and most providers, caps at 2160p.
            let mut cmd = command(yt);
            cmd.args(["--no-playlist", "--newline", "--no-part", "-f", "bv*[height<=2160][ext=mp4]/b[ext=mp4]/b", "-o"]).arg(&tmp);
            if let Some(f) = &ffmpeg {
                cmd.arg("--ffmpeg-location").arg(f);
            }
            cmd.arg(&url).stdout(Stdio::piped()).stderr(Stdio::piped());
            match cmd.spawn() {
                Ok(mut child) => {
                    if let Some(out) = child.stdout.take() {
                        for line in BufReader::new(out).lines().map_while(Result::ok) {
                            if let Some(pct) = line.split_whitespace().find(|w| w.ends_with('%')) {
                                if let Ok(p) = pct.trim_end_matches('%').parse::<f64>() {
                                    emit(&app2, &jid, "download", "running", p / 100.0, "Fetching nature clip…", None);
                                }
                            }
                        }
                    }
                    *handle.lock().unwrap() = Some(child);
                    handle.lock().unwrap().as_mut().and_then(|c| c.wait().ok()).map(|s| s.success()).unwrap_or(false)
                }
                Err(_) => false,
            }
        } else if let Some(ff) = &ffmpeg {
            // Fallback: ffmpeg can pull a direct https mp4.
            let mut cmd = command(ff);
            cmd.args(["-hide_banner", "-loglevel", "error", "-y", "-i"]).arg(&url).args(["-c", "copy"]).arg(&tmp);
            cmd.spawn().and_then(|mut c| c.wait()).map(|s| s.success()).unwrap_or(false)
        } else {
            false
        };
        if finish(&app2, &jid) {
            let _ = std::fs::remove_file(&tmp);
            return emit(&app2, &jid, "download", "cancelled", 0.0, "Cancelled", None);
        }
        if ok && tmp.is_file() && std::fs::rename(&tmp, &dest).is_ok() {
            emit(&app2, &jid, "download", "done", 1.0, "Ready", Some(dest.to_string_lossy().to_string()));
        } else {
            let _ = std::fs::remove_file(&tmp);
            emit(&app2, &jid, "download", "error", 0.0, "Couldn't fetch this clip. Try another, or install yt-dlp.", None);
        }
    });
    Ok(NatureResult { path: String::new(), job_id: Some(id) })
}

/// Download a web video (TikTok, YouTube Shorts, Reels, direct links, ...).
pub fn import_url(app: &AppHandle, url: String) -> Result<String, String> {
    let ytdlp = find_tool(app, "yt-dlp").ok_or("yt-dlp was not found. Install it or place yt-dlp.exe in the tools folder.")?;
    let ffmpeg = find_tool(app, "ffmpeg");
    let dir = app.state::<AppState>().library_dir.clone();
    let id = new_id("dl");
    let handle = register(app, &id);
    let app = app.clone();
    let jid = id.clone();
    std::thread::spawn(move || {
        let mut cmd = command(&ytdlp);
        cmd.args([
            "--no-playlist",
            "--newline",
            "--progress",
            "--no-simulate",
            "--restrict-filenames",
            "-f",
            "bv*[height<=2160][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=2160][ext=mp4]+ba[ext=m4a]/bv*[height<=2160]+ba/b[height<=2160]/b",
            "--merge-output-format",
            "mp4",
            "--print",
            "after_move:filepath",
            "-o",
        ])
        .arg(dir.join("%(title).60s [%(id)s].%(ext)s"));
        if let Some(f) = &ffmpeg {
            cmd.arg("--ffmpeg-location").arg(f);
        }
        cmd.arg(&url).stdout(Stdio::piped()).stderr(Stdio::piped());
        emit(&app, &jid, "download", "running", 0.0, "Starting download...", None);
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                finish(&app, &jid);
                return emit(&app, &jid, "download", "error", 0.0, &e.to_string(), None);
            }
        };
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        *handle.lock().unwrap() = Some(child);
        let err_lines = Arc::new(Mutex::new(Vec::<String>::new()));
        let el = err_lines.clone();
        let err_thread = std::thread::spawn(move || {
            if let Some(e) = stderr {
                for line in BufReader::new(e).lines().map_while(Result::ok) {
                    let mut v = el.lock().unwrap();
                    v.push(line);
                    if v.len() > 8 {
                        v.remove(0);
                    }
                }
            }
        });
        let mut final_path: Option<String> = None;
        if let Some(out) = stdout {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                let t = line.trim();
                if t.starts_with("[download]") {
                    if let Some(pct) = t.split_whitespace().find(|w| w.ends_with('%')) {
                        if let Ok(p) = pct.trim_end_matches('%').parse::<f64>() {
                            emit(&app, &jid, "download", "running", p / 100.0, t, None);
                        }
                    }
                } else if !t.starts_with('[') && Path::new(t).is_file() {
                    final_path = Some(t.to_string());
                }
            }
        }
        let _ = err_thread.join();
        let status = handle.lock().unwrap().as_mut().and_then(|c| c.wait().ok());
        if finish(&app, &jid) {
            return emit(&app, &jid, "download", "cancelled", 0.0, "Cancelled", None);
        }
        match (status.map(|s| s.success()), final_path) {
            (Some(true), Some(p)) => emit(&app, &jid, "download", "done", 1.0, "Downloaded", Some(p)),
            _ => {
                let msg = err_lines.lock().unwrap().join("\n");
                emit(&app, &jid, "download", "error", 0.0, if msg.is_empty() { "Download failed" } else { &msg }, None)
            }
        }
    });
    Ok(id)
}

fn probe_fps(app: &AppHandle, input: &str) -> f64 {
    let Some(ffprobe) = find_tool(app, "ffprobe") else { return 30.0 };
    let out = command(&ffprobe)
        .args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate", "-of", "default=nw=1:nk=1"])
        .arg(input)
        .output();
    let text = out.map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
    let mut parts = text.trim().split('/');
    let n: f64 = parts.next().and_then(|v| v.parse().ok()).unwrap_or(30.0);
    let d: f64 = parts.next().and_then(|v| v.parse().ok()).unwrap_or(1.0);
    let fps = if d > 0.0 { n / d } else { 30.0 };
    if fps.is_finite() && fps > 1.0 && fps < 241.0 { fps } else { 30.0 }
}

fn atempo_chain(speed: f64) -> String {
    let mut s = speed;
    let mut parts = vec![];
    while s > 2.0 {
        parts.push("atempo=2.0".to_string());
        s /= 2.0;
    }
    while s < 0.5 {
        parts.push("atempo=0.5".to_string());
        s /= 0.5;
    }
    parts.push(format!("atempo={s:.4}"));
    parts.join(",")
}

/// Build the ffmpeg filtergraph. Returns (graph, expected output seconds).
pub fn build_graph(r: &BakeRequest, fps: f64) -> Result<(String, f64), String> {
    let speed = r.speed.clamp(0.25, 4.0);
    let d = (r.out_point - r.in_point) / speed;
    if d <= 0.1 {
        return Err("Out point must be after In point".into());
    }
    let out_fps = if r.interpolation == "none" { fps } else { fps.max(60.0) };
    let mut pre = vec![format!("setpts=(PTS-STARTPTS)/{speed:.5}"), format!("fps={fps:.3}"), "settb=AVTB".to_string()];
    let mut post: Vec<String> = vec![];
    match r.interpolation.as_str() {
        "blend" => post.push(format!("framerate=fps={out_fps:.3}")),
        "motion" => post.push(format!("minterpolate=fps={out_fps:.3}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1")),
        _ => {}
    }
    match r.upscale.as_str() {
        "4k" => post.push("scale=w=-2:h=2160:flags=lanczos".into()),
        "1440p" => post.push("scale=w=-2:h=1440:flags=lanczos".into()),
        _ => {}
    }
    if r.sharpen > 0.01 {
        post.push(format!("unsharp=lx=5:ly=5:la={:.3}", r.sharpen.clamp(0.0, 1.5)));
    }
    post.push("format=yuv420p".into());
    let post = post.join(",");
    let pre_s = pre.drain(..).collect::<Vec<_>>().join(",");

    let (graph, dur) = match r.loop_mode.as_str() {
        "pingpong" => (
            format!("[0:v]{pre_s}[base];[base]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,{post}[vout]"),
            d * 2.0,
        ),
        "crossfade" => {
            let c = r.crossfade.clamp(0.1, d / 2.0 - 0.05);
            if c <= 0.1 {
                return Err("Clip is too short for a crossfade".into());
            }
            (
                format!(
                    "[0:v]{pre_s}[base];[base]split[a][b];[a]trim=start={c:.4},setpts=PTS-STARTPTS[m];[b]trim=end={c:.4},setpts=PTS-STARTPTS[h];[m][h]xfade=transition=fade:duration={c:.4}:offset={off:.4},{post}[vout]",
                    off = d - 2.0 * c
                ),
                d - c,
            )
        }
        _ => (format!("[0:v]{pre_s},{post}[vout]"), d),
    };
    Ok((graph, dur))
}

pub fn bake(app: &AppHandle, r: BakeRequest) -> Result<String, String> {
    let ffmpeg = find_tool(app, "ffmpeg").ok_or("ffmpeg was not found. Install it or place ffmpeg.exe in the tools folder.")?;
    if !Path::new(&r.input).is_file() {
        return Err("Input video not found".into());
    }
    let fps = probe_fps(app, &r.input);
    let (graph, expected) = build_graph(&r, fps)?;
    let stem = Path::new(&r.input).file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "video".into());
    let stem: String = stem.chars().filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_').take(40).collect();
    let id = new_id("bake");
    let out = app.state::<AppState>().library_dir.join(format!("{stem}_{}_{}.mp4", r.loop_mode, &id[5..]));
    let handle = register(app, &id);
    let app = app.clone();
    let jid = id.clone();
    std::thread::spawn(move || {
        let mut cmd = command(&ffmpeg);
        cmd.args(["-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-y"])
            .args(["-ss", &format!("{:.3}", r.in_point), "-t", &format!("{:.3}", r.out_point - r.in_point)])
            .arg("-i")
            .arg(&r.input)
            .args(["-filter_complex", &graph, "-map", "[vout]"]);
        if r.keep_audio && r.loop_mode == "loop" {
            cmd.args(["-map", "0:a?", "-af", &atempo_chain(r.speed.clamp(0.25, 4.0)), "-c:a", "aac", "-b:a", "192k"]);
        } else {
            cmd.arg("-an");
        }
        let gop = format!("{}", (fps.max(30.0) * 1.0).round() as i64);
        match r.encoder.as_str() {
            "nvenc" => cmd.args(["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "19", "-b:v", "0"]),
            "qsv" => cmd.args(["-c:v", "h264_qsv", "-global_quality", "20"]),
            "amf" => cmd.args(["-c:v", "h264_amf", "-quality", "quality", "-rc", "cqp", "-qp_i", "18", "-qp_p", "20"]),
            _ => cmd.args(["-c:v", "libx264", "-preset", "medium", "-crf", "18"]),
        };
        cmd.args(["-g", &gop, "-movflags", "+faststart"]).arg(&out);
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
        emit(&app, &jid, "bake", "running", 0.0, "Rendering loop...", None);
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                finish(&app, &jid);
                return emit(&app, &jid, "bake", "error", 0.0, &e.to_string(), None);
            }
        };
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        *handle.lock().unwrap() = Some(child);
        let errs = Arc::new(Mutex::new(String::new()));
        let e2 = errs.clone();
        let et = std::thread::spawn(move || {
            if let Some(e) = stderr {
                for line in BufReader::new(e).lines().map_while(Result::ok) {
                    let mut s = e2.lock().unwrap();
                    if s.len() < 4000 {
                        s.push_str(&line);
                        s.push('\n');
                    }
                }
            }
        });
        if let Some(o) = stdout {
            for line in BufReader::new(o).lines().map_while(Result::ok) {
                if let Some(v) = line.strip_prefix("out_time_us=").or_else(|| line.strip_prefix("out_time_ms=")) {
                    if let Ok(us) = v.trim().parse::<f64>() {
                        let p = (us / 1_000_000.0 / expected).clamp(0.0, 0.99);
                        emit(&app, &jid, "bake", "running", p, "Rendering loop...", None);
                    }
                }
            }
        }
        let _ = et.join();
        let ok = handle.lock().unwrap().as_mut().and_then(|c| c.wait().ok()).map(|s| s.success()) == Some(true);
        if finish(&app, &jid) {
            let _ = std::fs::remove_file(&out);
            return emit(&app, &jid, "bake", "cancelled", 0.0, "Cancelled", None);
        }
        if ok && out.is_file() {
            emit(&app, &jid, "bake", "done", 1.0, "Loop rendered", Some(out.to_string_lossy().to_string()));
        } else {
            let msg = errs.lock().unwrap().clone();
            emit(&app, &jid, "bake", "error", 0.0, if msg.is_empty() { "ffmpeg failed" } else { &msg }, None);
        }
    });
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn req(mode: &str) -> BakeRequest {
        BakeRequest {
            input: "x.mp4".into(),
            in_point: 2.0,
            out_point: 12.0,
            speed: 2.0,
            loop_mode: mode.into(),
            crossfade: 1.0,
            interpolation: "none".into(),
            upscale: "4k".into(),
            sharpen: 0.5,
            encoder: "x264".into(),
            keep_audio: false,
        }
    }
    #[test]
    fn graph_durations() {
        assert!((build_graph(&req("loop"), 30.0).unwrap().1 - 5.0).abs() < 1e-6);
        assert!((build_graph(&req("pingpong"), 30.0).unwrap().1 - 10.0).abs() < 1e-6);
        let (g, d) = build_graph(&req("crossfade"), 30.0).unwrap();
        assert!((d - 4.0).abs() < 1e-6);
        assert!(g.contains("xfade=transition=fade:duration=1.0000:offset=3.0000"));
    }
    #[test]
    fn atempo() {
        assert_eq!(atempo_chain(4.0), "atempo=2.0,atempo=2.0000");
        assert_eq!(atempo_chain(0.25), "atempo=0.5,atempo=0.5000");
    }
}
