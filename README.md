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
| Bereiche anpassen | Trennlinien zwischen Bibliothek / Ansicht / Eigenschaften / Kabelliste ziehen (Doppelklick = Standard); ein-/ausblenden über *Anzeigen* rechts in der Werkzeugleiste |

### Funktionen
- **Rack-Typen:** Rackcases, Shockmount-Cases, Doppeltür, Schränke, Open Frame, Wandgehäuse, Pulte, 10"-Minirack.
  Eigene Typen mit beliebiger HE, Einbautiefe, Außenmaß, hinteren Schienen, Gewicht und Farbe.
- **Vorder- und Rückansicht**, Geräte auf vorderen *und* hinteren Schienen, ½/⅓-Breite, Tiefen-Kollisionsprüfung.
- **Kabelführung in 2D schematisch für maximale Übersicht:** gerade Linien mit 90°-Ecken, jedes Kabel auf eigener Spur
  (wahlweise „hängend“ oder „direkt“ unter *Einstellungen → Darstellung*).
- **Schubladen (1–4 HE) mit Inhaltsliste:** Menge + Artikel, auch als Liste einfügbar („4x SM58“ pro Zeile); erscheint als
  Etikett auf der Schubladenfront, im Viewer und als eigener Abschnitt im PDF.
- **Kabel color-coded nach Kabeltyp**. Farben, Strichart, Lagerlängen und Stecker-Zuordnung sind editierbar.
  Der Kabeltyp wird automatisch nach Stecker gewählt oder über „Kabel:“ in der Toolbar festgelegt.
- **Kabellängen automatisch** (orthogonaler Weg im Rack, Front↔Rück über die Seite, + Biegewege, + Zuschlag %,
  + Serviceschlaufe, aufgerundet auf Lagerlängen) **oder manuell**. Kabelnummern W001 … für Beschriftung.
- **Kabelkonfektion:** Die Kabelliste hat neben „Liste“ die Ansicht „Konfektion“. Dort ist jede Kabelart gezeichnet:
  benötigter Kabelstecker an beiden Enden (das Gegenstück zur Gerätebuchse, z. B. XLR-Kupplung an einem XLR-Ausgang),
  Kabelfarbe, Länge, Stückzahl und Kabelnummern. Darunter steht der Steckerbedarf mit Stückzahlen. Kabelstecker sind als
  Kabelstecker gezeichnet (Seitenansicht mit Knickschutz), das Einbau-Piktogramm erscheint nur bei den Einbausteckern,
  die für Dosen und eigene Blenden gebraucht werden. Alles kommt auch als Seite „Kabelkonfektion“ ins PDF.
- **Pinbelegung:** Für jedes selbst konfektionierbare Kabel zeigt die Konfektion ein Verdrahtungsschema: Pins beider
  Stecker, farbige Adern mit Signal (sich kreuzend, wo die Reihenfolge abweicht, z. B. XLR 1-2-3 auf Klinke T-R-S),
  Brücken (symmetrisch auf unsymmetrisch) und Hinweise. Abgedeckt: Audio (XLR, Klinke, TT, Cinch, Phoenix), DMX (XLR 5),
  Lautsprecher (speakON NL4/NL8), Koax (BNC, N, SMA), Netzwerk (RJ45/etherCON nach T568B), MIDI, D-Sub 25 (AES59),
  Netz (Kaltgeräte, Schuko, powerCON, TRUE1, CEE, mit Hinweis auf Elektrofachkraft und DGUV V3). Kabel ohne
  Standardbelegung (USB, HDMI, Glasfaser, Harting, Socapex, CA-COM) bekommen kein Schema. Im PDF als Seite „Pinbelegung“.
- **Y-Kabel:** Im Kabel-Inspector „Ast an Ende A/B hinzufügen“ und dann den Zielanschluss anklicken. Alle Äste teilen den
  gemeinsamen Stecker (Ende A), heißen W012a, W012b … und haben je eine eigene Länge ab dem gemeinsamen Stecker. Kabeltyp
  und Farbe gelten für das ganze Y-Kabel; die 3D-Führung lässt die Äste am gemeinsamen Stecker zusammenlaufen.
- **Split- und Kombidosen:** *+ Eigene → Split- oder Kombidose* in der Bibliothek oder *Einstellungen → Eigene Vorlagen*. Eine Dose hat
  Sammelanschlüsse (z. B. CEE 32 A, Harting, Socapex, D-Sub, Multipin) und Einzelanschlüsse; die innere Verdrahtung
  ergibt sich aus der Zuordnung. Dosen stehen unter dem Rack (in Vorder- und Rückansicht), werden wie Geräte verkabelt
  und haben eine Entfernung zum Rack, die in die automatische Kabellänge eingeht. Mitgeliefert sind Beispiel-Dosen
  (Stromspinne CEE 32 A, Socapex-Peitsche, Motor-Splitbox, XLR-Peitsche D-Sub 25, passive Stagebox, Kombidose Licht).
  Kabel zu Dosen werden in der 3D-Ansicht nicht gezeichnet.
- **Geräte-Editor:** eigene Geräte mit Anschlüssen per Klick auf Front/Rückseite; Eigenschaftsfelder (Frequenz, Kanal, IP …).
- **Marken-Geräte nach Herstellerzeichnungen:** Shure ULXD4, ULXD4D, ULXD4Q, AD4D, AD4Q, UA844+SWB, P10T (PSM1000), PA821B;
  Sennheiser EM 6000, EM 300-500 G4, ASA 214, SR 2050 IEM. Steckerpositionen wurden auf den Front-/Rückseiten-Zeichnungen
  der offiziellen Bedienungsanleitungen vermessen und auf die Gehäusemaße laut Datenblatt skaliert. Die Fronten sind vereinfacht
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
- **Profi-Geräte für alle Gewerke** (`src/library/devicesPro.ts`, rund 120 Vorlagen):
  - *Netzwerk:* Luminex GigaCore 10, 12, 14R, 16Xt, 16RFO, 18t, 26i, 30i; Cisco CBS350-8P/16P/24P/48P, SG350-10P/28P,
    Catalyst 1000-24P, Catalyst 9200L-24P; Netgear M4250-10G2F/26G4F; Ubiquiti USW-Pro-24-PoE.
  - *Licht/DMX:* MA Lighting grandMA3 8Port Node, 4Port Node, 2Port Node, I/O Node, processing unit L, onPC rack-unit;
    Luminex LumiNode 12/4, LumiSplit 2.10/1.10; Obsidian NETRON EN12; Swisson XND-8; generischer DMX-Splitter und Art-Net-Node.
  - *Stageboxen:* Yamaha Rio3224-D3/-D2, Rio1608-D3/-D2, Tio1608-D2; Allen & Heath DX168, DT168, AR2412, GX4816;
    Midas DL16, DL32, DL151, DL152, DL251; Behringer S16, S32; DiGiCo D2-Rack, SD-MiNi Rack; Radial ProD8.
  - *Endstufen:* d&b D80, D40, D20, 30D, 10D; L-Acoustics LA12X, LA4X, LA2Xi; Powersoft X8, X4, X4L, Quattrocanali
    1204/2404/4804/8804, Duecanali 1604; Lab.gruppen PLM 20K44/12K44, D 20:4L, D 80:4L, FP 10000Q, IPD 2400; Crown XLS
    1502/2002/2502, I-Tech 4x3500HD, DCi 4|600N; QSC GXD 4/8, PLD4.5, CXD4.3; Yamaha PX5/8/10; Camco Vortex 6.
  - *Weitere:* Lake LM 44, XTA DP448, dbx DriveRack PA2, BSS BLU-100, Q-SYS Core 110f, Biamp TesiraFORTÉ AI; Behringer X32
    Rack, Midas M32C, Yamaha TF-Rack; Focusrite RedNet MP8R/A16R MkII, Klark Teknik DN9650, Rosendahl nanosyncs HD;
    Clear-Com HelixNet HMS-4X, Arcadia, MS-702; Blackmagic Smart Videohub 12G 20×20/40×40, HyperDeck Studio HD Plus,
    ATEM 1 M/E Constellation HD; Tascam SS-CDR250N, DA-6400; APC Smart-UPS 1500/3000; Strom- und Drehstromverteiler
    (CEE, Schuko, powerCON, TRUE1), Patchfelder (RJ45, etherCON, XLR, speakON, opticalCON), Rack-PC, Mac mini.
  Diese Vorlagen beruhen auf Datenblättern: Anschlussart und -anzahl laut Hersteller, Positionen geschätzt. Wo auch
  Bauhöhe oder Anschlüsse nur aus Produktfotos abgeleitet sind, steht in `source` „Schätzung“. Beides bitte vor dem
  Einsatz am Gerät selbst prüfen und im Geräte-Editor korrigieren. Neue Stecker: speakON NL8, CA-COM, Phoenix/Euroblock,
  D-Sub 25 (AES59), MIDI, SDI/MADI-BNC, powerCON 32 A, IEC C19/C20, CEE 16/32 A.
- **Automatische Bibliotheks-Aktualisierung:** Gespeicherte Projekte übernehmen neue Versionen der mitgelieferten Vorlagen.
  Kabel werden über den Anschlussnamen neu zugeordnet; Kabel an Anschlüssen, die es nicht mehr gibt, werden gemeldet.
- **Blenden-Designer:** 1–8 HE, 19"/10", Neutrik-D-Size-Ausschnitte (XLR, etherCON, BNC, powerCON, speakON, USB, HDMI …),
  Bohrungen, Rechteck-Ausschnitte, Gravur (Text, Rahmen, Linien), „Reihe verteilen“, Kollisionsprüfung.
  Blenden mit Einsätzen werden zu verkabelbaren Geräten (Durchführung vorne/hinten).
- **3D-Ansicht** mit den gezeichneten Frontplatten als Textur und Kabeln als Schläuche. Die Kabel werden kollisionsfrei
  verlegt: ein Wegesucher (A* im 6-mm-Raster) weicht Geräten, Schienen und bereits verlegten Kabeln aus, bündelt
  rechtwinklig und nutzt den Seitenkanal. Vor jedem Stecker bleibt ein freier Austrittsbereich. Das Gehäuse ist
  halbtransparent, damit Rück- und Draufsicht den Kabelverlauf zeigen.

- **Zweite Geräte-Ladung** (`src/library/devicesPro2.ts`, 120 Vorlagen):
  - *Live-Ton:* Grafik-EQs (dbx 231s/1231, Klark Teknik DN370, Behringer FBQ3102HD), Dynamik (dbx 166xs/160A,
    Drawmer DS201/DL241, BSS DPR-901 II, Behringer MDX4600), Effekte (Yamaha SPX2000, Lexicon PCM96/PCM92,
    TC Electronic M3000/Reverb 4000, Bricasti M7, Eventide H9000), Mikrofonsplitter (Radial OX8-j, generisch 8×3 und 16×2),
    Kopfhörerverstärker (Behringer HA8000/HA4700, ART HeadAMP 6 Pro), Zuspieler (Denon DN-700R/DN-300R, Tascam SS-R250N,
    BD-MP4K), Wandler (RedNet D16R, Ferrofish A32 Dante, RME M-32 AD Pro II, RME MADI Router), DSP (Lake LM 26, Meyer
    GALAXY 408, XTA DP548, BSS BLU-160), Endstufen (d&b D6/40D, Crown XTi 4002/CDi 4|600, Yamaha PC406-D, QSC PLD4.2/4.3,
    Martin Audio iK42, Behringer NX3000D, Powersoft T604, Lab.gruppen C 48:4, t.amp TSA 4-700).
  - *Studio:* Universal Audio Apollo x8/x8p/x16, Focusrite Clarett+ 8Pre und Scarlett 18i20, RME Fireface UFX III/UCX II,
    Octamic XTC, MOTU 828/8pre-es/16A, Antelope Orion 32+, Apogee Symphony I/O Mk II; Neve 1073DPX, API 3124V und 500VPR,
    UA 6176, Avalon VT-737sp, Focusrite ISA 828 MkII, SSL PURE DRIVE OCTO, Rupert Neve 5211; UA 1176LN, LA-2A,
    Tube-Tech CL 1B, SSL Fusion, Neve 33609, Distressor; Patchbays (Neutrik NYS-SPP-L1, Samson S-Patch Plus, TT-96, XLR-24).
  - *Video:* ATEM 2/4 M/E Constellation HD, MultiView 16, CleanSwitch 12×12, Teranex AV und Teranex Mini, HyperDeck Studio
    HD Pro, AJA KUMO 1616/3232 und FS-HDR; generisch: SDI-Verteiler, HDMI-Matrix, SDI-Glasfaser, KVM-Konsole, Rackmonitor
    3× 7", Medienserver.
  - *Licht:* Dimmerpack 6-fach, Dimmerrack 12-fach (Socapex), Schaltpack, Socapex-Ausspitzung, ELC dmXLAN node16,
    DMX-Merger, DMX-Player, Timecode-Generator.
  - *Rigging:* Motorsteuerungen D8 4-/8-Kanal (direkt, Harting), D8+ Niederspannung, Not-Aus-Verteiler,
    Lastmess-Basisstation, Motorstromverteiler CEE 63 A.
  - *Strom und Intercom:* Eaton 5PX 1500 / 9PX 3000, Stromverteiler CEE 63 A, CEE 32 A → Socapex, 12× TRUE1, Netzmonitor,
    Einschaltverzögerung, Netzfilter; Clear-Com FreeSpeak II Base II, Partyline-Netzteil.
  Weitere neue Stecker: Harting 16-pol, Socapex 19-pol, CEE 16 A 4-pol (Motor), CEE 63 A, XLR 4-pol, Bantam/TT, Cinch,
  TOSLINK, USB-C/Thunderbolt. Generische Vorlagen (Motorsteuerungen, Dimmer, Verteiler) sind als solche gekennzeichnet.
- **IT-Equipment** (`src/library/devicesIT.ts`, 57 Vorlagen): Switches (Cisco Catalyst 9300/Nexus 93180YC-FX/Meraki
  MS225/MS120, Juniper EX2300/EX4300, HPE Aruba 2930F/CX 6300M/Instant On 1930, Netgear M4300, Ubiquiti USW-Pro-48/
  Pro-Max-24/Aggregation, MikroTik CRS326/CRS317/CRS354, TP-Link SG3428XMP/SG1024D), Router und Firewalls (Cisco ISR 4331/
  Catalyst 8200, Juniper SRX345, FortiGate 100F, Sophos XGS 4300, UniFi Dream Machine Pro/SE, MikroTik CCR2004/CCR2116,
  Peplink Balance 310X, generischer 4G/5G-Router), Server (Dell R660/R760, HPE DL360/DL380 Gen11, Lenovo SR630/SR650 V3,
  Mac Pro Rack, generisch 1/2 HE), NAS (Synology RS822+/RS1221+/RS2423+, QNAP TS-873AeU), Zeitserver Meinberg LANTIME
  M300 (NTP/PTP), Konsolenserver Opengear CM8148, Medienkonverter-Chassis, WLAN-Controller Cisco 9800-L, KVM (ATEN CL5716,
  CS1716A), Smart-PDUs (APC AP7920B, generisch C13/C19), LWL-Patchfeld 24× LC, Patchfeld 48× RJ45, Bürstenleiste.
  Neue Stecker: QSFP, LC-Duplex, VGA.
- **Mehrfeld-Racks:** Doppel-, Triple- und Kombiracks mit beliebig vielen Einbaufeldern. Jedes Feld hat eigene Höhe,
  eigenen Standard (19"/10") und eine Position (nebeneinander, übereinander oder frei in mm); Felder dürfen unterschiedlich
  hoch sein. *Rack-Typen verwalten* → „Doppelrack daraus machen“, „Triple-Rack“, „Kombirack“ oder „+ Feld“, mit Vorschau und
  „Außenmaß aus den Feldern berechnen“. Mitgeliefert: Doppelrack 2 × 8 / 2 × 12 / 10 + 6 HE, Doppel-Shockmount 2 × 10 HE,
  Triple-Rack 3 × 10 HE, Kombirack 4 + 10 und 6 + 12 HE, 10"-Doppelrack. Geräte werden per Drag & Drop in das Feld unter
  dem Mauszeiger gesetzt (oder im Inspector unter „Einbaufeld“), Kabel laufen über alle Felder; Längen, 3D-Ansicht,
  3D-Kabelführung und PDF berücksichtigen die Felder.
- **LED-Wand-Prozessoren und weitere Videotechnik** (`src/library/devicesVideo.ts`): Novastar VX1000, VX4S-N, MCTRL4K,
  MX40 Pro, CVT10 Pro; Brompton Tessera SX40, S8, XD; Megapixel HELIOS; Barco Event Master E2 Gen 2; Analog Way
  Aquilon RS4; Blackmagic ATEM Television Studio 4K8, Ultimatte 12; disguise vx 2; AJA FS4; Lightware MX2-8x8; Decimator
  DMON-16S; Ross openGear-Rahmen; Riedel MediorNet MicroN UHD; generisch: LED-Prozessor, Medienserver 2 HE,
  HDBaseT-Sender, SDI-Multiviewer, SDI-Glasfaserstrecke. Modulare Systeme sind mit typischer Bestückung angelegt
  (in `source`/Notizen vermerkt). Neue Stecker: DisplayPort, DVI.
- **Oberfläche:** bewusst nüchtern wie ein CAD-Werkzeug: flache Flächen ohne Leuchtverläufe, kleine Radien,
  Abschnitte durch Linien statt Kästchen getrennt, Überschriften in normaler Schreibweise, Angaben mit Kommas statt
  Mittelpunkten. Überall die gleichen Regeln: zusammengehörige Knöpfe stehen als verbundene Gruppe, jeder Knopf hat
  einen Tooltip mit dem, was er tut, pro Ansicht gibt es genau einen farbigen Hauptknopf, Löschen steht rot und rechts
  bzw. links im Dialog, Anlegen ist türkis beschriftet. In den Eigenschaften steht oben der Name groß und editierbar,
  darunter die wichtigsten Werte (Außenmaß, Gewicht, Belegung, Länge) fett; Dialoge haben unten Abbrechen und eine
  eindeutige Hauptaktion.

### Arbeitsbereiche
Oben in der Kopfleiste wählst du den Arbeitsbereich: **Racks bestücken** (Geräte, Kabel, Kabelliste), **Rackgehäuse**
(das Gehäuse des Racks konstruieren), **Flightcases** (Cases konstruieren) und **Einlagen** (Schaumstoff mit Ausschnitten).
Jeder Bereich ist gleich und bewusst sparsam aufgebaut:

- **Objektleiste:** deine Racks, Cases oder Einlagen als Tabs, rechts *+ Neu* und ein Menü mit dem Namen des Objekts
  (*Rack ▾*, *Case ▾*, *Einlage ▾*) für Duplizieren und Löschen.
- **Werkzeugleiste:** links die Ansicht, dann die wenigen Werkzeuge des Bereichs; seltener Gebrauchtes steckt in Menüs
  (Trennwände, Werte aus einem Rack-Typ übernehmen). Rechts *Anzeigen ▾* mit den Seitenbereichen und Anzeigeoptionen
  (Anschlussnamen, Kabelbeschriftung, eingebaute Geräte).
- **Eigenschaften:** oben Name und wichtigste Werte, darunter aufklappbare Abschnitte. Zugeklappt zeigt jeder Abschnitt
  rechts eine Kurzfassung (z. B. „9 mm, Alu 30, Kugelecken“); welche Abschnitte offen sind, merkt sich die App.
  Lange Listen wie Anschlüsse, Vorlagen oder Bibliothekskategorien sind anfangs zugeklappt, die Suche zeigt Treffer sofort.
- Hinweise zur Bedienung einer Zeichenfläche stehen im **?** unten links (Tooltip).

### Einstellungen
Alle Einstellungen liegen in einem Dialog (*Einstellungen* oben rechts), sortiert nach Themen. Jeder Block sagt, ob er
für das Projekt gilt (in der Projektdatei gespeichert) oder für diesen Browser:

| Thema | Inhalt |
|---|---|
| Darstellung | Kabelverlauf, Text an den Kabeln, Anschlussnamen, Seitenbereiche und ihre Größen, 3D-Kontaktschatten, Geräte im Rackgehäuse |
| Kabel | Längenberechnung (Zuschlag, Serviceschlaufe, Biegeweg, Lagerlängen), Kabeltyp für neue Verbindungen, Kabeltypen und Farben, Kabel neu nummerieren |
| Racks | eigene Rack-Typen ansehen und löschen, Rack-Typen bearbeiten, Sprung zum Rack-Designer |
| Cases und Einlagen | Raster beim Ziehen, Abstand beim automatischen Anordnen, Schaumart und Farbe für neue Einlagen |
| Eigene Vorlagen | eigene Geräte, Rackblenden und Dosen anlegen und bearbeiten |
| Export | Voreinstellungen für das PDF der Bestückung (Format, Kabelliste, Geräteliste) |
| Projekt | Projektname, Ersteller oder Firma |

### Rack-Designer (Rackgehäuse)
Das Gehäuse eines Racks wird aus Parametern konstruiert statt aus einer Liste gewählt. Die Rack-Typen dienen nur noch
als Startpunkt (*Werte aus einem Rack-Typ übernehmen*), die eingebauten Geräte bleiben dabei erhalten.

- **Bauart:** Rackcase, Shockmount (Innenrack auf Gummi-Schwingmetall oder Dämpfungsschaum, Federweg einstellbar),
  Stahlschrank mit Glastür und Sockel, Open Frame.
- **Einbaufelder:** beliebig viele Felder mit HE und 19"/10", nebeneinander oder übereinander (Doppel-, Triple-,
  Kombirack), Abstand der Mittelwand.
- **Tiefe und Freiräume:** Einbautiefe (Schiene zu Schiene), Platz vor und hinter den Schienen, seitlich (Kabelkanal)
  sowie oben und unten, hintere Schienen ja/nein.
- **Deckel und Bauweise:** Innentiefe von Front- und Rückdeckel (0 = ohne), 4, 6 oder 8 Butterflyverschlüsse je Deckel,
  Plattenstärke, Kantenprofil, Laminatfarbe, Kugelecken, Klappgriffe je Seite, Stapelschalen, Lenkrollen.
- **Ergebnis:** Außenmaß und Leergewicht werden laufend berechnet und als Rack-Typ des Racks gespeichert, also auch für
  3D-Ansicht, Kabellängen und PDF der Bestückung verwendet. *Als Rack-Typ speichern* macht das Gehäuse für weitere Racks
  verfügbar.
- **Ansichten:** Zeichnung mit Vorderansicht ohne Frontdeckel (Schienen mit Lochung und die eingebauten Geräte),
  Seitenansicht geschlossen (Deckel, Schließprofile, Verschlüsse, Griffe, Rollen) und Schnitt von oben, in dem jedes
  Gerät mit seiner Tiefe eingezeichnet ist; zu tiefe Geräte werden rot markiert und in den Eigenschaften aufgelistet.
  3D wie im Case-Designer, mit abnehmbarem Frontdeckel und den Gerätefronten.
- **Stückliste und Export:** Plattenzuschnitte (Korpus, Deckel, Innenrack, Rollbrett), Profillängen, Verschlüsse,
  Griffe, Dämpfer, Rackschienen je Feld, Rollen; PDF mit Zeichnung und Stückliste für den Casebauer.

### Case-Designer (Flightcases)
Pro Projekt beliebig viele Cases, gespeichert in der Projektdatei.

- **Flightcases frei gestalten:** Innenmaß (L × B × H), Deckel (abnehmbar, Scharnierdeckel, Teleskop- bzw. Stülpdeckel oder ohne)
  mit Deckelhöhe, Plattenstärke, Kantenprofil (Alu 30 / 35 mm oder ohne), Laminatfarbe, Kugelecken. Außenmaß und Gewicht
  stehen oben in den Eigenschaften und werden aus Innenmaß, Platten, Profilen, Schaum und Rollen berechnet.
- **Beschläge pro Seite:** Butterflyverschlüsse groß/klein, Klappgriffe, Riemengriffe, Scharniere, Stapelschalen,
  Etikettenhalter, Gleitkufen, Lenkrollen mit und ohne Bremse (75, 100, 125 mm). *Passend zur Größe setzen* schlägt eine
  übliche Bestückung vor.
- **Ansichten:** Maßzeichnung (Innenansicht, Vorder- und Seitenansicht mit Beschlägen) und 3D (Deckel auf/zu,
  Scharnierdeckel klappt auf). Dargestellt wie ein gebautes Case: Laminat mit Hammerschlag-Struktur, Alu-Winkelprofile mit
  Profilquerschnitt und Nieten, Hybrid-Schließprofil mit Fuge, Kugelecken mit Flanschen, gedrückte Schalen für
  Butterflyverschlüsse und Klappgriffe, Lenkrollen mit gerundetem Reifen, Nabe, Drehkranz, Gabel und Bremspedal. In 3D mit
  Umgebungsspiegelung, weichen Schatten und Kontaktschatten in Vertiefungen (Ambient Occlusion).
- **Stückliste:** Plattenzuschnitte, Profillängen, Beschläge, Schaumteile mit Plattenaufbau, Gewicht und Volumen.
- Den Schaumstoff gestaltest du im Einlagen-Designer (*Einlage bearbeiten*).

### Einlagen-Designer (Schaumstoff-Zuschnitte)
Eigener Arbeitsbereich für Schaumstoff-Einlagen. In der Liste stehen Schubladen-Einlagen, freie Einlagen und die Einlage
jedes Flightcases.

- **Behälter:** Rackschublade (im Rack die Schublade wählen → *Schaumstoff-Einlage gestalten*, oder *+ Neue Einlage*),
  beliebiger Behälter mit eigenen Innenmaßen (gekaufter Koffer, Transportbox, Werkzeugkiste) oder ein Flightcase aus dem
  Case-Designer (Unterteil und Deckel als eigene Ebenen).
- **Ausschnitte:** eigene Maße, 16 Vorlagen oder Geräte aus der Bibliothek. Rechteckig mit einstellbarem Eckenradius oder
  rund/oval, Schnitttiefe getrennt von der Höhe des Inhalts, Griffmulden (halbrund) an jeder Seite, Name als Gravur.
  Schubladen-Einlagen bekommen für jede Zeile der Inhaltsliste einen Ausschnitt (zunächst 100 × 60 mm).
- **Anordnen:** ziehen mit Raster 1, 5 oder 10 mm (`Alt` = frei), *Automatisch anordnen* mit Abstand (beides unter *Einstellungen → Cases und Einlagen*)
  (MaxRects); was nicht passt, liegt rot markiert daneben. Holz-Trennwände längs und quer. Warnungen bei Überlappung,
  Ausschnitt im Randschaum oder zu wenig Höhe.
- **Schaumstoff:** PE (fest, geschlossenzellig), PU (weich) oder EVA (dicht, glatt), Farbe, Boden-, Rand- und Deckelstärke.
  Die Stückliste zeigt, aus welchen handelsüblichen Plattenstärken sich jede Lage zusammensetzt (z. B. 70 mm = 50 + 20 mm).
- **Zuschnittplan:** Draufsicht mit Gesamtmaßen, Positionsmaßen des gewählten Ausschnitts und einem Schnitt mit den
  Schnitttiefen. Unten die Zuschnittliste mit Form, Maß, Tiefe, Position und Griffmulden.
- **Export:** DXF für den Zuschneider (1:1, Ausschnitte als geschlossene Polylinien mit Radien und Griffmulden, Layer
  `KONTUR` / `AUSSCHNITT` / `GRAVUR`, Namen und Tiefen auf `INFO`, das nicht geschnitten wird) und Zuschnittplan als PDF.

**Genauigkeit:** Gewichte sind Schätzungen aus Dichten (Sperrholz 680 kg/m³, PE 30, PU 25, EVA 60 kg/m³, Alu-Profile
nach Meter) und typischen Beschlaggewichten. Plattenzuschnitte sind ohne Fräs- und Falzzugaben gerechnet, das
genaue Maß legt der Casebauer fest. Die Innenmaße von Schubladen sind aus Frontbreite, Tiefe und HE abgeleitet
(Schätzung); vor dem Schaumzuschnitt an der Schublade selbst nachmessen. Die Plattenstärken je Schaumart sind übliche
Handelsgrößen; was dein Zuschneider vorrätig hat, kann abweichen.

### Austausch mit dem RF Frequency Manager (RF-Scan-Editor)
Beide Programme nutzen dieselben IDs (Produkt `Shure|AD4D`, Band `Shure|ULX-D|G50`). RF Frequency Manager muss dafür
nicht geändert werden.

- **Funkdaten pro Gerät** (Eigenschaften → „Funk (RF Frequency Manager)“): Band (mit Frequenzbereich), Zone, Kanalnamen,
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
- **Flightcases:** PDF mit Maßzeichnung und Stückliste je Case, dazu das DXF des Schaumzuschnitts.
- **Einlagen:** DXF für den Zuschneider und Zuschnittplan als PDF (siehe Einlagen-Designer).

Beispiele liegen in `beispiele/`.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm run build    # erzeugt dist/index.html (eine selbstständige Datei)
npm test         # Bibliothek prüfen (Stecker im Gehäuse, keine Überlappung, eindeutige Namen) + Case-Designer + 3D-Kollisionstest
```

Während `npm run dev` läuft, zeigt `http://localhost:5173/gallery.html` alle Marken-Geräte (Front + Rückseite) zum visuellen Abgleich
(`?id=shure-ad4q` für ein einzelnes Gerät).

Stack: React + TypeScript + Vite, zustand (State, Undo/Redo), SVG-Rendering, three.js (3D), jsPDF + svg2pdf (PDF).

```
src/model/      Datenmodell, Geometrie & Kabellängen, Store, Blenden-Geometrie, Stecker-Registry, cases.ts = Case-Designer,
                rackBuild.ts = Rack-Designer (Maße, Stückliste, Gewicht),
                inlay.ts = Einlagen (Umrisse, Griffmulden, Schaumarten, Plattenaufbau)
src/library/    Geräte- (devicesBranded.ts = Marken-Geräte, devicesPro.ts + proLayout.ts = Profi-Geräte), Rack- und Kabeltyp-Bibliotheken, Beispielprojekt
src/render/     SVG-Darstellung (Rack, Geräte, Stecker, Kabel, Blenden) – auch für Export & 3D-Texturen
src/ui/         Oberfläche, Editoren, Dialoge
src/three/      3D-Ansicht, route3d.ts = kollisionsfreie Kabelführung, caseParts.ts = Case-Bauteile, Scene3D.tsx = Studio-Betrachter
tests/          library.ts: Prüfung der Gerätebibliothek, cases.ts: Packen, Außenmaß, Stückliste, Einlagen, Rack-Designer,
                collision3d.ts: Kollisionsprüfung der 3D-Kabel
src/export/     PDF, PNG/SVG, interaktives HTML, DXF
```
