# Übergabe für Codex Projekte auf Mac und Windows

Stand: 18.10.2026. Dieses Projekt beginnt auf dem Mac. Ziel ist eine erste
nutzbare Version eines wiederverwendbaren Starterpakets und des persönlichen
Codex-Skills `setup-shared-project`. Die Implementierung im Ursprungsprojekt
ist die geprüfte technische Grundlage. Ihre Verallgemeinerung ist die nächste
Arbeit und wurde mit dieser Übergabe noch nicht vorweggenommen.

## Auftrag und verbindliche Entscheidungen

Der Benutzer hat die folgende Lösung im Projekt Vertrag einsetzen lassen und
anschließend als wiederverwendbare Vorlage mit Codex-Skill beauftragt:

1. Mac und Windows in Parallels bearbeiten denselben gemeinsamen Quellordner.
2. Eine gemeinsame Basis `SHARED_ROOT` umfasst Projektordner und weitere
   Quellordner. Verzeichnisreferenzen werden relativ zu dieser Basis gespeichert.
3. Die tatsächliche Ausführungsumgebung löst die Basis automatisch auf.
   Windows nativ, macOS und WSL sind dabei verschiedene Umgebungen.
4. Native Abhängigkeiten, Caches und Builds liegen lokal und getrennt.
   `node_modules` wird zwischen Mac und Windows nicht umgeschaltet oder geteilt.
5. Ein Grundmodul richtet Pfade und Codex-Anweisungen ein. Das Node-/npm-Modul
   ist optional und wird passend zum Zielprojekt eingerichtet.
6. Der Skill unterstützt neue und bestehende Projekte, übernimmt die
   Untersuchung und angepasste Einrichtung und prüft das Ergebnis.
7. Jedes Zielprojekt bekommt eine stabile eigene Kennung und eine
   Vorlagenversion. Aktualisierungen erhalten eigene Projektanpassungen.
8. Die Quelle wird in diesem neuen Projekt verwaltet. Der erste Skill soll
   auf dem Mac installiert werden; für Windows wird derselbe Skill-Code
   separat in der dortigen persönlichen Codex-Umgebung installiert.

Der Benutzer startet das neue Codex-Projekt selbst. Es wurde kein weiterer
Chat erzeugt und keine Nachricht an einen anderen Chat geschickt.

## Herkunft und belastbarer Referenzstand

Die Herkunft ist `Documents/Vertrag`, relativ zur dort verwendeten gemeinsamen
Basis. Die konkreten beiden Basispfade sind in der kopierten
[Referenzkonfiguration](reference/vertrag/workspace.paths.json) sichtbar.
Sie dienen als Benutzerbeispiel und werden im Produkt konfigurierbar.

[reference-manifest.json](reference-manifest.json) ordnet alle 13 kopierten
Dateien ihrem Original zu und enthält Größe sowie SHA-256. Alle Kopien sind
unverändert. Die vollständige ursprüngliche
[technische Abnahme](reference/vertrag/verification.reference.json) ist enthalten.

| Tatsächlich geprüfte Umgebung | Ergebnis am 18.10.2026 |
| --- | --- |
| macOS, ARM64, Node 26.8.1 | Acht Infrastrukturtests, 92 Frontendtests, 92 Entwurftests, beide Typprüfungen und Builds bestanden |
| Windows in Parallels, Node-Prozess x64, lokal verwendetes Node 24.22.0 | Acht Infrastrukturtests, je 92 Frontend- und Entwurftests und beide Builds bestanden; gemeinsame Basis validiert |
| Dev-Betrieb auf dem Mac | Geänderte und gelöschte gemeinsame Dateien in lokaler Laufzeit und HTTP-Auslieferung geprüft |
| Vorschau und Export auf dem Mac | HTTP-Vorschau und Export in den gemeinsamen Ausgabeordner geprüft |

Windows hatte zuvor Node 22.11.0. Die Tests liefen teilweise bereits damit,
der Build scheiterte. Die lokale Node-LTS-Ergänzung löste das Problem, ohne
die systemweite Installation zu verändern. Die native Windows-Prüfung wurde
vom Benutzer im Gast gestartet; ihre JSON-Ergebnisse wurden anschließend
über die gemeinsame Freigabe geprüft.

Die Windows-VM ist vorhanden. `prlctl exec` war durch die installierte
Parallels-Edition gesperrt; UI-Eingaben konnten nicht zuverlässig übertragen
werden. Der neue Chat darf deshalb weder einen verfügbaren allgemeinen
Gast-Shellzugang annehmen noch den alten Windows-Erfolg als Abnahme des
neuen Toolkits ausgeben.

Die App-Quellen, Vertragsdaten und 184 fachlichen Tests pro Betriebssystem
sind nicht mitkopiert. Die Übergabe kann unabhängig davon ihre acht
ursprünglichen Infrastrukturtests erneut ausführen. Das Ursprungsprojekt
bleibt für diese Entwicklung unverändert.

## Referenzdateien und ihr Nutzen

| Referenzdatei unter reference/vertrag | Wiederverwendbarer Teil | Vor der Verallgemeinerung beachten |
| --- | --- | --- |
| [tools/paths.mjs](reference/vertrag/tools/paths.mjs) | Native Pfadauflösung, expliziter Override, Prüfung der Workspace-Identität, alternativer Mount | Konfiguration ist noch auf den Ursprung ausgerichtet; Groß-/Kleinschreibung wird beim Layoutvergleich pauschal normalisiert |
| [tools/frontend.mjs](reference/vertrag/tools/frontend.mjs) | Quellabgleich, lokale Installationen, Fingerprint, Sperren, Dev-Betrieb, gestufter Export | Namen, zwei Anwendungen, Vue-/Vite-/Testbefehle und Quellauswahl sind fest eingebaut; Cache enthält noch keine unabhängige Projektkennung |
| [tools/node-runtime.mjs](reference/vertrag/tools/node-runtime.mjs) | Erkennen einer zu alten Laufzeit, offizieller Download mit SHA-256-Prüfung, erneuter Prozessstart | Cache-Namespace und Versionsanforderung sind noch projektspezifisch; abgebrochene Bootstrap-Sperren brauchen eine belastbare Behandlung |
| [tools/tests/workspace.test.mjs](reference/vertrag/tools/tests/workspace.test.mjs) | Acht Verhaltenstests für Pfade, Versionen, Quellabgleich und Sperren | Projektübergreifende Cache-Trennung und erhaltende Updates sind noch nicht abgedeckt |
| [tools/verify-windows.mjs](reference/vertrag/tools/verify-windows.mjs) | Native Prüfung mit maschinenlesbarer Ergebnisdatei | Ruft noch die beiden ursprünglichen Anwendungen auf und darf hier nicht ausgeführt werden |
| [tools/migrate-paths.py](reference/vertrag/tools/migrate-paths.py) | Anschauung der einmaligen Pfadmigration | Kein allgemeiner Migrator; breite Text-Ersetzungen und zusätzliche JSON-Metadaten waren Teil des damaligen Auftrags |
| [frontend.package.reference.json](reference/vertrag/frontend.package.reference.json) und [Lockdatei](reference/vertrag/frontend.package-lock.reference.json) | Nachweis der Paketversionen und bisherigen Wrapper | Keine generische App-Konfiguration; vorhandene Zielskripte müssen erhalten bleiben |
| [frontend.vite.reference.ts](reference/vertrag/frontend.vite.reference.ts) | Getestetes Beispiel für Dev-/Build-/Preview-Konfiguration | Ports und Web-Basispfad sind keine Produktvorgabe |
| [project-instructions.reference.txt](reference/vertrag/project-instructions.reference.txt) | Konkretes Beispiel für Regeln in einem eingerichteten Projekt | Informationsquelle; Wiki-, API-, Archiv- und datierte Sonderregeln nicht übernehmen |

Die ausführbaren Referenzdateien behalten ihre ursprüngliche Konfiguration.
Ihre CLI-Einstiegspunkte können weiterhin das Ursprungsprojekt adressieren.
Der sichere Einstieg für diese Übergabe ist ausschließlich `npm test`.

## Zielarchitektur der ersten Version

Eine zentrale Konfiguration beschreibt die gemeinsame Basis, logische Pfade,
Projektidentität und optionale Anwendungen. Der Resolver ist von Node-/Vite-
Spezifika getrennt. Ein Projekt ohne Node-Anwendung bekommt nur das Grundmodul.

Das Node-Modul unterstützt zunächst npm mit Lockdatei und ein konfigurierbares
Vite-Profil. Weitere Paketmanager, Python, PHP, Delphi oder vollständige
WSL-Laufzeitunterstützung werden nicht als bereits vorhandene Fähigkeiten
behauptet. Die Struktur darf spätere Profile ermöglichen, ohne sie jetzt
vollständig implementieren zu müssen.

Der Skill enthält den Einrichtungsablauf und die benötigten Werkzeuge bzw.
Vorlagen. Seine installierte Fassung muss eigenständig verwendbar sein und
darf zur Laufzeit nicht auf diesen Source-Ordner oder das Vertrag-Projekt
angewiesen sein. Pflege generische Werkzeuge an einer kanonischen Stelle;
eventuell erzeugte Paketkopien werden versioniert bzw. beim Packen geprüft.

Ein möglicher, noch anzupassender Aufbau:

```text
skills/setup-shared-project/
  SKILL.md
  agents/openai.yaml
  scripts/
  assets/project-template/
  references/
tests/
reference/vertrag/          eingefrorene Herkunft
scripts/verify-handoff.mjs
```

Verwende `skill-creator` für den technischen Skill. Der Artefakt-Template-
Mechanismus für Dokumente, Bilder oder Sites ist für dieses Projekt nicht
zuständig. Eine Veröffentlichung als Plugin oder Marketplace ist kein Teil
des Auftrags. Ein persönlicher Skill genügt für Version 1.

Offizielle Grundlagen für den neuen Chat:

- [Skills mit Anweisungen und Ressourcen](https://developers.openai.com/plugins/concepts/skills)
- [Skills erstellen](https://learn.chatgpt.com/docs/build-skills)
- [Projektanweisungen über AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

Vor aktuellen Produkt- oder Installationsaussagen die offizielle Dokumentation
und die im neuen Chat tatsächlich verfügbaren Skill-Anweisungen beachten.

## Konfigurationsvertrag

Die genaue Schemaform entwirft der neue Chat. Folgende Informationen müssen
ausdrücklich und eindeutig darstellbar sein:

| Information | Bedeutung |
| --- | --- |
| Schema- und Toolkit-Version | Formatprüfung und reproduzierbare Aktualisierung |
| Stabile Projektkennung | Keine Kollision verschiedener Projekte in Cache, Sperren oder Installationszustand |
| Gemeinsame Basis je Umgebung | Nur hier werden umgebungsspezifische absolute Anker gespeichert |
| Projektpfad und weitere logische Pfade | Relativ zur gemeinsamen Basis, beispielsweise unter Source oder Documents |
| Anwendungen und Profile | Beliebige eindeutige Namen statt ausschließlich frontend/design |
| Anwendungspfad | Eindeutig definierter Bezug zum Projekt; nicht stillschweigend mit SHARED_ROOT-relativen Pfaden mischen |
| Ausführungsbefehle | An das Zielprojekt angepasste Argumentlisten oder kontrollierte Paket-Skripte |
| Laufzeitanforderungen und Bootstrap-Version | Versioniert, nachvollziehbar und optional pro Profil konfigurierbar |
| Quellauswahl und Ausgabeziele | Passend zur Anwendung; keine feste Annahme, dass nur src/tests/public existieren |
| Installationszustand | Verwaltete Dateien, Abschnitte, Ausgangshashes und angewandte Vorlagenversion |

Die Kennung bleibt bei einem Update erhalten. Unabhängige Projekte erhalten
unterschiedliche Kennungen, auch wenn ihre Anwendung gleich heißt. Für Kopien
oder Worktrees mit übernommener Kennung muss ein unterschiedlicher Quellstand
zusätzlich isoliert oder eine Kollision erkannt werden.

Eine ausdrücklich gesetzte Basis muss validiert werden; keine stille
Ausweichzuordnung bei falschem Override. POSIX- und Windows-Pfadregeln getrennt
behandeln. Ein Windows-Laufwerksname ist keine Linux-Basis. Logische relative
Pfade dürfen die Basis nicht verlassen. Dateirelative Markdown-Links bleiben
wirkliche Links, keine Platzhalter mit automatischer Viewer-Ersetzung.

## Einrichtung und Updates bestehender Projekte

Der erste Durchlauf untersucht Zielstruktur, bestehende Anweisungen,
Paketmanager, Laufzeitanforderungen und bereits vorhandene Einrichtung.
Eine Vorschau zeigt konkret, was angelegt, ergänzt oder migriert würde.
Der eigentliche Anwendevorgang verwendet denselben ermittelten Plan.

Vorhandene AGENTS-Dateien behalten ihre fremden Abschnitte. Ein klar
abgegrenzter verwalteter Abschnitt darf angelegt bzw. aktualisiert werden.
Unterordner mit eigenem Git-Kontext brauchen passende Einstiegshinweise,
wenn sonst die gemeinsamen Anweisungen nicht entdeckt werden. Eine Datei
erzwingt keine nachträgliche Systemnachricht in bereits laufenden Chats.

Paket-Skripte werden ergänzt oder gezielt weitergeleitet. Eigene Start-,
Codegenerierungs-, Test- und Installationsabläufe des Zielprojekts müssen
erhalten bleiben. Insbesondere löscht die Referenz im generierten
Laufzeitmanifest sämtliche Skripte; das ist für das Ursprungsszenario geeignet,
aber keine allgemeine Lösung für fremde Projekte. Verhindere Rekursion der
eigenen Wrapper gezielt.

Die einmalige Originalmigration war ausdrücklich für alle projektbezogenen
Pfadtexte einschließlich historischer Belege freigegeben. Ein allgemeiner
Skill darf daraus keine pauschale Erlaubnis zum Umschreiben von Rohquellen,
Zitaten oder Protokollen ableiten. Unterscheide Konfigurationspfade,
Linkziele, URL-/API-Angaben, Textbeispiele und fachliche Daten. Biete zuerst
einen überprüfbaren Migrationsplan; passe danach die vom aktuellen Auftrag
abgedeckten Stellen an und aktualisiere betroffene Prüfsummen nachvollziehbar.

Wiederholte Einrichtung ist idempotent. Updates kennen die zuvor installierte
Vorlagenversion und die verwalteten Ausgangsinhalte. Eigene Änderungen werden
erhalten bzw. als konkrete Konflikte ausgewiesen. Ein Versionswechsel darf
nicht einfach fremde Konfigurationen und ganze AGENTS-Dateien ersetzen.
Bei fehlgeschlagenen Teiländerungen muss ein nachvollziehbarer Rückweg bestehen.

## Lokale Laufzeiten und Abhängigkeiten

Ein geeignetes Cache-Schema enthält mindestens Projektkennung,
Quellinstanz/Checkout soweit nötig, Plattform, Architektur, kompatible
Node-Laufzeit, Anwendung und Aufgabe. Es ist unabhängig davon, ob die
gemeinsame Quelle unter einem bevorzugten oder alternativen Mount geöffnet ist.

Die gemeinsame Quelle ist die einzige manuell bearbeitete Codebasis. Lokale
Laufzeitkopien sind abgeleitet und ersetzbar. Dev überträgt Änderungen und
Löschungen; Neustartbedarf bei Paket-, Lockdatei- oder relevanten
Konfigurationsänderungen wird verständlich angezeigt. Vorhandene lokale
Abhängigkeiten werden beim Quellabgleich weder kopiert noch gelöscht.

Getrennte Projekte und Aufgaben dürfen sich nicht gegenseitig neu installieren
oder ihren Quellstand überschreiben. Gleichzeitige Starts derselben Laufzeit
werden koordiniert. Sperren brauchen einen definierten Umgang mit Abbruch,
veralteten lokalen PIDs und einem anderen Host beim gemeinsamen Ausgabeziel.

Erfolgreiche Builds entstehen zuerst lokal. Ein Export in ein gemeinsames
Ziel erhält einen separaten Lock und ersetzt das fertige Ergebnis gestuft.
Bei einem Fehler vor oder während des Austauschs bleibt das bisherige
brauchbare Ergebnis erhalten. Entscheide außerdem bewusst, ob Preview und
Build dieselbe Laufzeit sperren oder parallel unterstützt werden.

Der Node-Bootstrap benötigt zunächst bereits ausführbares Node. Er kann eine
zu alte Version lokal ergänzen; er löst das vollständige Fehlen eines ersten
Node-Programms noch nicht. Ermittle den Iststand und gib für diesen Fall eine
konkrete Installationsanleitung. Die konfigurierte Ersatzversion, Plattform
und Architektur müssen zur heruntergeladenen offiziellen Distribution passen.
TLS- und Prüfsummenfehler führen zum Abbruch. Systemweite Node-Versionen und
Sicherheitsrichtlinien werden nicht ungefragt verändert.

Ein npm-Installationshook ist kein unveränderlicher Schutz: Hooks können
deaktiviert werden, und npm kann vorher bereits Module angelegt haben. Die
Referenz sichert solche Module lokal und bricht ab. Behaupte daher nicht,
dass beliebige manuelle npm-Befehle technisch unmöglich wären.

## Skill und Installation auf beiden Systemen

Der vorgesehene Aufruf lautet beispielsweise:

```text
$setup-shared-project Richte dieses Projekt für Mac und Windows in Parallels ein.
```

Der Skill soll die Zielstruktur prüfen, nur benötigte Module wählen, die
passende Basis und verwandte Quellordner ermitteln, vorhandene Anweisungen
ergänzen und die konkrete Einrichtung testen. Fehlende entscheidende Angaben
erfragt er gezielt, während unabhängige Vorbereitung weitergehen kann.

Die Skill-Quelle liegt hier. Die persönliche installierte Skillkopie auf dem
Mac wird über den dort tatsächlich verwendeten Codex-Skillpfad eingerichtet.
Windows bekommt separat denselben geprüften Code samt Ressourcen in seine
lokale Skillablage. Ein Installer muss den Zielkontext eindeutig bestimmen und
sein Ergebnis prüfen; ein Laufwerk mit dem Mac-Home ist kein automatischer
Nachweis für die Windows-Skillinstallation.

Keine vollständigen Codex-Home-Verzeichnisse zusammenführen. Keine Sessions,
Auth-Dateien, Zugangsdaten, Plugin-Caches oder lokale Sicherheitskonfigurationen
als Teil des Templates kopieren. `HOME`, `USERPROFILE` und `CODEX_HOME` behalten
ihre reguläre Bedeutung.

## Empfohlene Reihenfolge

1. Übergabe mit `npm test` prüfen und kurz Architektur sowie Schema festlegen.
2. Generische Projektidentität, Pfadmodul und Cache-Isolation entwickeln.
3. Neue Einrichtung an zwei kleinen synthetischen Projekten mit verschiedenen
   Kennungen, aber gleichnamigen Anwendungen prüfen.
4. Konfigurierbares npm-/Vite-Profil, Laufzeitsynchronisation, Node-Bootstrap
   und Export aus der Referenz ableiten.
5. Bestehendes Projekt mit eigenen Skripten und AGENTS-Inhalten integrieren;
   Wiederholung, Update und Konfliktfall prüfen.
6. Den eigenständig verwendbaren Skill erstellen und auf dem Mac installieren.
7. Native Windows-Abnahme des neuen generischen Stands durchführen und den
   separaten Windows-Skillinstallationsweg prüfen bzw. offen kennzeichnen.

Die Reihenfolge ist eine Umsetzungsempfehlung. Konkrete Dateinamen und
interne Modulgrenzen darf der neue Chat sachgerecht wählen.

## Abnahmekriterien für Version 1

| Bereich | Beobachtbares Ergebnis |
| --- | --- |
| Reine Pfadeinrichtung | Funktioniert auch ohne package.json und legt keine unnötige Node-App-Struktur an |
| Neues Node-Projekt | Einrichtung mit eigener Projektkennung und passenden Befehlen; Tests und Build laufen lokal |
| Bestehendes Projekt | Eigene AGENTS-Abschnitte, Skripte und Konfigurationswerte bleiben erhalten |
| Wiederholung | Ein zweiter identischer Lauf erzeugt keine Duplikate und keine unnötigen Änderungen |
| Aktualisierung | Verwaltete unveränderte Teile aktualisieren sich; eigene Änderungen bleiben bestehen oder erscheinen als konkrete Konflikte |
| Zwei Projekte | Gleichnamige Anwendungen teilen keine veränderbare Installation, Quellkopie oder Sperre |
| Zwei Umgebungen | Dieselbe logische Datei ist über die jeweilige Basis erreichbar; kein gemeinsames natives node_modules |
| Pfadfehler | Falsche Overrides, fehlende Basis und unzulässige relative Pfade werden nachvollziehbar abgewiesen |
| Sonderzeichen | Pfade mit Leerzeichen und Umlauten funktionieren in Auflösung und Ausführung |
| Dev | Änderungen und Löschungen aus der gemeinsamen Quelle werden übernommen; eigener Quellstand bleibt erhalten |
| Gleichzeitigkeit | Dev und Prüfungen sowie unabhängige Projekte beeinflussen ihre Installationen nicht; gleiche Laufzeit wird koordiniert |
| Export | Gemeinsames Ausgabeziel ist gesperrt und Fehler erhalten den letzten brauchbaren Build |
| Bootstrap | Eine geeignete vorhandene Node-Version bleibt in Gebrauch; eine zu alte wird mit überprüftem lokalem Node ergänzt |
| Skill-Paket | Funktioniert nach Installation ohne Zugriff auf dieses Entwicklungsprojekt oder den Vertrag-Ursprung |
| Mac und Windows | Der neue Stand hat eigene native Prüfergebnisse; ursprüngliche Belege werden als Herkunft und nicht als neue Abnahme geführt |

## Ausgangslage dieses neuen Ordners

Bereits vorbereitet sind Übergabedokumente, unveränderte Referenzen, deren
Prüfsummen, eine eigenständige Baseline-Prüfung und ein lokales Git-Repository.
Es gibt noch keinen generischen Skill, keine Skill-Installation und keine
Veröffentlichung. Neue Produktdateien können hier angelegt werden.

Vorläufiger Name des Entwicklungsprojekts ist `codex-shared-projects`;
vorgesehener Skillname ist `setup-shared-project`. Start mit npm und Vite,
Grundmodul auch ohne Node-App. Diese Wahl blockiert keine spätere Erweiterung.

Die Kopie der ursprünglichen Basiskonfiguration bleibt als Referenz stehen.
Eine tatsächlich neu eingerichtete Anwendung bekommt eine eigene Konfiguration
und Kennung. Verwende die dokumentierten Benutzerpfade nur als konfigurierbare
Startwerte, nicht als fest eingebauten Produktcode.

## Umsetzung im Entwicklungsprojekt am 18.10.2026

Der zuvor beschriebene Ausgangsstand bleibt als Auftragsherkunft dokumentiert.
Inzwischen ist Toolkit/Skill 1.0.0 implementiert. Die kanonischen Werkzeuge
liegen im eigenständigen [Skillpaket](skills/setup-shared-project/SKILL.md).
[ARCHITEKTUR.md](ARCHITEKTUR.md) hält die getroffenen Implementierungsentscheidungen
fest; [VERIFIKATION.md](VERIFIKATION.md) trennt neue Nachweise von offenen
Prüfungen und historischer Referenz.

Umgesetzt sind Grundmodul, native Pfadauflösung, stabile Kennung, projekt- und
aufgabenisolierte Laufzeiten, konfigurierbares npm-/Vite-Profil, gespeicherter
Einrichtungsplan mit Ausgangshashes, erhaltende Updates, Konfliktanzeige,
Transaktionsjournal/Rollback, gezielte Pfadmigration, Quellabgleich,
Node-Bootstrap sowie gestufter Export und persönlicher Skillinstaller.
Vorhandene Anwendungsprojekte wurden dadurch nicht eingerichtet oder migriert.

Das Grundmodul und npm-/Vite-Verhalten werden an synthetischen Projekten
geprüft. Der Installer kopiert ausschließlich den Skill samt Ressourcen.
Neue native Windows-Abnahme und Windows-Skillinstallation sind gesondert
auszuführen; die Referenzprüfung wird weiterhin unverändert mitgeführt.

## Ergänzender Veröffentlichungsauftrag am 18.10.2026

Nach Abschluss der ersten Implementierung hat der Benutzer ausdrücklich ein
öffentliches Repository auf seinem GitHub-Account, die Einrichtung als origin,
Commit und Push des Projekts sowie eine Installationsanleitung für beide
Systeme beauftragt. Damit ist diese konkrete Veröffentlichung autorisiert;
die ursprüngliche Einschränkung automatischer Veröffentlichungen bleibt für
nicht beauftragte spätere Aktionen bestehen.

Der bestätigte Account ist DataJockey13. Vorgesehenes Repository ist
`DataJockey13/codex.skill.shared-projects`; die
[README](README.md) beschreibt die Installation aus dem öffentlichen
Skill-Unterordner sowie über den eigenen Installer. Als Verwaltungsvorbild
diente ausschließlich die README des bestehenden Maintain-Knowledge-Wiki-
Repositories. Dessen Projekt und installierter Skill wurden nicht verändert.
