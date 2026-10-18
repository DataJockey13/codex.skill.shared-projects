# Konfigurationsvertrag V1

Das [JSON-Schema](shared-project.schema.json) unterstützt Editoren. Die
Werkzeuge prüfen zusätzlich native Pfadbezüge, Paketmanifeste und Identität.

Die Projektdatei heißt `shared-project.json`. Die Eingabe einer Ersteinrichtung
hat dieselben Felder ohne `schemaVersion`, `toolkitVersion` und `projectId`;
diese setzt das Werkzeug. Das Grundmodul nutzt `apps: {}` und braucht keine
package.json oder npm-Installation.

```json
{
  "schemaVersion": 1,
  "toolkitVersion": "1.0.0",
  "projectId": "bcfa3b54-c176-4b45-ad6c-b95269264be1",
  "bases": {"darwin": "/Users/example/Shared", "win32": "Z:\\Shared", "wsl": "/mnt/z/Shared"},
  "paths": {"project": "Source/MyApp", "api": "Source/API"},
  "apps": {
    "web": {
      "path": "web",
      "profile": "npm-vite",
      "sources": ["."],
      "exclude": ["coverage"],
      "restart": ["vite.config.ts", "tsconfig.json", ".env"],
      "commands": {"dev": {"script": "dev"}, "test": {"script": "test"}, "build": {"script": "build"}, "preview": {"script": "preview"}},
      "runtime": {"range": "^22.18.0 || >=24.12.0", "fallback": "24.22.0"},
      "buildOutput": "dist",
      "exportPath": "Exports/MyApp",
      "envPaths": {"MY_API_ROOT": "api"}
    }
  }
}
```

Das ist ein Beispiel, keine Voreinstellung für Namen, Ports oder Node-Version.
Für neue Apps erzeugst du zuerst das gewünschte Projekt ohne native Module im
gemeinsamen Ordner. Eine Lockdatei lässt sich gezielt mit `npm install
--package-lock-only --ignore-scripts` erzeugen; das ist ein gesonderter,
sichtbarer Vorbereitungsschritt.

## Bezüge und Auflösung

- `bases`: absolute native Anker für `darwin`, `win32`, `linux`, gesondert
  `wsl`. WSL wird anhand der Prozessumgebung erkannt. Linux/WSL ist kein nativ
  geprüftes V1-Ziel.
- `paths`: relativ zu SHARED_ROOT, mit `/`. `project` ist erforderlich.
  `.` bezeichnet die Basis. Kein `..`, Laufwerk, leeres Segment oder
  Pfadausbruch über Symlinks.
- `apps.*.path`: relativ zum **Projekt**, nicht zur Basis. Appnamen sind
  eindeutig, klein geschrieben, mit Buchstaben, Ziffern und Bindestrichen.
  Ein Manifest darf nur einer App gehören.
- `sources`, `exclude`, `restart`, `buildOutput`: relativ zur **App**.
  Quellauswahl sind konkrete Dateien/Verzeichnisse, keine Globs. `.` nimmt alle
  Dateien auf. node_modules, .git, .runtime, .shared-project, reservierte
  `.shared-*`-Dateien und die Buildausgabe sind immer ausgeschlossen.
  package.json, package-lock.json und vorhandene .npmrc werden ergänzt.
- `exportPath`: relativ zur **Basis**. Ein Ziel in der App muss durch
  `buildOutput` oder `exclude` ausgeschlossen sein. Es darf keine Quelle ersetzen.
- `envPaths`: explizite Umgebungsvariablen für logische Pfade; Home-, Codex-
  und PATH-Variablen sind hierfür nicht verfügbar.

Der Resolver validiert die Projektkennung am Anker und prüft dieselbe
Quellinstanz wie im geöffneten Projekt. Ein explizites `SHARED_ROOT` wird bei
Fehler abgewiesen, ohne stillen Fallback. Ansonsten werden konfigurierter Anker
und der aus dem Layout abgeleitete alternative Mount geprüft. POSIX vergleicht
Groß-/Kleinschreibung exakt; Windows verwendet seine eigenen Pfadregeln.

## Befehle und Node

`npm` und `npm-vite` nutzen dieselbe lokale npm-Ausführung. Das Vite-Profil
konfiguriert vorhandene Skripte ohne Vue-, Port- oder Frameworkannahmen.
Eigene Codegenerierung, Tests, pre/post-Skripte und Installationshooks bleiben
erhalten. Ergänzt werden `shared:<Aufgabe>`-Wrapper. Im lokalen Manifest
werden nur die erkannten eigenen Wrapper entfernt, um Rekursion zu verhindern.

Ein Befehl ist entweder `{"script":"build"}` für ein vorhandenes npm-Skript
oder `{"node":["scripts/task.mjs","--flag"]}` als direkte Argumentliste ohne
zusätzliche Shell. Vite-Beispiel: `{"node":["node_modules/vite/bin/vite.js",
"--host","127.0.0.1"]}`. Weitere Aufgabenargumente werden weitergereicht.
Befehle und Lifecycle-Skripte sind Projektcode und vor Einrichtung zu prüfen.

`range` und `engines.node` unterstützen stabile dreiteilige Versionen, `=`,
`<`, `<=`, `>`, `>=`, `^`, `~`, durch Leerzeichen verknüpfte Vergleiche und
`||`. Unbekannte Semver-Syntax wird abgewiesen; übersetze sie bei Einrichtung
in einen gleichwertigen unterstützten Bereich. Die Fallbackversion muss den
Bereich erfüllen. Eine geeignete vorhandene Version bleibt im Gebrauch.
Sonst wird die offizielle Distribution passend zu Plattform und Prozessarchitektur
über HTTPS geladen, anhand SHASUMS256.txt geprüft und lokal gestuft installiert.
TLS-/Hashfehler brechen ab. `tar`/`tar.exe` wird zum Entpacken benötigt.

Ein erstes ausführbares Node ab Version 18 wird vorausgesetzt. Fehlt es,
installiere eine passende vollständige Distribution mit npm von
[nodejs.org](https://nodejs.org/en/download), öffne eine neue Shell und prüfe
`node --version` sowie `npm --version`. Das Werkzeug ändert keine systemweite
Node-Version und keine Sicherheitsrichtlinie.

V1 unterstützt eigenständige npm-Apps mit Lockdatei. npm-Workspaces und
Symlinks in ausgewählten Quellen werden abgewiesen. `file:`-/`link:`-
Paketabhängigkeiten dürfen die App nicht verlassen. Monorepos und externe
Build-Eingaben brauchen ein passendes zusätzliches Profil.
