export default async function handler(req, res) {
  try {
    let params = req.query.params;

    if (!params) return res.status(400).send("Missing ID");
    if (!Array.isArray(params)) params = [params];

    const id = params[0];

    // ✅ PERFECT SERIES DETECTION
    const isSeries =
      params.length >= 3 &&
      !isNaN(parseInt(params[1])) &&
      !isNaN(parseInt(params[2]));

    const season = isSeries ? params[1] : null;
    const episode = isSeries ? params[2] : null;

    const base =
      "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9";

    // ✅ CORRECT URL BUILDER
    const providerUrl = isSeries
      ? `${base}/stream/series/${id}:${season}:${episode}.json`
      : `${base}/stream/movie/${id}.json`;

    res.setHeader("Content-Type", "text/html");

    res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<style>
body { margin:0; background:black; }
#player { width:100vw; height:100vh; }
#error {
  position:fixed;
  bottom:0;
  background:#111;
  color:red;
  padding:10px;
  font-size:12px;
  max-height:150px;
  overflow:auto;
}
</style>
</head>

<body>

<div id="player"></div>
<div id="error"></div>

<script>

const providerUrl = "${providerUrl}";
const errorBox = document.getElementById("error");

// ✅ SAFE FETCH
async function getStreams() {
  const res = await fetch(providerUrl, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const text = await res.text();

  if (text.startsWith("<")) {
    throw new Error("❌ Provider blocked (HTML returned)\\n" + text.slice(0,200));
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("❌ Invalid JSON\\n" + text.slice(0,200));
  }
}

// ✅ SMART FILTER (VERY IMPORTANT)
function filterStreams(streams) {
  return streams.filter(s => {

    if (!s.url) return false;

    // ❌ REMOVE BAD LINKS
    if (s.url.includes(".zip")) return false;
    if (s.url.includes("pixel.hubcdn")) return false;

    // ✅ ALLOW ONLY PLAYABLE
    if (
      s.url.includes(".m3u8") ||
      s.url.includes(".mp4") ||
      s.url.includes("hls")
    ) return true;

    return false;
  });
}

// 🎬 INIT PLAYER
async function init() {
  try {

    const data = await getStreams();

    if (!data.streams) throw new Error("No streams");

    const valid = filterStreams(data.streams);

    if (!valid.length) {
      throw new Error("❌ No playable streams after filtering");
    }

    // 🎯 BUILD SOURCES
    const sources = valid.map((s, i) => {

      let q = "Auto";
      if (s.name?.includes("1080")) q = "1080p";
      if (s.name?.includes("720")) q = "720p";

      return {
        html: q,
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

    // 🔊 AUDIO BOOST (SAFE)
    art.on('ready', () => {
      try {
        const ctx = new AudioContext();
        const src = ctx.createMediaElementSource(art.video);
        const gain = ctx.createGain();
        gain.gain.value = 3.0; // stable max
        src.connect(gain);
        gain.connect(ctx.destination);
      } catch (e) {
        errorBox.innerText += "\\nAudio boost blocked: " + e.message;
      }
    });

  } catch (e) {
    errorBox.innerText = e.message;
  }
}

init();

</script>

</body>
</html>
`);

  } catch (err) {
    res.status(500).send("SERVER ERROR: " + err.message);
  }
}
