export default async function handler(req, res) {
  try {
    let params = req.query.params;
    if (!params) return res.status(400).send("Missing ID");
    if (!Array.isArray(params)) params = [params];

    const id = params[0];

    const isSeries =
      params.length >= 3 &&
      !isNaN(parseInt(params[1])) &&
      !isNaN(parseInt(params[2]));

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

/* LOADING */
#loading {
  position:fixed; inset:0;
  background:black;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  z-index:10;
}
#poster { width:180px; border-radius:10px; }
#title { color:white; margin-top:10px; font-size:16px; }

.spinner {
  width:60px;
  margin-top:15px;
  animation:spin 1s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* SOURCE PANEL */
#sources {
  position:fixed;
  right:0;
  top:0;
  width:260px;
  height:100%;
  background:#111;
  overflow-y:auto;
  z-index:20;
  display:none;
}
.source {
  padding:12px;
  border-bottom:1px solid #222;
  color:white;
  cursor:pointer;
}
.source:hover { background:#222; }

/* ERROR */
#error {
  position:fixed;
  bottom:0;
  background:#111;
  color:red;
  padding:8px;
  font-size:11px;
  max-height:120px;
  overflow:auto;
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
<div id="sources"></div>
<div id="error"></div>

<script>

const providerUrl = "${providerUrl}";
const TMDB = "${TMDB}";
const id = "${id}";

const errorBox = document.getElementById("error");
const sourcesBox = document.getElementById("sources");
const loading = document.getElementById("loading");

let art;

// 🎬 TMDB
async function loadTMDB() {
  try {
    const res = await fetch(
      "https://api.themoviedb.org/3/find/" + id + "?api_key=" + TMDB + "&external_source=imdb_id"
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

// 📡 FETCH
async function getStreams() {
  const res = await fetch(providerUrl);
  const text = await res.text();

  if (text.startsWith("<")) {
    throw new Error("Provider blocked\\n" + text.slice(0,200));
  }

  return JSON.parse(text);
}

// 🧠 SMART FILTER + SORT
function processStreams(streams) {
  return streams
    .filter(s => s.url && !s.url.includes(".zip"))
    .filter(s => s.url.includes("m3u8") || s.url.includes("mp4"))
    .sort((a,b) => {
      const order = ["FSL","FSLv2","Castle","HubCDN"];
      return order.findIndex(o => b.name?.includes(o)) -
             order.findIndex(o => a.name?.includes(o));
    });
}

// 🎬 INIT
async function init() {
  try {
    await loadTMDB();

    const data = await getStreams();
    let streams = processStreams(data.streams);

    if (!streams.length) throw new Error("No playable streams");

    loading.remove();

    // 🎥 PLAYER
    art = new Artplayer({
      container: '#player',
      url: streams[0].url,
      autoplay: true,
      fullscreen: true,
      setting: true,

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
        gain.gain.value = 3.0;
        src.connect(gain);
        gain.connect(ctx.destination);
      } catch {}
    });

    // 📺 SOURCE UI
    streams.forEach(s => {
      const div = document.createElement("div");
      div.className = "source";

      let size = s.description?.match(/(\\d+\\.?\\d*\\s?GB)/i)?.[1] || "";

      div.innerText = s.name + (size ? " • " + size : "");

      div.onclick = () => {
        art.switchUrl(s.url);
      };

      sourcesBox.appendChild(div);
    });

    // TOGGLE PANEL
    art.controls.add({
      name: 'sources',
      position: 'right',
      html: 'Sources',
      click: () => {
        sourcesBox.style.display =
          sourcesBox.style.display === "block" ? "none" : "block";
      }
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
