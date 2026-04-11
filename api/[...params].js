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

#player { width:100vw; height:100vh; }

.art-setting-panel {
  max-height:400px !important;
  overflow-y:auto !important;
}

/* BIGGER SOURCE LIST */
.art-setting-panel .art-setting-item {
  font-size:14px;
  padding:10px;
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

<div id="player"></div>
<div id="error"></div>

<script>

const apiUrl = "${apiUrl}";
const errorBox = document.getElementById("error");

async function init() {
  try {

    const res = await fetch(apiUrl);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Series blocked OR wrong slug");
    }

    const streams = data.streams || [];

    if (!streams.length) throw new Error("No streams");

    // 🎯 CLEAN + FORMAT
    const sources = streams.map((s,i)=>{

      let quality = "Auto";
      if (s.name.includes("2160")) quality = "4K";
      else if (s.name.includes("1080")) quality = "1080p";
      else if (s.name.includes("720")) quality = "720p";

      let size = "";
      const match = s.description?.match(/(\\d+\\.?\\d*\\s?GB)/i);
      if (match) size = match[1];

      let label = "Server";
      if (s.name?.toLowerCase().includes("fsl")) label = "FSL";
      else if (s.name?.toLowerCase().includes("hubcdn")) label = "HubCDN";
      else if (s.url.includes(".m3u8")) label = "HLS";

      return {
        html: label + " • " + quality + (size ? " • " + size : ""),
        url: s.url,
        default: i === 0
      };
    });

    const art = new Artplayer({
      container: '#player',
      url: sources[0].url,
      autoplay: true,
      fullscreen: true,
      setting: true,

      // ✅ QUALITY SWITCH (PROPER)
      quality: sources,

      // ✅ HLS SUPPORT
      customType: {
        m3u8: function(video, url) {
          if (Hls.isSupported()) {
            const hls = new Hls({
              maxBufferLength: 30
            });
            hls.loadSource(url);
            hls.attachMedia(video);
          } else {
            video.src = url;
          }
        }
      }
    });

    // 🔊 MAX AUDIO BOOST (REAL LIMIT)
    art.on('ready', () => {

      const video = art.video;

      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(video);

      const gain = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();

      gain.gain.value = 10.0; // 🔥 1000%

      compressor.threshold.setValueAtTime(-50, ctx.currentTime);
      compressor.knee.setValueAtTime(40, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);

      source.connect(gain);
      gain.connect(compressor);
      compressor.connect(ctx.destination);
    });

  } catch (e) {
    errorBox.innerText = e.message;
  }
}

init();

</script>

</body>
</html>`);
}body { margin:0; background:black; }

#player { width:100vw; height:100vh; }

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
  margin-bottom:10px;
  text-align:center;
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
  max-height:150px;
  overflow:auto;
}

/* SCROLLABLE SETTINGS */
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
  <img class="spinner" src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png">
</div>

<div id="player"></div>
<div id="error"></div>

<script>

const movieUrl = "${movieUrl}";
const seriesUrl = "${seriesUrl}";
const isSeries = ${isSeries};

const errorBox = document.getElementById("error");

async function fetchStreams() {
  const url = isSeries ? seriesUrl : movieUrl;

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
    throw new Error("Provider blocked or returned HTML");
  }
}

async function init() {
  try {

    // 🎬 TMDB DATA
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

    const valid = data.streams.filter(s => s.url);

    if (!valid.length) throw new Error("No valid streams");

    // 🎯 SORT HLS FIRST
    valid.sort((a,b)=> b.url.includes(".m3u8") - a.url.includes(".m3u8"));

    // 🎬 CLEAN SOURCES
    const sources = valid.map((s,i)=>{

      let quality = "Auto";
      if (s.name.includes("2160")) quality = "4K";
      else if (s.name.includes("1080")) quality = "1080p";
      else if (s.name.includes("720")) quality = "720p";

      let label = "Server";
      if (s.name.toLowerCase().includes("fsl")) label = "FSL";
      else if (s.name.toLowerCase().includes("hubcdn")) label = "HubCDN";
      else if (s.name.toLowerCase().includes("hdhub")) label = "HdHub";
      else if (s.url.includes(".m3u8")) label = "HLS";

      return {
        name: label + " • " + quality,
        url: s.url,
        subtitles: s.subtitles || []
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

    // 🎬 SOURCE SWITCH
    art.setting.add({
      html: 'Source',
      selector: sources.map(s=>({
        html:s.name,
        url:s.url
      })),
      onSelect(item){
        art.switchUrl(item.url);
        return item.html;
      }
    });

    // 💬 SUBTITLES
    const subs = sources.find(s=>s.subtitles.length)?.subtitles || [];

    if(subs.length){
      art.setting.add({
        html:'Subtitles',
        selector: subs.map(s=>({
          html:s.lang,
          url:s.url
        })),
        onSelect(item){
          art.subtitle.switch(item.url);
          return item.html;
        }
      });
    }

    // 🔊 500% AUDIO BOOST
    art.on('ready', () => {
      const video = art.video;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(video);
      const gainNode = ctx.createGain();

      gainNode.gain.value = 5.0; // 🔥 500%

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
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
