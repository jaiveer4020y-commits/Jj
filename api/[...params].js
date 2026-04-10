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
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<style>
body { margin:0; background:black; overflow:hidden; }

#player {
  position:fixed;
  width:100vh;
  height:100vw;
  top:50%;
  left:50%;
  transform:translate(-50%, -50%) rotate(90deg);
}

#loading {
  position:fixed;
  inset:0;
  background:black;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
}

#poster { width:200px; border-radius:10px; margin-bottom:15px; }
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

    // 🎥 FETCH STREAMS
    const res = await fetch(apiUrl);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid response (HTML instead of JSON)");
    }

    if (!data.streams || !data.streams.length) {
      throw new Error("No streams from provider");
    }

    const streams = data.streams;

    // ✅ ACCEPT ALL VALID STREAMS
    let valid = streams.filter(s => s.url);

    if (!valid.length) throw new Error("No valid streams");

    // 🎯 PRIORITY: HLS FIRST
    valid.sort((a, b) => {
      const aHls = a.url.includes(".m3u8") ? 1 : 0;
      const bHls = b.url.includes(".m3u8") ? 1 : 0;
      return bHls - aHls;
    });

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

    // 🎬 SOURCE SWITCH (FIXED)
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

    // 💬 SUBTITLES (DYNAMIC)
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
