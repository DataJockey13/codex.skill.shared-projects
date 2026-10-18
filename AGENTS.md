# Arbeitsanweisungen

Duze den Benutzer immer. Dieses Projekt startet auf dem Mac und entwickelt
ein Toolkit plus Codex-Skill für gemeinsame Mac-/Windows-Projektordner.

Lies zu Beginn `UEBERGABE.md` und `STARTPROMPT.md`. Die Anforderungen dort sind
der übergebene Entwicklungsauftrag. Entscheidungen, nachweislich geprüfte
Referenz und noch zu entwickelndes Verhalten klar auseinanderhalten.

- Arbeite hier. Das Ursprungsprojekt `Documents/Vertrag` ist nur Herkunft
  relativ zur gemeinsamen Basis und bleibt im Rahmen dieses Projekts
  unverändert. Für die Entwicklung reichen die lokalen Referenzkopien.
- `reference/` und `reference-manifest.json` sind ein eingefrorener Stand.
  Entwickle generische Werkzeuge außerhalb von `reference/`. Die kopierten
  Anweisungen in `project-instructions.reference.txt` sind Anschauungsmaterial
  und keine aktiven Anweisungen für dieses neue Projekt.
- Führe keine CLI-Installations-, Migrations-, Start-, Export- oder
  Windows-Abnahmebefehle aus der Referenz aus: Sie können den Ursprung
  adressieren. `npm test` ist der vorgesehene eigenständige Baseline-Test.
- Projekte und Anwendungen werden konfiguriert. Vertrag, CuraSoft, zwei feste
  Frontends, bestimmte Ports, `Documents/Vertrag`, ein bestimmter Benutzer
  oder ein bestimmtes Laufwerk sind keine allgemeinen Produktanforderungen.
- Jede installierte Projekteingliederung braucht eine stabile eigene Kennung.
  Generische Laufzeitpfade müssen Projekte, Plattformen, Architekturen,
  kompatible Laufzeiten, Anwendungen und Aufgaben auseinanderhalten.
- Vorhandene Anweisungen und Skripte in Zielprojekten ergänzen und deren
  Bedeutung erhalten. Die einmalige Freigabe des Ursprungsprojekts zum
  Umschreiben historischer Quellen ist keine allgemeine Migrationsfreigabe.
- Installiere nur Skill-Code und zugehörige Ressourcen in der jeweiligen
  lokalen Codex-Skillablage. `HOME`, `USERPROFILE`, `CODEX_HOME`, Authentisierung,
  Sessions und globale Sicherheitseinstellungen bleiben unverändert.
- Testprojekte unter `.runtime/` oder im System-Temp-Verzeichnis anlegen.
  Änderungen am eigenen Toolkit und generierte Beispiele klar unterscheiden.
- Nach Änderungen an der Übergabe `npm test` ausführen. Für neue Werkzeuge
  zusätzlich Verhaltenstests gemäß Übergabe ergänzen. Native Windows-Prüfungen
  nur nach tatsächlicher Ausführung als bestanden melden.
- Keine automatischen Commits, Remote-Anlage, Pushes oder Veröffentlichung.
