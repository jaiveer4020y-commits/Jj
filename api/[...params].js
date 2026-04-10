export default function handler(req, res) {

  let params = req.query.params;
  if (!params) return res.send("Missing ID");

  if (!Array.isArray(params)) params = [params];

  const id = params[0];
  const season = params[1];
  const episode = params[2];

  const isSeries = season && episode;

  const base =
    "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9";

  // ✅ SEPARATE URLS (IMPORTANT FIX)
  const movieUrl = `${base}/stream/movie/${id}.json`;
  const seriesUrl = `${base}/stream/series/${id}:${season}:${episode}.json`;

  const TMDB_API = "81f645c3d9ced06a366b0d829d844cfe";
  const tmdbUrl = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API}&external_source=imdb_id`;

  res.setHeader("Content-Type", "text/html");

  res.send(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">

<style>
body { margin:0; background:black; }

/* CLEAN PLAYER SIZE */
#player {
  width:100vw;
  height:100vh;
}

/* LOADING */
#loading {
  position:fixed;
  inset:0;
  background:black;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  z-index:10;
}

#poster { width:180px; border-radius:10px; margin-bottom:15px; }
#title { color:white; margin-bottom:10px; }

#error {
  position:fixed;
  bottom:0;
  left:0;
  right:0;
  color:red;
  background:#111;
  padding:10px;
  font-size:12px;
  max-height:150px;
  overflow:auto;
}

/* SETTINGS SCROLL FIX */
.art-setting-panel {
  max-height:300px !important;
  overflow-y:auto !important;
}
</style>
</head>

<body>

<div id="loading">
  <img id="poster">
  <div id="title">Loading...</div>
</div>

<div id="player"></div>
<div id="error"></div>

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>

const movieUrl = "${movieUrl}";
const seriesUrl = "${seriesUrl}";
const isSeries = ${isSeries};

const errorBox = document.getElementById("error");

async function fetchStreams() {
  let url = isSeries ? seriesUrl : movieUrl;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Blocked or invalid JSON (series often blocked)");
    }

  } catch (e) {
    throw e;
  }
}

async function init() {
  try {

    // 🎬 TMDB
    try {
      const t = await fetch("${tmdbUrl}");
      const d = await t.json();
      const item = d.tv_results?.[0] || d.movie_results?.[0];
      if (item) {
        poster.src = "https://image.tmdb.org/t/p/w500" + item.poster_path;
        title.innerText = item.name || item.title;
      }
    } catch {}

    // 🎥 STREAMS
    const data = await fetchStreams();

    if (!data.streams) throw new Error("No streams");

    const streams = data.streams;

    // ✅ KEEP ALL IMPORTANT SOURCES
    let valid = streams.filter(s =>
      s.url &&
      (
        s.url.includes(".m3u8") || // HLS
        s.name.toLowerCase().includes("fsl") ||
        s.name.toLowerCase().includes("hubcdn") ||
        s.name.toLowerCase().includes("hdhub")
      )
    );

    if (!valid.length) throw new Error("No valid streams");

    // 🎯 PRIORITY HLS
    valid.sort((a, b) => b.url.includes(".m3u8") - a.url.includes(".m3u8"));

    const sources = valid.map((s, i) => ({
      name: s.name || ("Source " + (i+1)),
      url: s.url,
      subtitles: s.subtitles || []
    }));

    document.getElementById("loading").remove();

    const art = new Artplayer({
      container: '#player',
      url: sources[0].url,
      autoplay: true,
      fullscreen: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      pip: true,
      mutex: true
    });

    // 🎬 SOURCE SWITCH (SCROLLABLE)
    art.setting.add({
      html: 'Sources',
      selector: sources.map(s => ({
        html: s.name,
        url: s.url
      })),
      onSelect: function(item) {
        art.switchUrl(item.url);
        return item.html;
      }
    });

    // 💬 SUBTITLES
    const subs = sources.find(s => s.subtitles.length)?.subtitles || [];

    if (subs.length) {
      art.setting.add({
        html: 'Subtitles',
        selector: subs.map(sub => ({
          html: sub.lang,
          url: sub.url
        })),
        onSelect: function(item) {
          art.subtitle.switch(item.url);
          return item.html;
        }
      });
    }

  } catch (e) {
    errorBox.innerText = e.message;
  }
}

init();

</script>

</body>
</html>`);
           }
