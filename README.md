# Krypto Biuro – wirtualne biuro (styl Game Boy) 🎮
Wirtualne biuro multiplayer w stylu klasycznej konsoli Game Boy (4 odcienie zieleni, kafelki 16×16, okno dialogowe na dole; cała grafika rysowana proceduralnie w kodzie) (Node.js + Express + Socket.IO, klient na canvasie, bez kroku budowania).

## Strefy
- **Open Space** – główna sala, w której pracują boty: biurka SIZE (kalkulator, waga, 3 monitory), SCAN (radar, ekrany z wykresami), BOOK (księgi, segregatory, szafa na akta), RISK (lampa alarmowa, tarcza, wskaźnik), VET (lupa, lista kontrolna, pieczątka), FILLS (terminal, drukarka biletów, dzwonek).
- **Tablica Pozycji** – duża tablica na ścianie Open Space (obszar przed tablicą to osobna strefa czatu).
- **Gabinet CHIEF** (lewa część dolnego pasa) – prywatny gabinet z drzwiami, dużym biurkiem, telefonem, tabliczką i regałem.
- **Łazienka** (prawa część dolnego pasa) – kabiny WC, umywalki, lustra.
- **Social** – sofy, ekspres do kawy, lodówka, rośliny, TV z konsolą, stoły.
Czat strefowy działa we wszystkich strefach.

## Boty NPC
Serwer wyświetla 7 botów grupy: CHIEF (we własnym gabinecie) oraz SIZE, SCAN, BOOK, RISK, VET, FILLS przy podpisanych biurkach. Każdy ma własny robotyczny sprite, animację w spoczynku i co kilka sekund dymek statusu (zdarzenie `bubble`). Na liście online są oznaczone jako [BOT]. Konfiguracja: `BOT_CFG` w `server.js`, pozycje: `BOT_DESKS` w `public/map.js`.

## Życie biura (boty)
Boty są sterowane przez serwer (`bots.js`): maszyna stanów + A* po siatce kafelków (ściany, meble, drzwi). Przy biurku piszą na klawiaturze (monitory migają, dymki „...”), a co jakiś czas idą na zadania: SCAN sprawdza Tablicę Pozycji i Top 10, RISK kontroluje biurka, FILLS nosi bilety do BOOK, BOOK odkłada dokumenty do szafy, VET chodzi z checklistą, SIZE idzie do tablicy, wszyscy raportują do CHIEF, a CHIEF robi obchód. Do tego kawa w Social, łazienka i krótkie rozmowy dwóch botów. Naraz poza biurkiem są maks. 2 boty (3 przy zdarzeniach). Otwarcie/zamknięcie pozycji przez API wysyła bota do tablicy, a RISK reaguje. Status bota widać po najechaniu myszką / podejściu i na liście online. `GET /api/bots` – stan botów. `BOT_FAST=1` – przyspieszenie (testy).

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

## Tablica Pozycji
Strefa z neonową tablicą otwartych pozycji (na mapie) oraz pełną tabelą HTML, która otwiera się automatycznie po wejściu do strefy lub przyciskiem **📊 TABLICA**. LONG – zielony, SHORT – czerwony. Co 30 s serwer pobiera ceny z publicznego API Binance (`SYMBOL` lub `SYMBOLUSDT`); jeśli niedostępne – używana jest cena podana przez bota. Wyłączenie: `LIVE_PRICES=0`. Pozycje zapisywane są w `positions.json` (przetrwają restart, plik w .gitignore).

## Top 10 Krypto
Tablica w strefie Social (podejdź do niej lub kliknij **🏆 TOP 10**): #, symbol/nazwa, cena USD, zmiana 24h (▲/▼), kapitalizacja. Serwer odświeża dane co 3 min (`TOP10_INTERVAL_MS`, min. 2 min) z CoinGecko, a w razie błędu/limitu z CoinLore lub CoinPaprika; przy awarii pokazywane są ostatnie dane lub „brak danych”. `GET /api/top10` → `{updatedAt, source, items:[{rank,symbol,name,price,change24h,marketCap}], error?}`. `TOP10_MOCK=1` – dane testowe bez sieci (używane w `npm test`).

## API dla botów
Zapis wymaga nagłówka `Authorization: Bearer <BOT_API_TOKEN>`. Ustaw zmienną `BOT_API_TOKEN` (na Render: Environment). Jeśli jej brak, serwer generuje token przy starcie i zapisuje go do pliku `.bot-token` (w logu jest tylko ścieżka). Dozwolone boty: CHIEF, SIZE, SCAN, BOOK, RISK, VET, FILLS.

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/positions` | lista otwartych pozycji (publiczna) |
| POST | `/api/positions` | otwarcie / aktualizacja (z `id`) – `{id?, bot, symbol, side, size, entry, price?, note?}` |
| PATCH | `/api/positions/:id` | aktualizacja `price`, `size`, `note` |
| POST | `/api/positions/:id/close` | zamknięcie |
| DELETE | `/api/positions/:id` | zamknięcie |

    export URL=http://localhost:3000 TOKEN=$(cat .bot-token)
    # otwarcie
    curl -X POST $URL/api/positions -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -d '{"id":"btc-1","bot":"SCAN","symbol":"BTCUSDT","side":"LONG","size":0.1,"entry":67000,"note":"breakout"}'
    # aktualizacja ceny/wielkości
    curl -X PATCH $URL/api/positions/btc-1 -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"price":68500}'
    # zamknięcie
    curl -X POST $URL/api/positions/btc-1/close -H "Authorization: Bearer $TOKEN"
    # lista
    curl $URL/api/positions

Odpowiedzi: 201 (nowa), 200 (OK), 400 (`details` z listą błędów), 401 (brak/zły token), 404 (brak pozycji). Otwarcie i zamknięcie wywołuje dymek nad odpowiednim botem i komunikat systemowy na czacie; zmiany są rozsyłane na żywo (Socket.IO: `positions`, `position`, `positionClosed`).

Uwaga (Render free): dysk jest efemeryczny – `positions.json` znika przy redeployu. Do trwałego zapisu użyj Persistent Disk i `POSITIONS_FILE=/data/positions.json`.

`./ss-positions.sh add|del` – dodaje/usuwa pozycje TEST (tylko do zrzutów ekranu).

## Feed z desku (`POST /api/feed`)
Pełny stan desku (pozycje REAL/SHADOW, aktywność botów, opcjonalnie top10) – kontrakt w `/workspace/desk/OFFICE_FEED.md`. Pozycje SHADOW oznaczone „P:” / „[PAPIER]”, `entry=null` → PnL względem `refPrice`. `GET /api/feed` – ostatni stan i aktywność. Synchronizacja z boxa: `nohup ./sync-feed-watchdog.sh >/dev/null 2>&1 &` (log `sync.log`, `node sync-feed.js --dry` – podgląd).

## Ekrany na ścianie Open Space
Trzy duże ekrany (mosiądz/nixie): **Top 10 desk + ostatnie pozycje** (lewy), **Tablica Pozycji** (środek), **Historia portfela** (prawy).
Historia portfela pochodzi z feedu: opcjonalne pole `portfolio` w `POST /api/feed` (budowane przez `sync-feed.js` z `/workspace/desk/trades.jsonl` i `state.json`, tylko odczyt).
Odczyt: `GET /api/portfolio`, Socket.IO `portfolio`. Bez historii ekran pokazuje "BRAK HISTORII" – nigdy wymyślonych liczb.
Pola: `start, bank, realizedPnl, roiPct, trades, partial, wins, winRate, maxDrawdownPct, maxDrawdownUsd, best, worst, series[{ts,bank}], recent[{ts,kind:open|close,token,net,pct,size,partial,runner,mode}], mode, updatedAt`.
`sync-feed.js`: `FEED_ONLY=local` + `LOCAL_FEED_URL=...` wysyła tylko do lokalnego serwera (np. :3100); domyślnie bez zmian.

## Pasek wiadomości (ticker) i dymki czatu
Na górnej ścianie przewija się pasek: wiadomości ze świata z lokalnego WorldMonitora (`WM_URL`, domyślnie `http://[::1]:3004`, endpoint `/api/news/v1/list-feed-digest`; nigdy api.worldmonitor.app) na przemian z Top 10 krypto z CoinGecko (`/api/v3/coins/markets`). Cache po stronie serwera: krypto co 60 s, wiadomości co 5 min. Odczyt: `GET /api/ticker`, Socket.IO `ticker`. Błąd = "BRAK DANYCH". `TICKER_OFF=1` wyłącza pobieranie.
Każda wiadomość czatu (gracz lub bot, globalna lub strefowa) pokazuje nad postacią dymek (~5 s, do ~60 znaków w 2 liniach, nowa zastępuje starą).
Pasek to dwa osobne monitory: górny **WIADOMOSCI SWIAT**, pod nim **TOP 10 KRYPTO** – każdy przewija się niezależnie i ma własny stan "BRAK DANYCH".
**Wiadomości w prod (Render):** Render nie widzi lokalnego WorldMonitora, więc `sync-feed.js` na boksie co 5 min (cache) czyta `http://[::1]:3004/api/news/v1/list-feed-digest` i dokłada opcjonalne pole `news` do `POST /api/feed`. Serwer używa go, gdy własne pobieranie z WM nie działa lub go brak (krypto zawsze z CoinGecko po stronie serwera). Pole: `news: {items:[{title,source,category,publishedAt}], updatedAt, source:"worldmonitor-local"}`. Starsze serwery je ignorują.

## Boty mówią o swojej prawdziwej pracy (`botEvents`)
`sync-feed.js` buduje dla każdego bota (SCAN, VET, BOOK, SIZE, FILLS, RISK, CHIEF) listę jego ostatnich 10 prawdziwych zdarzeń z `desk/ledger/<data>.jsonl`, `desk/logs/<stanowisko>.log` i `trades.jsonl` (np. "Przeskanowalem 235 tokenow, 23 przez sito", "Odrzucilem BOTCOIN - slaby tlum", "Polowa VEILTRUMP zamknieta +$98.73") i wysyła je opcjonalnym polem `botEvents: {SCAN:[{ts,text}], ...}`. Tylko wybrane pola (ticker, liczby, powód) – bez adresów i kluczy, tekst ASCII bez polskich znaków (czcionka pikselowa). Bot przy biurku co jakiś czas losuje jedno ze swoich zdarzeń do dymka; bez zdarzeń mówi neutralne "Czekam na dane z desku." Odczyt: `GET /api/bot-events`. Starsze serwery ignorują pole.
