/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, isValidTime, toDateKey } from "@/lib/dates";
import { currentStreak, levelFromXp, rankForLevel, weakestStat, weeklyCompletion } from "@/lib/leveling";
import { isValidUsername, loginIdentifierToEmail, normalizeUsername } from "@/lib/username";

const day = (offset: number) => toDateKey(addDays(new Date(), offset));
const progress = (offset: number, done: number, total: number) => ({
  dateKey: day(offset),
  completedMissionIds: Array.from({ length: done }, (_, i) => `m${i}`),
  rewards: {},
  totalMissions: total,
});

test("levelFromXp: cada nivel n cuesta n*100 EXP", () => {
  assert.deepEqual(levelFromXp(0), { level: 1, experience: 0, experienceGoal: 100 });
  assert.deepEqual(levelFromXp(99), { level: 1, experience: 99, experienceGoal: 100 });
  assert.deepEqual(levelFromXp(100), { level: 2, experience: 0, experienceGoal: 200 });
  assert.deepEqual(levelFromXp(300), { level: 3, experience: 0, experienceGoal: 300 });
  assert.equal(levelFromXp(-50).level, 1, "EXP negativa no rompe el cálculo");
});

test("rankForLevel: límites de rango", () => {
  assert.equal(rankForLevel(1).rank, "E");
  assert.equal(rankForLevel(4).rank, "E");
  assert.equal(rankForLevel(5).rank, "D");
  assert.equal(rankForLevel(10).rank, "C");
  assert.equal(rankForLevel(50).rank, "S");
  assert.equal(rankForLevel(999).rank, "S");
});

test("currentStreak: cuenta días perfectos consecutivos", () => {
  assert.equal(currentStreak([]), 0);
  assert.equal(currentStreak([progress(-1, 3, 3), progress(-2, 3, 3), progress(-4, 3, 3)]), 2, "se corta en el día que falta");
  assert.equal(currentStreak([progress(0, 3, 3), progress(-1, 3, 3)]), 2, "hoy cuenta si ya está completo");
  assert.equal(currentStreak([progress(0, 1, 3), progress(-1, 3, 3)]), 1, "hoy incompleto no rompe la racha de ayer");
  assert.equal(currentStreak([progress(-1, 2, 3)]), 0, "un día incompleto no cuenta");
  assert.equal(currentStreak([progress(-1, 0, 0)]), 0, "un día sin misiones no cuenta");
});

test("weeklyCompletion: últimos 7 días incluyendo hoy", () => {
  assert.equal(weeklyCompletion([], 0, 0), 0);
  assert.equal(weeklyCompletion([progress(-1, 2, 4)], 2, 4), 0.5);
  assert.equal(weeklyCompletion([progress(-10, 4, 4)], 1, 4), 0.25, "ignora días fuera de la semana");
  assert.equal(weeklyCompletion([progress(-1, 9, 4)], 0, 0), 1, "no pasa de 100% si hay ids de misiones borradas");
});

test("weakestStat", () => {
  assert.equal(weakestStat({ STR: 3, INT: 5, VIT: 1, AGI: 2, PER: 4 }), "VIT");
});

test("toDateKey usa la hora local, no UTC", () => {
  const lateNight = new Date(2026, 8, 27, 23, 30);
  assert.equal(toDateKey(lateNight), "2026-09-27");
});

test("isValidTime", () => {
  for (const ok of ["00:00", "07:30", "23:59"]) assert.ok(isValidTime(ok), ok);
  for (const bad of ["24:00", "7:30", "12:60", "ab:cd", ""]) assert.ok(!isValidTime(bad), bad);
});

test("nombre de usuario", () => {
  assert.equal(normalizeUsername("  JinWoo "), "jinwoo");
  assert.ok(isValidUsername("jin_woo.1"));
  for (const bad of ["ab", "con espacio", "ñandú", "a".repeat(21)]) assert.ok(!isValidUsername(bad), bad);
  assert.equal(loginIdentifierToEmail("JinWoo"), "jinwoo@jugadores.system-app.com");
  assert.equal(loginIdentifierToEmail("viejo@correo.com"), "viejo@correo.com", "cuentas antiguas con correo siguen funcionando");
});
