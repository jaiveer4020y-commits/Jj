export default function handler(req, res) {

  let params = req.query.params;

  if (!params) return res.send("Missing ID");

  if (!Array.isArray(params)) params = [params];

  const id = params[0];

  // ✅ STRICT SERIES DETECTION
  const isSeries = params.length === 3 &&
                   params[1] !== undefined &&
                   params[2] !== undefined;

  const season = isSeries ? params[1] : null;
  const episode = isSeries ? params[2] : null;

  const base =
    "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9";

  const providerUrl = isSeries
    ? `${base}/stream/series/${id}:${season}:${episode}.json`
    : `${base}/stream/movie/${id}.json`;

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(providerUrl)}`;

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

#loading {
  position:fixed;
  inset:0;
  display:flex;
  justify-content:center;
  align-items:center;
  background:black;
  color:white;
  z-index:10;
}

#error {
  position:fixed;
  bottom:0;
  left:0;
  right:0;
  background:#111;
  color:red;
  padding:10px;
  font-size:12px;
}
</style>
</head>

<body>

<div id="loading">Loading streams...</div>
<div id="player"></div>
<div id="error"></div>

<script>

const proxyUrl = "${proxyUrl}";
const errorBox = document.getElementById("error");
const loading = document.getElementById("loading");

// ⏱ FAILSAFE TIMEOUT
setTimeout(() => {
  loading.innerText = "Taking too long... Provider may be blocking.";
}, 7000);

async function init() {
  try {

    const res = await fetch(proxyUrl);
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.streams || !data.streams.length) {
      throw new Error("No streams found");
    }

    const sources = data.streams
      .filter(s => s.url)
      .map((s,i)=>{

        let q = "Auto";
        if (s.name?.includes("1080")) q = "1080p";
        if (s.name?.includes("720")) q = "720p";

        return {
          html: q,
          url: s.url,
          default: i === 0
        };
      });

    loading.remove();

    const art = new Artplayer({
      container: '#player',
      url: sources[0].url,
      autoplay: true,
      fullscreen: true,
      setting: true,
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

    // 🔊 AUDIO BOOST SAFE
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
}
