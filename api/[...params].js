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
           }
