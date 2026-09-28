/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDocId, normalizeCalendarUrl, parseIcsEvents } from "@/lib/ics";

// Las pruebas asumen el teléfono en hora del centro de México (UTC-6, sin horario de verano).
process.env.TZ = "America/Mexico_City";

// Así se ve la "dirección secreta en formato iCal" de Google Calendar (donde guarda sus eventos Notion Calendar).
const feed = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "X-WR-TIMEZONE:America/Mexico_City",
  // Cálculo: lunes y miércoles 7–9, desde el 1 de septiembre, con una clase cancelada y otra movida.
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Mexico_City:20260831T070000",
  "DTEND;TZID=America/Mexico_City:20260831T090000",
  "RRULE:FREQ=WEEKLY;WKST=SU;BYDAY=MO,WE;UNTIL=20261212T055959Z",
  "EXDATE;TZID=America/Mexico_City:20260930T070000",
  "UID:calculo@google.com",
  "SUMMARY:Cálculo diferencial",
  "LOCATION:Aula 12\\, Edificio B",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "TRIGGER:-PT10M",
  "SUMMARY:No debe leerse",
  "END:VALARM",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Mexico_City:20261005T100000",
  "DTEND;TZID=America/Mexico_City:20261005T120000",
  "RECURRENCE-ID;TZID=America/Mexico_City:20261005T070000",
  "UID:calculo@google.com",
  "SUMMARY:Cálculo (reposición)",
  "END:VEVENT",
  // Evento suelto en UTC (así exporta Google los eventos sin repetición): 15:00 UTC = 09:00 en CDMX.
  "BEGIN:VEVENT",
  "DTSTART:20261001T150000Z",
  "DTEND:20261001T163000Z",
  "UID:dentista@google.com",
  "SUMMARY:Dentista",
  "END:VEVENT",
  // Con DURATION en lugar de DTEND y una línea doblada.
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Mexico_City:20261002T180000",
  "DURATION:PT45M",
  "UID:ingles@google.com",
  "SUMMARY:Examen de ",
  " inglés",
  "END:VEVENT",
  // Todo el día, cancelado y fuera de la ventana: se ignoran.
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261001",
  "DTEND;VALUE=DATE:20261002",
  "UID:cumple@google.com",
  "SUMMARY:Cumpleaños",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261001T200000Z",
  "DTEND:20261001T210000Z",
  "STATUS:CANCELLED",
  "UID:cancelado@google.com",
  "SUMMARY:Cancelado",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261101T150000Z",
  "DTEND:20261101T160000Z",
  "UID:lejano@google.com",
  "SUMMARY:Muy lejos",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("parseIcsEvents: expande clases semanales con excepciones e instancias movidas", () => {
  const events = parseIcsEvents(feed, "2026-09-28", 14);
  const summary = events.map((event) => `${event.date} ${event.start}-${event.end} ${event.title}`);
  assert.deepEqual(summary, [
    "2026-09-28 07:00-09:00 Cálculo diferencial",
    // 30 de septiembre excluido por EXDATE.
    "2026-10-01 09:00-10:30 Dentista",
    "2026-10-02 18:00-18:45 Examen de inglés",
    "2026-10-05 10:00-12:00 Cálculo (reposición)",
    "2026-10-07 07:00-09:00 Cálculo diferencial",
  ]);
  assert.equal(events[0].location, "Aula 12, Edificio B");
  assert.equal(events[0].source, "calendar");
  assert.equal(events[0].category, "CLASE");
  assert.equal(events[2].category, "EXAMEN");
});

test("parseIcsEvents: respeta COUNT, INTERVAL y UNTIL", () => {
  const ics = (rule: string) => [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART;TZID=America/Mexico_City:20260928T160000",
    "DTEND;TZID=America/Mexico_City:20260928T170000",
    `RRULE:${rule}`,
    "UID:x",
    "SUMMARY:Gym",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  const dates = (rule: string) => parseIcsEvents(ics(rule), "2026-09-28", 14).map((event) => event.date);

  assert.deepEqual(dates("FREQ=DAILY;COUNT=3"), ["2026-09-28", "2026-09-29", "2026-09-30"]);
  assert.deepEqual(dates("FREQ=WEEKLY;INTERVAL=2"), ["2026-09-28"]);
  assert.deepEqual(dates("FREQ=DAILY;INTERVAL=5"), ["2026-09-28", "2026-10-03", "2026-10-08"]);
  assert.deepEqual(dates("FREQ=DAILY;UNTIL=20260929"), ["2026-09-28", "2026-09-29"]);
});

test("parseIcsEvents: convierte zonas horarias distintas a la del teléfono", () => {
  const ics = [
    "BEGIN:VEVENT",
    "DTSTART;TZID=America/New_York:20261001T100000",
    "DTEND;TZID=America/New_York:20261001T110000",
    "UID:ny",
    "SUMMARY:Llamada",
    "END:VEVENT",
  ].join("\n");
  // 10:00 en Nueva York (UTC-4 en octubre) = 08:00 en CDMX.
  assert.deepEqual(parseIcsEvents(ics, "2026-09-28").map((event) => `${event.start}-${event.end}`), ["08:00-09:00"]);
});

test("parseIcsEvents: tolera basura", () => {
  assert.deepEqual(parseIcsEvents("", "2026-09-28"), []);
  assert.deepEqual(parseIcsEvents("<html>no es un calendario</html>", "2026-09-28"), []);
  assert.deepEqual(parseIcsEvents("BEGIN:VEVENT\nDTSTART:roto\nEND:VEVENT", "2026-09-28"), []);
});

test("calendarDocId: estable y distinto por instancia", () => {
  assert.equal(calendarDocId("a@1"), calendarDocId("a@1"));
  assert.notEqual(calendarDocId("a@1"), calendarDocId("a@2"));
  assert.match(calendarDocId("a@1"), /^cal-[0-9a-f]{16}$/);
});

test("normalizeCalendarUrl: solo https de servicios de calendario conocidos", () => {
  assert.equal(
    normalizeCalendarUrl(" https://calendar.google.com/calendar/ical/yo%40gmail.com/private-abc/basic.ics "),
    "https://calendar.google.com/calendar/ical/yo%40gmail.com/private-abc/basic.ics",
  );
  assert.equal(normalizeCalendarUrl("webcal://p42-caldav.icloud.com/published/2/abc"), "https://p42-caldav.icloud.com/published/2/abc");
  assert.equal(normalizeCalendarUrl("http://calendar.google.com/x.ics"), null);
  assert.equal(normalizeCalendarUrl("https://evil.com/calendar.google.com.ics"), null);
  assert.equal(normalizeCalendarUrl("https://169.254.169.254/latest"), null);
  assert.equal(normalizeCalendarUrl("no es url"), null);
});
