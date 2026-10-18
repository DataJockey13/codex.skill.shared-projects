# Architektur der ersten nutzbaren Version

Stand: 18.10.2026. Toolkit und Vorlagenversion: 1.0.0.

Die kanonische Implementierung liegt im eigenständigen Skillpaket unter
[skills/setup-shared-project](skills/setup-shared-project/SKILL.md). Es gibt
keine zweite manuell gepflegte Werkzeugkopie. Einrichtung kopiert diese
Werkzeuge in das Zielprojekt; Paketmanifest und Installationszustand halten
Prüfsummen fest. Die eingefrorene Referenz bleibt davon unabhängig.

| Teil | Aufgabe |
| --- | --- |
| `scripts/lib/core.mjs` | Konfigurationsprüfung, native Pfade, Umgebungskennung, lokale Cachebasis |
| `scripts/lib/setup.mjs` | Untersuchung, gespeicherter Plan, verwaltete Abschnitte/Skripte, Update, Journal, Rollback, gezielte Migration |
| `scripts/lib/runtime.mjs` | Lokale Quellkopien, npm-Lifecycle, Aufgabenisolation, Dev-Abgleich, Build/Preview/Export |
| `scripts/lib/node.mjs` | Unterstützte Node-Bereiche, vorhandene Laufzeit, offizieller Bootstrap, Prozessausführung |
| `scripts/lib/lock.mjs` | Exklusiver Erwerb, Besitzerprüfung, Umgang mit Abbrüchen und fremden Hosts |
| `scripts/lib/package.mjs` | Vollständige Skill-Dateiliste und SHA-256-Paketprüfung |
| `scripts/cli.mjs` | Projektoperationen ohne Paketabhängigkeiten des Toolkits |
| `scripts/install-skill.mjs` | Native persönliche Skillinstallation und erhaltende Updates |
| `scripts/verify-native.mjs` | Unabhängige synthetische Abnahme mit optionalem Vite und echtem Bootstrap |

## Daten und Zuständigkeit

`shared-project.json` enthält Schema-/Toolkit-Version, stabile Projektkennung,
native Basisanker, basisrelative logische Pfade und optionale Apps mit
projektrelativen Apppfaden. Nach Einrichtung ist die Konfiguration benutzereigen;
Updates übernehmen nur beauftragte Felder und die Vorlagenversion. Die
[Konfigurationsreferenz](skills/setup-shared-project/references/configuration.md)
und das [JSON-Schema](skills/setup-shared-project/references/shared-project.schema.json)
beschreiben die Bezüge.

`.shared-project/state.json` verwaltet Ausgangshashes und einzelne Skriptwerte.
Eigene Texte außerhalb markierter Anweisungsabschnitte und eigene npm-Skripte
bleiben erhalten. Änderungen innerhalb verwalteter Ressourcen blockieren deren
Update als konkrete Konflikte. Das Journal enthält die Ausgangsinhalte für den
Rückweg. Ein gespeicherter Plan wird mit denselben Inhalten angewendet und
vorher auf veränderte Ausgangsdateien geprüft.

## Laufzeitentscheidung

Der lokale Pfad ist nach folgendem Muster aufgebaut:

```text
<lokaler Cache>/projects/<projectId>/<Hash des logischen Projektpfads>/
  <Plattform>-<Architektur>-node<Hauptversion>-abi<ABI>/<App>/<Aufgabe>/
```

Ein Besitzerbeleg verhindert, dass eine unabhängige Kopie mit übernommener
Kennung eine existierende Quellkopie überschreibt. Gleiche Projektpfade auf
alternativen Mounts sind logisch identisch; der Resolver und die lokale
Dateiidentität müssen dieselbe tatsächliche Quelle bestätigen. Diese
Aliasprüfung ist auf Windows noch nativ zu prüfen.

Build, Export und Preview teilen bewusst eine Laufzeit und eine Sperre.
Dev, Setup und jede Prüfung haben eigene Laufzeiten. npm ci erhält eigene
Skripte und Hooks; nur die eigenen Shared-Wrapper werden im abgeleiteten
Manifest entfernt. Eine Installation erfolgt bei geändertem Fingerprint.
Lokale Abhängigkeiten werden beim Quellabgleich nicht kopiert oder gelöscht.

## Prüfung und Grenzen

Die automatisierten Verhaltenstests unter `tests/` verwenden ausschließlich
synthetische Projekte. Die native Abnahme prüft zusätzlich echtes npm/Vite,
HTTP-Dev/Preview, parallele Aufgaben, gestuften Export und Node-Download.
Die konkreten Ergebnisse stehen im [Prüfstatus](VERIFIKATION.md).

V1 enthält keine vollständige Unterstützung für npm-Workspaces, weitere
Paketmanager oder WSL-Laufzeiten. Ausgewählte Symlinkquellen und externe
file:-Paketabhängigkeiten werden abgewiesen. Die Befehle sind konfigurierter
Projektcode; das Toolkit ist keine Sandbox für beliebige Build-Skripte.
Ein erstes ausführbares Node und tar werden vorausgesetzt. Es gibt keine
globale Node-Installation, Änderung von Codex-Home oder Sicherheitsrichtlinien.

Windows-Abnahme und Installation erfolgen im nativen Gast mit demselben
Skillpaket. Die historische Windows-Abnahme der Referenz ist kein Nachweis
für diese Implementierung. Veröffentlichung und Migration vorhandener
Anwendungsprojekte sind nicht Teil dieser Entwicklung.
