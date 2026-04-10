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

  // TMDB
  const TMDB_API = "81f645c3d9ced06a366b0d829d844cfe";

  const tmdbUrl = isSeries
    ? `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API}&external_source=imdb_id`
    : `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API}&external_source=imdb_id`;

  res.setHeader("Content-Type", "text/html");

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<style>
body { margin:0; background:black; color:white; font-family:sans-serif; overflow:hidden; }

#loadingScreen {
  position:fixed; inset:0;
  background:black;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  z-index:20;
}

#poster {
  width:200px;
  border-radius:12px;
  margin-bottom:20px;
}

#title {
  font-size:20px;
  margin-bottom:20px;
}

.spinner {
  width:50px;
  animation:spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

#player {
  width:100vw;
  height:100vh;
}
</style>
</head>

<body>

<div id="loadingScreen">
  <img id="poster" />
  <div id="title">Loading...</div>
  <img class="spinner" src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png">
</div>

<div id="player"></div>

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>

const apiUrl = "${apiUrl}";
const tmdbUrl = "${tmdbUrl}";

async function init() {
  try {

    // 🎬 LOAD TMDB
    let poster = "";
    let title = "Loading...";

    try {
      const tmdbRes = await fetch(tmdbUrl);
      const tmdbData = await tmdbRes.json();

      const item = tmdbData.tv_results?.[0] || tmdbData.movie_results?.[0];

      if (item) {
        poster = "https://image.tmdb.org/t/p/w500" + item.poster_path;
        title = item.name || item.title;
      }
    } catch {}

    document.getElementById("poster").src = poster;
    document.getElementById("title").innerText = title;

    // 🎥 LOAD STREAMS
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data.streams) throw new Error("No streams");

    const streams = data.streams;

    const hls = streams.filter(s =>
      s.url.includes(".m3u8") &&
      s.name.toLowerCase().includes("castle")
    );

    const fsl = streams.filter(s =>
      s.name.toLowerCase().includes("fsl")
    );

    const final = hls.length ? hls : fsl;

    const formatted = final.map(s => ({
      quality: s.name.includes("1080") ? "1080p" : "720p",
      url: s.url,
      subtitles: s.subtitles || []
    }));

    document.getElementById("loadingScreen").remove();

    const art = new Artplayer({
      container: '#player',
      url: formatted[0].url,
      autoplay: true,
      fullscreen: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      pip: true
    });

    // 🎯 QUALITY SWITCH
    art.setting.add({
      html: 'Quality',
      selector: formatted.map(s => ({
        html: s.quality,
        url: s.url
      })),
      onSelect: function(item) {
        art.switchUrl(item.url);
        return item.html;
      }
    });

    // 💬 SUBTITLE SWITCH
    const subtitles = formatted[0].subtitles;

    if (subtitles.length) {
      art.setting.add({
        html: 'Subtitles',
        selector: subtitles.map(sub => ({
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
    document.getElementById("title").innerText = "Error: " + e.message;
  }
}

init();

</script>

</body>
</html>
`);
}
