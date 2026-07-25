use scraper::{ElementRef, Html, Node, Selector};
use serde::{Deserialize, Serialize};

const USER_AGENT: &str =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

#[derive(Serialize)]
pub struct GeniusHit {
    id: u64,
    title: String,
    artist: String,
    url: String,
    thumbnail_url: Option<String>,
}

#[derive(Deserialize)]
struct SearchResponse {
    response: SearchResponseInner,
}

#[derive(Deserialize)]
struct SearchResponseInner {
    hits: Vec<HitWrapper>,
}

#[derive(Deserialize)]
struct HitWrapper {
    result: SearchResult,
}

#[derive(Deserialize)]
struct SearchResult {
    id: u64,
    title: String,
    url: String,
    song_art_image_thumbnail_url: Option<String>,
    primary_artist: Artist,
}

#[derive(Deserialize)]
struct Artist {
    name: String,
}

#[tauri::command]
pub async fn genius_search(token: String, query: String) -> Result<Vec<GeniusHit>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.genius.com/search")
        .query(&[("q", query.as_str())])
        .bearer_auth(token)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Genius search failed: HTTP {}", res.status()));
    }

    let parsed: SearchResponse = res.json().await.map_err(|e| e.to_string())?;

    Ok(parsed
        .response
        .hits
        .into_iter()
        .map(|h| GeniusHit {
            id: h.result.id,
            title: h.result.title,
            artist: h.result.primary_artist.name,
            url: h.result.url,
            thumbnail_url: h.result.song_art_image_thumbnail_url,
        })
        .collect())
}

#[tauri::command]
pub async fn genius_get_lyrics(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to load lyrics page: HTTP {}", res.status()));
    }

    let body = res.text().await.map_err(|e| e.to_string())?;
    let document = Html::parse_document(&body);
    let selector = Selector::parse(r#"div[data-lyrics-container="true"]"#)
        .map_err(|e| e.to_string())?;

    let mut blocks: Vec<String> = document
        .select(&selector)
        .map(extract_text_with_breaks)
        .collect();
    blocks.retain(|b| !b.trim().is_empty());

    if blocks.is_empty() {
        return Err("No lyrics found on Genius page".to_string());
    }

    Ok(blocks.join("\n").trim().to_string())
}

fn extract_text_with_breaks(element: ElementRef) -> String {
    let mut out = String::new();
    for node in element.children() {
        match node.value() {
            Node::Text(text) => out.push_str(text),
            Node::Element(el) => {
                if let Some(child) = ElementRef::wrap(node) {
                    if el.name() == "br" {
                        out.push('\n');
                    } else {
                        out.push_str(&extract_text_with_breaks(child));
                    }
                }
            }
            _ => {}
        }
    }
    out
}
