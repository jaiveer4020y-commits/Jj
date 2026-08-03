import sys
import re
import ast
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin

def to_base_36(n):
    return '' if n == 0 else to_base_36(n // 36) + "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36]

def unpack(p, a, c, k):
    for i in range(c):
        if k[c - i - 1]:
            p = re.sub(r'\b' + to_base_36(c - i - 1) + r'\b', k[c - i - 1], p)
    return p

def extract_m3u8(embed_url):
    parsed_url = urlparse(embed_url)
    default_domain = f"{parsed_url.scheme}://{parsed_url.netloc}/"
    headers = {
        'Referer': default_domain,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
    }

    try:
        response = requests.get(embed_url, headers=headers).text
        soup = BeautifulSoup(response, 'html.parser')
        
        js_code = next((script.string for script in soup.find_all('script') if script.string and "eval(function(p,a,c,k,e,d)" in script.string), "")

        if not js_code:
            return None

        encoded_packed = re.sub(r"eval\(function\([^\)]*\)\{[^\}]*\}\(|.split\('\|'\)\)\)", '', js_code)
        data = ast.literal_eval(encoded_packed)
        p, a, c, k = data[0], int(data[1]), int(data[2]), data[3].split('|')
        decoded_data = unpack(p, a, c, k)

        master_m3u8 = re.search(r'\"hls2\":"([^"]+)', decoded_data).group(1)

        playlist_response = requests.get(master_m3u8, headers=headers).text
        raw_m3u8_url = master_m3u8

        if "#EXT-X-STREAM-INF" in playlist_response:
            lines = playlist_response.splitlines()
            variants = [line.strip() for line in lines if line and not line.startswith("#")]
            if variants:
                raw_m3u8_url = urljoin(master_m3u8, variants[-1])

        return raw_m3u8_url
    except Exception as e:
        return None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
        raw_url = extract_m3u8(target_url)
        if raw_url:
            print(raw_url)
        else:
            sys.exit(1)
