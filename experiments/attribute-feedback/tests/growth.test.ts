import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameState } from '../src/core/GameState';
import { growthBenefits } from '../src/systems/GrowthSystem';
import { DebateSystem } from '../src/systems/DebateSystem';
import { WritingSystem } from '../src/systems/WritingSystem';
import { YorktownSystem } from '../src/systems/YorktownSystem';
import { squads } from '../src/data/yorktown';
import { chapters } from '../src/data/chapters';
import type { GameState, StateEffect } from '../src/core/GameState';

function tick(system: { tick(delta: number): void }, ms: number) {
  while (ms > 0) { const dt = Math.min(ms, 100); system.tick(dt); ms -= dt; }
}

test('growth benefits use exact attribute thresholds without changing the source state', () => {
  const state = initialGameState(); const before = structuredClone(state);
  assert.deepEqual(growthBenefits(state), { debate: { crowdBonus: 0, attackRecovery: 0 }, writing: { referenceUses: 0 }, yorktown: { deploymentChecks: 0 } });
  assert.deepEqual(state, before);
  for (const [influence, crowdBonus] of [[24, 0], [25, 5], [29, 5], [30, 10]]) assert.equal(growthBenefits({ ...state, influence }).debate.crowdBonus, crowdBonus);
  for (const [momentum, attackRecovery] of [[54, 0], [55, 1]]) assert.equal(growthBenefits({ ...state, momentum }).debate.attackRecovery, attackRecovery);
  for (const [washingtonTrust, referenceUses, deploymentChecks] of [[7, 0, 0], [8, 1, 0], [17, 1, 0], [18, 1, 1]]) {
    const benefits = growthBenefits({ ...state, washingtonTrust });
    assert.equal(benefits.writing.referenceUses, referenceUses); assert.equal(benefits.yorktown.deploymentChecks, deploymentChecks);
  }
});

test('activity defaults preserve unassisted play and snapshotted benefits cannot be replenished', () => {
  assert.equal(new DebateSystem().crowd, 25); assert.equal(new DebateSystem().attackRecoveriesRemaining, 0);
  assert.equal(new WritingSystem().referencesRemaining, 0); assert.equal(new YorktownSystem().deploymentChecksRemaining, 0);
  for (const crowdBonus of [0, 5, 10]) assert.equal(new DebateSystem({ crowdBonus, attackRecovery: 0 }).crowd, 25 + crowdBonus);
  const snapshot = { crowdBonus: 5, attackRecovery: 1 }; const g = new DebateSystem(snapshot);
  snapshot.attackRecovery = 100; snapshot.crowdBonus = 100;
  assert.equal(g.crowd, 30); assert.equal(g.attackRecoveriesRemaining, 1);
});

test('momentum cancels one attack backlash while the true miss and broken flow remain', () => {
  const g = new DebateSystem({ crowdBonus: 0, attackRecovery: 1 });
  g.ready(); g.select('FACT'); tick(g, 1200); g.hit(); g.next();
  const crowd = g.crowd, credibility = g.credibility;
  g.ready(); g.select('ATTACK'); g.hit();
  assert.equal(g.crowd, crowd); assert.equal(g.credibility, credibility);
  assert.equal(g.grade, 'MISS'); assert.equal(g.history[1].grade, 'MISS'); assert.equal(g.flow, 0);
  assert.equal(g.performance, 50); assert.equal(g.attackRecoveriesUsed, 1); assert.equal(g.attackRecoveryTriggered, true);
  g.next(); g.ready(); g.select('ATTACK'); tick(g, 1500);
  assert.equal(g.crowd, Math.max(0, crowd - 12)); assert.equal(g.credibility, Math.min(100, credibility + 8));
  assert.equal(g.attackRecoveriesUsed, 1); assert.equal(g.attackRecoveryTriggered, false);
});

test('response timeout keeps the attack recovery, but a selected attack beat timeout consumes it', () => {
  const g = new DebateSystem({ crowdBonus: 10, attackRecovery: 1 });
  g.ready(); tick(g, 2500); assert.equal(g.attackRecoveriesUsed, 0); assert.equal(g.crowd, 30);
  g.next(); g.ready(); g.select('ATTACK'); tick(g, 1500);
  assert.equal(g.attackRecoveriesUsed, 1); assert.equal(g.crowd, 30); assert.equal(g.credibility, 94);
});

test('maximum growth cannot win the debate without successful input', () => {
  for (const response of [null, 'ATTACK', 'CROWD', 'FACT', 'PRINCIPLE'] as const) {
    const g = new DebateSystem({ crowdBonus: 10, attackRecovery: 1 });
    for (let round = 0; round < 6; round++) { g.ready(); if (response) { g.select(response); g.hit(); } else tick(g, 2500); g.next(); }
    assert.equal(g.phase, 'result'); assert.equal(g.won, false); assert.equal(g.performance, 0);
  }
});

test('writing reference names one selected current fragment category without assigning or extending time', () => {
  const g = new WritingSystem({ referenceUses: 1 });
  assert.equal(g.reference('north-time'), null); assert.equal(g.referencesUsed, 0);
  g.begin(); tick(g, 500);
  assert.equal(g.reference(null), null); assert.equal(g.reference('foreign-fragment'), null); assert.equal(g.referencesUsed, 0);
  assert.equal(g.reference('north-time'), 'PRIORITY'); assert.equal(g.referencesUsed, 1); assert.equal(g.referencesRemaining, 0);
  assert.equal(g.remaining, 149500); assert.deepEqual(g.assignments, {}); assert.equal(g.performance, 0);
  assert.equal(g.reference('north-position'), null);
  g.assign('north-time', 'CONTEXT'); g.submit(); assert.equal(g.scores[0], 0);
  g.next(); assert.equal(g.reference('medical-time'), null); assert.equal(g.referencesUsed, 1);
});

test('deployment check names one squad order without giving an order or adding surprise', () => {
  const g = new YorktownSystem({ deploymentChecks: 1 });
  assert.equal(g.checkDeployment(0), null); assert.equal(g.deploymentChecksUsed, 0);
  g.phase = 'command';
  for (const i of [null, -1, 3, 0.5, NaN]) assert.equal(g.checkDeployment(i), null);
  assert.equal(g.deploymentChecksUsed, 0); g.order(0, 'HOLD');
  assert.equal(g.checkDeployment(0), 'ADVANCE'); assert.equal(g.deploymentChecksUsed, 1);
  assert.deepEqual(g.deployment, ['HOLD', null, null]); assert.equal(g.surprise, 100); assert.equal(g.tactics, 0);
  assert.equal(g.checkDeployment(1), null); assert.equal(g.checkDeployment(0), null);
  g.order(1, squads[1].best); g.order(2, squads[2].best); g.deploy(); assert.equal(g.tactics, 67);
});

function applyEffect(state: GameState, effect: StateEffect = {}): GameState {
  const next = { ...state, choices: { ...state.choices } };
  for (const [key, delta] of Object.entries(effect)) { const stat = key as keyof StateEffect; next[stat] = Math.max(0, Math.min(100, next[stat] + delta)); }
  return next;
}

function mainlineToDebate(includeTavernTimeout: boolean) {
  let states = [initialGameState()];
  for (const chapter of [chapters.Arrival, chapters.Tavern]) for (const interaction of chapter.interactions) {
    states = states.map(state => applyEffect(state, interaction.effect));
    if (interaction.choice) {
      const effects = interaction.choice.options.map(option => option.effect);
      if (includeTavernTimeout && chapter.id === 'Tavern') effects.push({});
      states = states.flatMap(state => effects.map(effect => applyEffect(state, effect)));
    }
  }
  return states;
}

test('mainline choices can earn each debate benefit; optional discoveries are not prerequisites', () => {
  const states = mainlineToDebate(false);
  assert.equal(states.length, 81);
  for (const [stat, min, max] of [['momentum', 32, 72], ['influence', 15, 30], ['burrRespect', 20, 32], ['burrRivalry', 10, 20]] as const) {
    assert.equal(Math.min(...states.map(state => state[stat])), min); assert.equal(Math.max(...states.map(state => state[stat])), max);
  }
  const benefits = states.map(growthBenefits);
  assert.ok(benefits.some(value => value.debate.attackRecovery === 1));
  assert.ok(benefits.some(value => value.debate.crowdBonus === 5));
  assert.ok(benefits.some(value => value.debate.crowdBonus === 10));
  assert.ok(benefits.some(value => value.debate.crowdBonus === 0 && value.debate.attackRecovery === 0));
  assert.equal(mainlineToDebate(true).length, 192);
  for (const state of mainlineToDebate(true)) {
    const game = new DebateSystem(growthBenefits(state).debate);
    for (let round = 0; round < 6; round++) { game.ready(); tick(game, 2500); game.next(); }
    assert.equal(game.phase, 'result'); assert.equal(game.won, false);
  }
});

test('trust assistance is reachable from mainline responsibility, grades, and the departure choice', () => {
  const responsibility = chapters.Washington.interactions.find(interaction => interaction.choice)!.choice!;
  const departure = chapters.Yorktown.interactions.find(interaction => interaction.choice)!.choice!;
  const admitted = responsibility.options.map(option => applyEffect(initialGameState(), option.effect));
  assert.ok(admitted.some(state => growthBenefits(state).writing.referenceUses === 0));
  assert.ok(admitted.some(state => growthBenefits(state).writing.referenceUses === 1));
  const game = new WritingSystem(); game.begin();
  for (let round = 0; round < 3; round++) { game.dispatch.fragments.forEach(fragment => game.assign(fragment.id, fragment.bin)); game.submit(); game.next(); }
  const departures = admitted.flatMap(state => departure.options.map(option => applyEffect(applyEffect(state, game.effects()), option.effect)));
  assert.ok(departures.some(state => growthBenefits(state).yorktown.deploymentChecks === 1));
  assert.ok(departures.some(state => growthBenefits(state).yorktown.deploymentChecks === 0));
});

test('activity caps keep malformed benefit values from creating unlimited help', () => {
  assert.equal(new DebateSystem({ crowdBonus: Infinity, attackRecovery: 100 }).crowd, 25);
  assert.equal(new DebateSystem({ crowdBonus: 100, attackRecovery: 100 }).attackRecoveriesGranted, 1);
  assert.equal(new WritingSystem({ referenceUses: 100 }).referencesGranted, 1);
  assert.equal(new YorktownSystem({ deploymentChecks: 100 }).deploymentChecksGranted, 1);
});
