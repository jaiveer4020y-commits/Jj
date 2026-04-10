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

  const apiUrl = isSeries
    ? `${base}/stream/series/${id}:${season}:${episode}.json`
    : `${base}/stream/movie/${id}.json`;

  const TMDB_API = "81f645c3d9ced06a366b0d829d844cfe";

  const tmdbUrl = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API}&external_source=imdb_id`;

  res.setHeader("Content-Type", "text/html");

  res.send(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<style>
body {
  margin:0;
  background:black;
  overflow:hidden;
}

/* FORCE LANDSCAPE */
#player {
  position:fixed;
  width:100vh;
  height:100vw;
  top:50%;
  left:50%;
  transform:translate(-50%, -50%) rotate(90deg);
  transform-origin:center;
}

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
  width:220px;
  border-radius:12px;
  margin-bottom:20px;
}

#title {
  color:white;
  font-size:18px;
  margin-bottom:20px;
}

.spinner {
  width:60px;
  animation:spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

#error {
  position:fixed;
  bottom:0;
  left:0;
  right:0;
  color:red;
  background:#111;
  padding:10px;
  font-size:12px;
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

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>

const apiUrl = "${apiUrl}";
const tmdbUrl = "${tmdbUrl}";
const errorBox = document.getElementById("error");

async function init() {
  try {

    // 🎬 TMDB
    try {
      const t = await fetch(tmdbUrl);
      const d = await t.json();
      const item = d.tv_results?.[0] || d.movie_results?.[0];
      if (item) {
        document.getElementById("poster").src =
          "https://image.tmdb.org/t/p/w500" + item.poster_path;
        document.getElementById("title").innerText =
          item.name || item.title;
      }
    } catch {}

    // 🎥 STREAM FETCH
    const res = await fetch(apiUrl);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Provider returned HTML (blocked or wrong URL)");
    }

    if (!data.streams || !data.streams.length) {
      throw new Error("No streams found");
    }

    const streams = data.streams;

    // 🎯 FILTER
    const valid = streams.filter(s =>
      s.url && (
        s.url.includes(".m3u8") ||
        s.name.toLowerCase().includes("fsl")
      )
    );

    if (!valid.length) throw new Error("No playable streams");

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
      playbackRate: true
    });

    // 🎬 SOURCE SWITCH
    art.setting.add({
      html: 'Source',
      selector: sources.map(s => ({
        html: s.name,
        url: s.url
      })),
      onSelect: function(item) {
        art.switchUrl(item.url);
        return item.html;
      }
    });

    // 💬 SUBTITLE SWITCH
    if (sources[0].subtitles.length) {
      art.setting.add({
        html: 'Subtitles',
        selector: sources[0].subtitles.map(sub => ({
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
