# Marble Tycoon

Bouw je eigen 3D-knikkerbaan op een raster zoals in RollerCoaster Tycoon, in een donkere wereld in de stijl van Cities: Skylines. Laat daarna de knikkers rollen, of race met vrienden en gebruik je telefoon als afstandsbediening.

## Installeren op een Ubuntu-server

Eén commando, als root of met sudo:

```bash
curl -fsSL https://raw.githubusercontent.com/Rudyh0/MarbleTycoon/main/install.sh | sudo bash
```

De installer vraagt naar het domein (bijvoorbeeld `marble.rudymedia.nl`) en of het via Cloudflare loopt. Daarna regelt hij:

- nginx en HTTPS (Let's Encrypt, of een eigen certificaat achter Cloudflare in de modus **Full**);
- de game in `/var/www/marble-tycoon`;
- de server voor de community en de races, op `127.0.0.1` (alleen intern);
- elke nacht een back-up van de gedeelde banen;
- als je wilt: elke 10 minuten de nieuwste versie van GitHub.

Nog een keer draaien werkt de installatie bij; je instellingen blijven bewaard. Meteen bijwerken kan met `sudo marble-tycoon-update`.

Zonder vragen, bijvoorbeeld:

```bash
curl -fsSL https://raw.githubusercontent.com/Rudyh0/MarbleTycoon/main/install.sh | sudo bash -s -- --domein marble.rudymedia.nl --cloudflare ja --ja
```

### Samen met "... en de Duitse streken"

Marble Tycoon kan op dezelfde server staan:

- alles heet `marble-tycoon` (mappen, systemd-diensten, nginx-bestand, systeemgebruiker);
- de server krijgt een eigen poort vanaf 8790 en slaat 8765 en de poort van de Duitse streken over;
- het nginx-bestand bevat geen standaardsite, dus het vangnet van de Duitse streken blijft werken;
- de bestanden `duitse-streken` en `duitse-streken-vangnet` worden niet aangeraakt;
- de installer weigert het domein van de Duitse streken, of een domein dat al door een andere site wordt gebruikt;
- staan poort 80/443 alleen open voor Cloudflare, dan laat de installer dat zo.

Gebruik dus een eigen (sub)domein, bijvoorbeeld `marble.rudymedia.nl` naast `bollo.rudymedia.nl`.

## Spelen

- **Bouwen**: plaats eerst een startpunt en bouw daarna stuk voor stuk verder vanaf een open einde (groene pijl). Zoals in RCT gaat een helling altijd via overgangen: vlak, licht, steil.
- **Bochten**: klein (1×1), middel (2×2), groot (3×3), 45° naar diagonaal en S-bochten.
- **Speciale stukken**: looping, kurkentrekker, kleine en grote spiraal, aquariumtunnel en aquariumbocht met vissen, launchtunnel met instelbare snelheid, finish-trechter.
- **Effecten** op gewone stukken: kettinglift, booster, rem (snelheid instelbaar) en vuur.
- **Kleuren** voor de baan en de steunen, per stuk of voor de hele baan.
- **Thema's**: Metropool, Romeinse tijd, Middeleeuwen, Space, Flora en fauna, Piraten.
- **Knikkers**: aantal, tussenpauze en meer dan twintig skins.
- **Opslaan en delen**: in je browser, als deelcode of bestand, of in de community.
- **Geluid**: bouwgeluiden, knikkergeluiden en klikjes, elk apart uit te zetten in de instellingen.

### Race (multiplayer)

Kies **Race** op de pc. Iedereen scant de QR-code, kiest een naam en een knikker en drukt op **Klaar**. Met de gashendel op je telefoon bepaal je de snelheid. Ga je te snel door een bocht of over een bult, dan vlieg je eruit en word je teruggezet. Je telefoon trilt als je de grens nadert. Op iPhones kan een website niet trillen; daar knippert het scherm.

### Besturing

| Wat | Hoe |
| --- | --- |
| Camera draaien | rechtermuisknop slepen, of Q/E |
| Camera schuiven | linkermuisknop slepen, of WASD |
| Zoomen | scrollwiel |
| Bouwen | Enter of klik op het groene stuk |
| Weghalen | Backspace |
| Draaien bij plaatsen | R |
| Ongedaan maken | Ctrl+Z / Ctrl+Y |

## Lokaal draaien

```bash
python3 server/marbletycoon.py serveer --db test.db --poort 8000 --statisch .
```

Open daarna `http://localhost:8000`.

## Techniek

- Puur HTML, CSS en JavaScript (ES-modules), zonder bouwstap. Three.js en de QR-bibliotheek staan in `lib/`.
- `server/marbletycoon.py`: Python 3 + SQLite, geen extra pakketten. REST voor de community en een kleine WebSocket-server voor de races.
- Een baan uit de community halen: `sudo -u marble-tycoon python3 /opt/marble-tycoon/dienst/marbletycoon.py verwijder --db /var/lib/marble-tycoon/banen.db --id CODE`

Licenties van de bibliotheken: zie `lib/THREE-LICENSE.txt` en `lib/QRCODE-LICENSE.txt`.
