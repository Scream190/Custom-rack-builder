# RackPlanner

Planung von Veranstaltungstechnik-Racks: Bestückung, Verkabelung, Custom-Blenden – im Browser, ohne Installation.
Fokus der ersten Version: UHF/Funk-Racks. Das Datenmodell ist gewerkeunabhängig (Audio, Netzwerk, Licht, Video …).

## Benutzen

`dist/index.html` im Browser öffnen (Chrome/Edge/Firefox/Safari). Die ganze App steckt in dieser einen Datei
und läuft auch offline. Das Projekt wird automatisch im Browser gespeichert. Mit *Export → Projekt speichern*
legst du eine `.rackplan.json` an, die du weitergeben und wieder öffnen kannst.

### Bedienung
| Aktion | So geht's |
|---|---|
| Gerät einbauen | aus der Bibliothek ins Rack ziehen (vorne oder hinten) oder doppelklicken |
| Gerät verschieben | ziehen; HE, Montage (vorne/hinten), ½-Platz auch im Inspektor |
| Kabel ziehen | Anschluss anklicken → Zielanschluss anklicken (`Esc` bricht ab) |
| Kabel wählen | Kabel, Beschriftung, Zeile in der Kabelliste oder belegten Anschluss anklicken |
| Weiteres Kabel an belegten Port | `Alt` + Klick |
| Löschen / Duplizieren | `Entf` / `Strg+D` |
| Rückgängig / Wiederholen | `Strg+Z` / `Strg+Y` |
| Zoom | Mausrad (zum Cursor), Navigationsleiste unten, `+`/`−` |
| Verschieben (Pan) | mittlere Maustaste ziehen, oder Pan-Werkzeug in der Navigationsleiste |
| Drehen (3D) | linke Maustaste, oder `Shift` + mittlere Maustaste (wie Fusion 360) |
| Einpassen | Doppelklick mittlere Maustaste, `F6`, oder Einpassen-Knopf |
| 3D-Standardansichten | ViewCube oben rechts (Seite anklicken), ⌂ = Startansicht |
| Bereiche anpassen | Trennlinien zwischen Bibliothek / Ansicht / Eigenschaften / Kabelliste ziehen (Doppelklick = Standard); ein-/ausblenden über die Schalter in der Rack-Leiste |

### Funktionen
- **Rack-Typen:** Rackcases, Shockmount-Cases, Doppeltür, Schränke, Open Frame, Wandgehäuse, Pulte, 10"-Minirack.
  Eigene Typen mit beliebiger HE, Einbautiefe, Außenmaß, hinteren Schienen, Gewicht und Farbe.
- **Vorder- und Rückansicht**, Geräte auf vorderen *und* hinteren Schienen, ½/⅓-Breite, Tiefen-Kollisionsprüfung.
- **Kabelführung in 2D schematisch für maximale Übersicht:** gerade Linien mit 90°-Ecken, jedes Kabel auf eigener Spur
  (wahlweise „hängend“ oder „direkt“ in den Projekt-Einstellungen).
- **Schubladen (1–4 HE) mit Inhaltsliste:** Menge + Artikel, auch als Liste einfügbar („4x SM58“ pro Zeile); erscheint als
  Etikett auf der Schubladenfront, im Viewer und als eigener Abschnitt im PDF.
- **Kabel color-coded nach Kabeltyp**. Farben, Strichart, Lagerlängen und Stecker-Zuordnung sind editierbar.
  Der Kabeltyp wird automatisch nach Stecker gewählt oder über „Kabel:“ in der Toolbar festgelegt.
- **Kabellängen automatisch** (orthogonaler Weg im Rack, Front↔Rück über die Seite, + Biegewege, + Zuschlag %,
  + Serviceschlaufe, aufgerundet auf Lagerlängen) **oder manuell**. Kabelnummern W001 … für Beschriftung.
- **Geräte-Editor:** eigene Geräte mit Anschlüssen per Klick auf Front/Rückseite; Eigenschaftsfelder (Frequenz, Kanal, IP …).
- **Marken-Geräte nach Herstellerzeichnungen:** Shure ULXD4, ULXD4D, ULXD4Q, AD4D, AD4Q, UA844+SWB, P10T (PSM1000), PA821B;
  Sennheiser EM 6000, EM 300-500 G4, ASA 214, SR 2050 IEM. Steckerpositionen wurden auf den Front-/Rückseiten-Zeichnungen
  der offiziellen Bedienungsanleitungen vermessen und auf die echten Gehäusemaße skaliert. Die Fronten sind vereinfacht
  (Display, Regler, Taster, LED-Ketten, Logo), aber wiedererkennbar. Bei perspektivischen Vorlagen (EM 6000, SR 2050) liegen die
  Positionen auf etwa ±5 mm genau. Die Quelle steht in jeder Vorlage (`source`). Generische Geräte (Splitter, Patchfelder, Strom,
  Netzwerk) sind Platzhalter.
- **Alle Geräte aus RF-Scan-Editor** (`src/js/56b-products.js` + unterstützte Scanner) in `src/library/devicesRfScan.ts`:
  Shure ANX4, AD600, AXT600, ADTD/ADTQ, QLXD4, SLXD4, SLXD4D, SLXD4+, SLXD4D+, SLXD4Q+, SLXD4QDAN+, SLXD5+, BLX4, BLX88, P9T, P3T;
  Sennheiser EM 6000 Dante, EW-DX EM 2 / EM 2 Dante / EM 4 Dante, EW-D EM, Spectera Base Station, EM 9046, EM 100 G4, SR IEM G4,
  EM 2050, EM XSW 1/2, SR XSW IEM; DPA N-DR1; Audio-Technica ATW-R3210(N), ATW-R5220, M3T; Lectrosonics DSQD, DCHR, M2T; Wisycom
  MRK980, MPR52; AKG DSR800, SR470; Electro-Voice RE3-RX; Sound Devices A20-Nexus, A20-RX; Zaxcom ZMT4; Sony URX-P03D, URX-S03D;
  TinySA Basic/Ultra, RF Explorer. Jede Vorlage nennt in `source`, wie genau sie ist: **vermessen** (Herstellerzeichnung),
  **abgeleitet** (gleiches Gehäuse wie ein vermessenes Gerät) oder **Datenblatt** (Anschlüsse laut Hersteller, Positionen
  geschätzt). Portable Empfänger/Sender stehen unter „Portabel (Rackwanne)“ als 1/3-Breite.
- **Automatische Bibliotheks-Aktualisierung:** Gespeicherte Projekte übernehmen neue Versionen der mitgelieferten Vorlagen.
  Kabel werden über den Anschlussnamen neu zugeordnet; Kabel an Anschlüssen, die es nicht mehr gibt, werden gemeldet.
- **Blenden-Designer:** 1–8 HE, 19"/10", Neutrik-D-Size-Ausschnitte (XLR, etherCON, BNC, powerCON, speakON, USB, HDMI …),
  Bohrungen, Rechteck-Ausschnitte, Gravur (Text, Rahmen, Linien), „Reihe verteilen“, Kollisionsprüfung.
  Blenden mit Einsätzen werden zu verkabelbaren Geräten (Durchführung vorne/hinten).
- **3D-Ansicht** mit den echten Frontplatten als Textur und Kabeln als Schläuche. Die Kabel werden kollisionsfrei
  verlegt: ein Wegesucher (A* im 6-mm-Raster) weicht Geräten, Schienen und bereits verlegten Kabeln aus, bündelt
  rechtwinklig und nutzt den Seitenkanal. Vor jedem Stecker bleibt ein freier Austrittsbereich. Das Gehäuse ist
  halbtransparent, damit Rück- und Draufsicht den Kabelverlauf zeigen.

### Austausch mit dem RF Frequency Manager (RF-Scan-Editor)
Beide Programme nutzen dieselben IDs (Produkt `Shure|AD4D`, Band `Shure|ULX-D|G50`). RF Frequency Manager muss dafür
nicht geändert werden.

- **Funkdaten pro Gerät** (Eigenschaften → „Funk · RF Frequency Manager“): Band (mit Frequenzbereich), Zone, Kanalnamen,
  Frequenzen (außerhalb des Bands rot markiert), Backups. Sie erscheinen auch im Gerätedisplay auf der Front und in der
  PDF-Geräteliste. Eigene Gerätevorlagen bekommen ihr RF-Produkt im Geräte-Editor.
- **RackPlanner → RF:** *Export → RF Frequency Manager → .rfreq herunterladen* (Zone aus den Funkdaten, Rackname als
  Zone oder ohne Zone). Im RF-Programm *Inventar → Anfragen … → Datei …*: Jedes Gerät wird ein Inventar-Eintrag mit
  Produkt, Band, Gerätename, Kanalnamen und Zone.
- **RF → RackPlanner:** *Datei → Aus RF Frequency Manager importieren …*
  - RF-Projektdatei (`.rfse`): Das Inventar wird zu Geräten mit Band, Zone, Kanalnamen und koordinierten Frequenzen,
    wahlweise ein Rack je Zone, ein Rack für alles (Größe automatisch) oder in freie Plätze des aktuellen Racks.
  - Frequenzliste (`.rfreq`, die das RF-Programm unter *Anfragen* zurückschickt): Die Frequenzen werden über die
    Kanalnamen in die vorhandenen Geräte eingetragen.
  - Frequenzanfragen (`.rfreq` vom Typ `request`) werden ebenfalls als Geräte übernommen.
- Produkt- und Bandliste stammen aus dem RF-Repo (`src/integration/rfData.ts`, erzeugt mit `npm run sync-rf`, wenn
  `../rf-scan-editor` ausgecheckt ist). Neue Produkte dort einfach neu synchronisieren und in
  `src/integration/rf.ts` einer Vorlage zuordnen.

### Export
- **PDF:** Zeichnung (vorne/hinten), Kabelliste mit Packliste nach Länge, Geräteliste mit HE, Gewicht und Leistung.
- **PNG / SVG**
- **Interaktiv (HTML):** eine einzelne Datei, öffnet in jedem Browser im Nur-Ansicht-Modus mit Vorne/Hinten/3D,
  Zoom, Kabel-Hervorhebung und Kabelliste. Zum Verschicken per Mail oder Cloud.
- **Blenden:** DXF (R12, mm, 1:1, Layer `KONTUR` / `AUSSCHNITT` / `GRAVUR`) für Frontplattenhersteller wie
  Rack247 oder Schaeffer (deren Frontplatten-Designer importiert DXF), dazu SVG und PDF-Maßzeichnung.
  Texte liegen als DXF-TEXT vor. Manche Fertiger wollen Schrift in Pfade umgewandelt; vor der Bestellung bitte deren Vorgaben prüfen.

Beispiele liegen in `beispiele/`.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm run build    # erzeugt dist/index.html (eine selbstständige Datei)
npm run test:3d  # prüft, dass sich die 3D-Kabel weder berühren noch durch Geräte laufen
```

Während `npm run dev` läuft, zeigt `http://localhost:5173/gallery.html` alle Marken-Geräte (Front + Rückseite) zum visuellen Abgleich
(`?id=shure-ad4q` für ein einzelnes Gerät).

Stack: React + TypeScript + Vite, zustand (State, Undo/Redo), SVG-Rendering, three.js (3D), jsPDF + svg2pdf (PDF).

```
src/model/      Datenmodell, Geometrie & Kabellängen, Store, Blenden-Geometrie, Stecker-Registry
src/library/    Geräte- (devicesBranded.ts = Marken-Geräte), Rack- und Kabeltyp-Bibliotheken, Beispielprojekt
src/render/     SVG-Darstellung (Rack, Geräte, Stecker, Kabel, Blenden) – auch für Export & 3D-Texturen
src/ui/         Oberfläche, Editoren, Dialoge
src/three/      3D-Ansicht, route3d.ts = kollisionsfreie Kabelführung
tests/          collision3d.ts: Kollisionsprüfung der 3D-Kabel (npm run test:3d)
src/export/     PDF, PNG/SVG, interaktives HTML, DXF
```
