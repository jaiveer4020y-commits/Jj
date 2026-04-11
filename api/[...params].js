export default function handler(req, res) {

  let params = req.query.params;
  if (!params) return res.send("Missing ID");

  if (!Array.isArray(params)) params = [params];

  const id = params[0];
  const season = params[1];
  const episode = params[2];

  // ✅ AUTO DETECT SERIES
  const isSeries = params.length >= 3;

  const base =
    "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9";

  const providerUrl = isSeries
    ? `${base}/stream/series/${id}:${season}:${episode}.json`
    : `${base}/stream/movie/${id}.json`;

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(providerUrl)}`;

  const TMDB = "81f645c3d9ced06a366b0d829d844cfe";

  res.setHeader("Content-Type", "text/html");

  res.send(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<style>
body { margin:0; background:black; }

/* PLAYER */
#player { width:100vw; height:100vh; }

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

#poster { width:200px; border-radius:10px; margin-bottom:15px; }
#title { color:white; margin-bottom:10px; }

.spinner {
  width:60px;
  animation:spin 1s linear infinite;
}

@keyframes spin { 100% { transform: rotate(360deg); } }

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

.art-setting-panel {
  max-height:400px !important;
  overflow-y:auto !important;
}
</style>
</head>

<body>

<div id="loading">
  <img id="poster">
  <div id="title">Loading...</div>
  <img class="spinner" src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png">
</div>

<div id="player"></div>
<div id="error"></div>

<script>

const proxyUrl = "${proxyUrl}";
const errorBox = document.getElementById("error");

// 🎬 TMDB LOADER
async function loadTMDB() {
  try {
    const res = await fetch(
      "https://api.themoviedb.org/3/find/${id}?api_key=${TMDB}&external_source=imdb_id"
    );
    const d = await res.json();
    const item = d.tv_results?.[0] || d.movie_results?.[0];

    if (item) {
      poster.src = "https://image.tmdb.org/t/p/w500" + item.poster_path;
      title.innerText = item.name || item.title;
    }
  } catch {}
}

// 🎥 FETCH STREAMS (PROXY)
async function getStreams() {
  const res = await fetch(proxyUrl);
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Provider blocked / invalid JSON");
  }
}

// 🎯 EXTRACT REAL URL (FIX FSL / PIXELDRAIN)
async function resolveUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.url || url;
  } catch {
    return url;
  }
}

async function init() {
  try {

    await loadTMDB();

    const data = await getStreams();

    if (!data.streams) throw new Error("No streams");

    let streams = data.streams.filter(s => s.url);

    // 🔥 RESOLVE URLS
    for (let s of streams) {
      s.url = await resolveUrl(s.url);
    }

    // 🎬 FORMAT SOURCES
    const sources = streams.map((s,i)=>{

      let quality = "Auto";
      if (s.name?.includes("2160")) quality = "4K";
      else if (s.name?.includes("1080")) quality = "1080p";
      else if (s.name?.includes("720")) quality = "720p";

      let size = "";
      const m = s.description?.match(/(\\d+\\.?\\d*\\s?GB)/i);
      if (m) size = m[1];

      return {
        html: quality + (size ? " • " + size : ""),
        url: s.url,
        default: i === 0
      };
    });

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
      mutex: true,
      quality: sources,

      customType: {
        m3u8: function(video, url) {
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
          } else {
            video.src = url;
          }
        }
      }
    });

    // 🔊 MAX AUDIO BOOST
    art.on('ready', () => {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(art.video);
      const gain = ctx.createGain();

      gain.gain.value = 8.0;

      source.connect(gain);
      gain.connect(ctx.destination);
    });

  } catch (e) {
    errorBox.innerText = e.message;
  }
}

init();

</script>

</body>
</html>`);
}
