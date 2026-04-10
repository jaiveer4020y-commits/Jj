export default async function handler(req, res) {
  try {
    let params = req.query.params;
    if (!params) return safe(res, "Missing ID");

    if (!Array.isArray(params)) params = [params];

    const id = params[0];
    const season = params[1];
    const episode = params[2];

    const isSeries = season && episode;

    const base =
      "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9";

    const url = isSeries
      ? `${base}/stream/series/${id}:${season}:${episode}.json`
      : `${base}/stream/movie/${id}.json`;

    let response;

    try {
      response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
    } catch (e) {
      return safe(res, "Fetch failed: " + e.message);
    }

    if (!response || !response.ok) {
      return safe(res, "Source error: " + response?.status);
    }

    let data;

    try {
      data = await response.json();
    } catch (e) {
      return safe(res, "Invalid JSON");
    }

    if (!data?.streams?.length) {
      return safe(res, "No streams found");
    }

    const streams = data.streams;

    // 🎯 FILTER CLEAN
    const hls = streams.filter(
      s => s?.url?.includes(".m3u8") && s?.name?.toLowerCase().includes("castle")
    );

    const fsl = streams.filter(
      s => s?.name?.toLowerCase().includes("fsl")
    );

    let finalStreams = hls.length ? hls : fsl;

    if (!finalStreams.length) {
      return safe(res, "No valid streams");
    }

    const formatted = finalStreams.map(s => ({
      quality: s.name.includes("1080") ? "1080p" : "720p",
      url: s.url
    }));

    // 🎬 PLAYER
    res.setHeader("Content-Type", "text/html");

    return res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/artplayer/dist/artplayer.css">
<style>
body { margin:0; background:black; }
#player { width:100vw; height:100vh; }
#loader {
  position:fixed; inset:0;
  display:flex; justify-content:center; align-items:center;
  background:black;
}
#loader img { width:60px; animation:spin 1s linear infinite; }
@keyframes spin { 100% { transform:rotate(360deg);} }
</style>
</head>
<body>

<div id="loader">
<img src="https://assets.nflxext.com/en_us/pages/wiplayer/site-spinner.png">
</div>

<div id="player"></div>

<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<script>
const streams = ${JSON.stringify(formatted)};

setTimeout(() => {
  document.getElementById("loader").remove();

  const art = new Artplayer({
    container: '#player',
    url: streams[0].url,
    autoplay: true,
    fullscreen: true
  });

  art.setting.add({
    html: 'Quality',
    selector: streams.map(s => ({
      html: s.quality,
      url: s.url
    })),
    onSelect: function(item) {
      art.switchUrl(item.url);
      return item.html;
    }
  });

}, 800);
</script>

</body>
</html>
`);

  } catch (err) {
    return safe(res, "Fatal crash: " + err.message);
  }

  // ✅ ALWAYS SAFE RESPONSE
  function safe(res, msg) {
    res.setHeader("Content-Type", "text/html");
    return res.send(`
<!DOCTYPE html>
<html>
<body style="background:black;color:white;font-family:sans-serif;padding:20px">
<h2>⚠️ ERROR</h2>
<p>${msg}</p>
</body>
</html>
`);
  }
}
