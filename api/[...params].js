export default async function handler(req, res) {
  try {
    // ✅ SAFE PARAM PARSE
    let params = req.query.params;
    if (!params) return res.status(400).send("Missing ID");
    if (!Array.isArray(params)) params = [params];

    const tmdbId = params[0];
    const season = params[1];
    const episode = params[2];

    const type = season && episode ? "series" : "movie";

    // 🔗 ALWAYS JSON (FIXED)
    const addonUrl =
      type === "movie"
        ? `https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/stream/movie/tmdb:${tmdbId}.json`
        : `https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/stream/series/tmdb:${tmdbId}:${season}:${episode}.json`;

    // 📡 FETCH SAFELY
    const response = await fetch(addonUrl);

    if (!response.ok) {
      return res.status(500).send("Addon fetch failed");
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return res.status(500).send("Invalid addon response");
    }

    if (!data.streams || data.streams.length === 0) {
      return res.status(404).send("No streams");
    }

    // ⚡ RESOLVE STREAMS (SAFE)
    const streams = [];

    for (const s of data.streams) {
      try {
        let finalUrl = s.url;

        // try HEAD
        try {
          const r = await fetch(s.url, {
            method: "HEAD",
            redirect: "follow",
          });
          finalUrl = r.url;
        } catch {}

        streams.push({
          quality: s.title || "Auto",
          url: finalUrl,
        });
      } catch {}
    }

    if (streams.length === 0) {
      return res.status(404).send("Streams failed");
    }

    // 🎯 SORT QUALITY
    streams.sort((a, b) => {
      const qa = parseInt(a.quality) || 0;
      const qb = parseInt(b.quality) || 0;
      return qb - qa;
    });

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
        poster: tmdb.poster_path
          ? `https://image.tmdb.org/t/p/original${tmdb.poster_path}`
          : "",
      };
    } catch {}

    // 📦 JSON MODE
    if (req.headers.accept?.includes("application/json")) {
      return res.json({
        success: true,
        type,
        ...meta,
        streams,
        default: streams[0].url,
      });
    }

    // 🎨 UI MODE
    res.setHeader("Content-Type", "text/html");

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${meta.title || "Player"}</title>

<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">

<style>
body { margin:0; background:black; color:white; font-family:sans-serif; }

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
  max-width:220px;
  border-radius:12px;
}

#title {
  margin-top:15px;
  font-size:18px;
}

.loading-spinner-container img {
  width:60px;
  margin-top:20px;
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

<div id="intro">
  <img src="${meta.poster}">
  <div id="title">${meta.title || ""}</div>

  <div class="loading-spinner-container">
    <img src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png"
    onerror="this.src='https://placehold.co/64x64?text=Loading'">
  </div>
</div>

<div id="player"></div>

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>
const streams = ${JSON.stringify(streams)};
const videoUrl = streams[0].url;

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

}, 1500);
</script>

</body>
</html>
`);
  } catch (err) {
    res.status(500).send("Server crashed: " + err.message);
  }
}
    // ⚡ RESOLVE FINAL STREAM URLs (HEAD + GET FALLBACK)
    const resolved = await Promise.all(
      data.streams.map(async (s) => {
        try {
          let finalUrl;

          try {
            const head = await fetch(s.url, {
              method: "HEAD",
              redirect: "follow",
            });
            finalUrl = head.url;
          } catch {
            const get = await fetch(s.url, {
              method: "GET",
              redirect: "follow",
            });
            finalUrl = get.url;
          }

          return {
            quality: s.title || "Auto",
            url: finalUrl,
          };
        } catch {
          return null;
        }
      })
    );

    const streams = resolved.filter(Boolean);

    if (streams.length === 0) {
      return res.status(404).send("All streams failed");
    }

    // 🎯 SORT QUALITY
    streams.sort((a, b) => {
      const qa = parseInt(a.quality) || 0;
      const qb = parseInt(b.quality) || 0;
      return qb - qa;
    });

    // 🎬 TMDB METADATA
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

    // 📦 API MODE
    if (req.headers.accept?.includes("application/json")) {
      return res.json({
        success: true,
        type,
        ...meta,
        streams,
        default: streams[0].url,
      });
    }

    // 🎨 HTML PLAYER
    res.setHeader("Content-Type", "text/html");

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${meta.title || "Player"}</title>

<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">

<style>
body { margin:0; background:black; color:white; font-family:sans-serif; }

/* INTRO SCREEN */
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
  max-width:220px;
  border-radius:12px;
}

#title {
  margin-top:15px;
  font-size:18px;
}

/* NETFLIX SPINNER */
.loading-spinner-container img {
  width:60px;
  margin-top:20px;
  animation:spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* PLAYER */
#player {
  width:100vw;
  height:100vh;
}
</style>
</head>

<body>

<div id="intro">
  <img src="${meta.poster || ""}">
  <div id="title">${meta.title || ""}</div>

  <div class="loading-spinner-container">
    <img src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png"
    onerror="this.src='https://placehold.co/64x64?text=Loading'">
  </div>
</div>

<div id="player"></div>

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>
const streams = ${JSON.stringify(streams)};
const videoUrl = streams[0].url;

// ⏳ Loading screen delay
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
  }            quality: s.title || "Auto",
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
      const TMDB_KEY = "81f645c3d9ced06a366b0d829d844cfe";

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
