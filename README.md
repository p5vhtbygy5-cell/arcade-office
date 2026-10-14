# Arcade Office – Krypto Biuro 🕹️🚀
Wirtualne biuro multiplayer w stylu retro pixel-art (Node.js + Express + Socket.IO, klient na canvasie, bez kroku budowania).

## Strefy
Parkiet Tradingowy, Sala Spotkań, Chillout / Lounge, Dach „Moon”, **Gabinet CHIEF** oraz **Workspace Botów** (dolne skrzydło, wejście z korytarza). Czat strefowy rozpoznaje wszystkie strefy.

## Boty NPC
Serwer wyświetla 7 botów grupy: CHIEF (we własnym gabinecie) oraz SIZE, SCAN, BOOK, RISK, VET, FILLS przy podpisanych biurkach. Każdy ma własny robotyczny sprite, animację w spoczynku i co kilka sekund dymek statusu (zdarzenie `bubble`). Na liście online są oznaczone jako [BOT]. Konfiguracja: `BOT_CFG` w `server.js`, pozycje: `BOT_DESKS` w `public/map.js`.

## Uruchomienie lokalnie
    npm install
    npm start            # http://localhost:3000  (obsługuje zmienną PORT)
    npm test             # 2 symulowani klienci: ruch + czat (serwer musi działać)
    node screenshot.js   # zrzut ekranu z headless Chrome -> screenshot.png

Sterowanie: strzałki / WASD – ruch, Enter – czat, Esc – powrót do gry. Zakładka „Globalny” – wszyscy, „Strefa” – tylko osoby w Twojej strefie.

## Pliki
- `server.js` – Express + Socket.IO, walidacja ruchu po stronie serwera (kolizje, anty-teleport), czat globalny/strefowy, `/health`
- `public/map.js` – wspólna mapa (strefy, ściany, meble)
- `public/index.html`, `public/game.js` – klient: logowanie, proceduralne sprite’y, rendering, czat
- `render.yaml` – konfiguracja Render (Blueprint)
- `test.js`, `screenshot.js` – skrypty weryfikacyjne

## Wdrożenie publiczne
Potrzebny hosting z trwałym procesem i WebSocketami (nie serverless typu Vercel/Netlify Functions).
- **Render** (zalecane): wypchnij repo na GitHub → Render → New → Blueprint → wybierz repo (użyje `render.yaml`). Albo ręcznie: New → Web Service, Build `npm install`, Start `npm start`. Darmowy plan usypia się po ok. 15 min bezczynności (pierwsze wejście trwa ~30–60 s).
- **Railway**: New Project → Deploy from GitHub → Settings → Networking → Generate Domain.
- **Fly.io**: `fly launch` → `fly deploy`, jedna maszyna (`fly scale count 1`).
- Szybki test bez wdrożenia: `npx localtunnel --port 3000` lub `cloudflared tunnel --url http://localhost:3000`.

Stan graczy jest trzymany w pamięci serwera – uruchamiaj jedną instancję (skalowanie wymagałoby adaptera Redis dla Socket.IO).
