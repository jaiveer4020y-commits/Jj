export default async function handler(req, res) {
  try {
    const params = req.query.params || [];

    const tmdbId = params[0];
    const season = params[1];
    const episode = params[2];

    if (!tmdbId) {
      return res.status(400).send("Missing ID");
    }

    const type = season && episode ? "series" : "movie";

    // 🔗 ADDON URL
    let addonUrl =
      type === "movie"
        ? `https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/stream/movie/tmdb:${tmdbId}.json`
        : `https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/stream/series/tmdb:${tmdbId}:${season}:${episode}.json`;

    const response = await fetch(addonUrl);
    const data = await response.json();

    if (!data.streams?.length) {
      return res.status(404).send("No streams");
    }

    // ⚡ Resolve streams
    const resolved = await Promise.all(
      data.streams.map(async (s) => {
        try {
          const r = await fetch(s.url, {
            method: "HEAD",
            redirect: "follow",
          });
          return {
            quality: s.title || "Auto",
            url: r.url,
          };
        } catch {
          return null;
        }
      })
    );

    const streams = resolved.filter(Boolean);

    // 🎬 TMDB
    let meta = {};
    try {
      const TMDB_KEY = "YOUR_TMDB_API_KEY";

      const tmdbUrl =
        type === "movie"
          ? `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}`
          : `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}`;

      const tmdb = await fetch(tmdbUrl).then((r) => r.json());

      meta = {
        title: tmdb.title || tmdb.name,
        poster: `https://image.tmdb.org/t/p/original${tmdb.poster_path}`,
      };
    } catch {}

    // 👉 If API request (json)
    if (req.headers.accept?.includes("application/json")) {
      return res.json({
        success: true,
        type,
        ...meta,
        streams,
        default: streams[0]?.url,
      });
    }

    // 🎨 HTML PLAYER (FULL UI)
    res.setHeader("Content-Type", "text/html");

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${meta.title || "Player"}</title>

<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">

<style>
body {
  margin:0;
  background:black;
  color:white;
  font-family:sans-serif;
}

/* 🎬 LOADING SCREEN */
#intro {
  position:fixed;
  inset:0;
  background:black;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
}

#intro img {
  max-width:200px;
  border-radius:10px;
}

#title {
  margin-top:15px;
  font-size:18px;
}

/* 🔥 NETFLIX SPINNER */
.loading-spinner-container {
  margin-top:20px;
}

.loading-spinner-container img {
  width:60px;
  animation:spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* 🎥 PLAYER */
#player {
  width:100vw;
  height:100vh;
}
</style>
</head>

<body>

<!-- 🎬 INTRO SCREEN -->
<div id="intro">
  <img src="${meta.poster || ""}">
  <div id="title">${meta.title || ""}</div>

  <div class="loading-spinner-container">
    <img src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png">
  </div>
</div>

<!-- 🎥 PLAYER -->
<div id="player"></div>

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>
const streams = ${JSON.stringify(streams)};
const videoUrl = streams[0].url;

// ⏳ Simulate loading delay
setTimeout(() => {
  document.getElementById("intro").style.display = "none";

  new Artplayer({
    container: '#player',
    url: videoUrl,
    autoplay: true,
    fullscreen: true,
    setting: true,
    playbackRate: true,
    aspectRatio: true,
    hotkey: true,
    pip: true,
    mutex: true,

    // 🎯 Custom Quality Selector
    controls: [
      {
        position: 'right',
        html: 'Quality',
        click: function () {
          let list = streams.map(s => s.quality).join("\\n");
          let choice = prompt("Select Quality:\\n" + list);
          let found = streams.find(s => s.quality == choice);
          if (found) this.player.switchUrl(found.url);
        }
      }
    ]
  });

}, 2000);
</script>

</body>
</html>
`);
  } catch (err) {
    res.status(500).send(err.message);
  }
    }
