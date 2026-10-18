Entwickle in diesem Projekt das wiederverwendbare Toolkit und den Codex-Skill
`setup-shared-project` für Projekte, die denselben Quellordner auf meinem Mac
und unter Windows in Parallels verwenden.

Lies zuerst `AGENTS.md` und `UEBERGABE.md`. Prüfe anschließend die unveränderte
technische Referenz mit `npm test`. Arbeite in diesem neuen Projekt weiter;
das ursprüngliche Vertrag-Projekt soll dabei unverändert bleiben.

Meine gewählten Grundlagen:

- Ein gemeinsamer bearbeiteter Quellordner ist über eine gemeinsame Basis
  erreichbar. Projekt- und externe Ordnerreferenzen werden relativ dazu
  gespeichert; die jeweilige Ausführungsumgebung löst sie automatisch auf.
- Ein Grundmodul richtet Pfade und Codex-Anweisungen ein. Ein optionales
  Node-/npm-Modul trennt native Abhängigkeiten, Caches und Builds je Projekt
  und Umgebung und übernimmt Änderungen aus dem gemeinsamen Quellordner.
- Das Toolkit soll neue und bestehende Projekte unterstützen. Vorhandene
  Projektanweisungen und eigene Anpassungen bleiben erhalten.
- Ein eigener Codex-Skill übernimmt Untersuchung, angepasste Einrichtung,
  Migration geeigneter Pfadverweise und anschließende Prüfung.
- Vorlagenversion, stabile Projektkennung und ein nachvollziehbarer
  Aktualisierungsweg gehören zur ersten Version.

Die Referenz ist für das Vertrag-Projekt nativ auf Mac und Windows geprüft.
Sie enthält noch feste Projektnamen, Laufzeitpfade, Anwendungen und Vite-/Vue-
Befehle. Verallgemeinere diese gezielt. Übernimm insbesondere nicht die
pauschale Textmigration oder das Entfernen sämtlicher npm-Skripte als
allgemeines Verhalten.

Beginne mit einem knappen Architektur- und Dateivorschlag und setze anschließend
die erste nutzbare Version um. Priorisiere das gemeinsame Pfadmodell,
projektisolierte Caches, ein npm-/Vite-Profil und idempotente Einrichtung
einschließlich erhaltender Aktualisierung. Verwende kleine synthetische
Testprojekte und die Abnahmekriterien aus der Übergabe.

Nutze den verfügbaren Skill `skill-creator` für den neuen technischen Skill.
Die Quelle des Skills und seine Ressourcen werden hier versioniert. Sobald
die erste Version geprüft ist, installiere sie in meiner persönlichen lokalen
Mac-Skillablage und liefere den entsprechenden Installationsweg für Windows.
Verbinde dafür nicht die vollständigen Codex-Benutzerverzeichnisse beider Systeme.

Bestehende Projekte werden durch die Entwicklung nicht automatisch migriert.
Teste Einrichtung und Updates zunächst an den synthetischen Beispielen.
Unterscheide in der Abschlussmeldung tatsächliche Mac-/Windows-Prüfungen von
noch offenen Prüfungen. Führe keine Veröffentlichungen oder Pushes aus.
