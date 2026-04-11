export default async function handler(req, res) {
  try {

    let params = req.query.params;
    if (!params) return res.status(400).send("Missing ID");

    if (!Array.isArray(params)) params = [params];

    const id = params[0];

    // ✅ PERFECT SERIES DETECTION
    const isSeries =
      params.length === 3 &&
      params[1] &&
      params[2] &&
      !isNaN(params[1]) &&
      !isNaN(params[2]);

    const season = isSeries ? params[1] : null;
    const episode = isSeries ? params[2] : null;

    const base =
      "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9";

    const providerUrl = isSeries
      ? `${base}/stream/series/${id}:${season}:${episode}.json`
      : `${base}/stream/movie/${id}.json`;

    const TMDB = "81f645c3d9ced06a366b0d829d844cfe";

    res.setHeader("Content-Type", "text/html");

    res.status(200).send(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<style>
body { margin:0; background:black; font-family:sans-serif; }

/* PLAYER */
#player { width:100vw; height:100vh; }

/* LOADING SCREEN */
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

#poster {
  width:180px;
  border-radius:10px;
  margin-bottom:15px;
}

#title {
  color:white;
  font-size:16px;
  margin-bottom:10px;
}

.spinner {
  width:60px;
  animation:spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* ERROR BOX */
#error {
  position:fixed;
  bottom:0;
  left:0;
  right:0;
  background:#111;
  color:red;
  padding:10px;
  font-size:12px;
  max-height:150px;
  overflow:auto;
}

/* SETTINGS PANEL */
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

const providerUrl = "${providerUrl}";
const errorBox = document.getElementById("error");
const loading = document.getElementById("loading");

// ⏱ FAILSAFE
setTimeout(() => {
  if (loading) {
    document.getElementById("title").innerText = "Still loading... provider may be slow";
  }
}, 7000);

// 🎬 TMDB FETCH
async function loadTMDB() {
  try {
    const res = await fetch(
      "https://api.themoviedb.org/3/find/${id}?api_key=${TMDB}&external_source=imdb_id"
    );
    const data = await res.json();

    const item = data.movie_results?.[0] || data.tv_results?.[0];

    if (item) {
      document.getElementById("poster").src =
        "https://image.tmdb.org/t/p/w500" + item.poster_path;

      document.getElementById("title").innerText =
        item.title || item.name;
    }
  } catch {}
}

// 🎥 FETCH STREAMS
async function getStreams() {
  const res = await fetch(providerUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json"
    }
  });

  const text = await res.text();

  // ❌ BLOCK DETECTION
  if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
    throw new Error("Provider blocked request (HTML received)");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response");
  }
}

// 🚀 INIT
async function init() {
  try {

    await loadTMDB();

    const data = await getStreams();

    if (!data.streams) throw new Error("No streams found");

    // ✅ FILTER VALID STREAMS
    const sources = data.streams
      .filter(s => s.url && typeof s.url === "string")
      .filter(s => {
        try {
          new URL(s.url);
          return true;
        } catch {
          return false;
        }
      })
      .map((s, i) => {

        let quality = "Auto";
        if (s.name?.includes("1080")) quality = "1080p";
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

    if (!sources.length) {
      throw new Error("No valid playable streams");
    }

    // REMOVE LOADING
    loading.remove();

    // 🎬 PLAYER
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

    // 🔊 AUDIO BOOST
    art.on('ready', () => {
      try {
        const ctx = new AudioContext();
        const src = ctx.createMediaElementSource(art.video);
        const gain = ctx.createGain();
        gain.gain.value = 5.0;
        src.connect(gain);
        gain.connect(ctx.destination);
      } catch {}
    });

  } catch (e) {
    loading.remove();
    errorBox.innerText = e.message;
  }
}

init();

</script>

</body>
</html>`);

  } catch (err) {
    res.status(500).send("SERVER ERROR: " + err.message);
  }
}
