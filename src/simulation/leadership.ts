import type { Hero, WorldState } from './model';

export type LeadershipRole = 'leader' | 'deputy' | 'follower' | 'challenger' | 'independent';

export interface LeadershipFeelings {
  responsibility: number;
  pressure: number;
  pride: number;
  fearOfFailure: number;
  ambition: number;
  burden: number;
}

export interface LeadershipBond {
  targetId: string;
  authority: number;
  obedience: number;
  politicalLoyalty: number;
  confidence: number;
  grievance: number;
  groupBond: number;
}

export interface LeadershipPersonState {
  heroId: string;
  role: LeadershipRole;
  groupId?: string;
  feelings: LeadershipFeelings;
  bonds: Record<string, LeadershipBond>;
}

export interface LeadershipGroup {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  legitimacy: number;
  cohesion: number;
  createdAt: number;
  formedBy: 'founding' | 'split';
}

export interface LeadershipHistoryEntry {
  id: string;
  tick: number;
  type: 'appointed' | 'confirmed' | 'challenged' | 'replaced' | 'split' | 'reconciled';
  text: string;
  heroIds: string[];
}

export interface LeadershipState {
  familyLeaderId?: string;
  groups: LeadershipGroup[];
  people: Record<string, LeadershipPersonState>;
  lastEvaluationDay: number;
  nextGroupId: number;
  history: LeadershipHistoryEntry[];
}

type LeadershipWorld = WorldState & { leadership?: LeadershipState };

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, value));

const signedClamp = (value: number): number => clamp(value, -100, 100);

const roll = (world: WorldState, key: string): number => {
  const input = `${world.seed}:${key}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const emptyFeelings = (hero: Hero): LeadershipFeelings => ({
  responsibility: 10,
  pressure: 5,
  pride: 10,
  fearOfFailure: 5,
  ambition: clamp(hero.traits.ambition * 0.8 + hero.traits.pride * 0.2),
  burden: 5,
});

const emptyBond = (targetId: string): LeadershipBond => ({
  targetId,
  authority: 0,
  obedience: 0,
  politicalLoyalty: 0,
  confidence: 0,
  grievance: 0,
  groupBond: 0,
});

const ensurePerson = (state: LeadershipState, hero: Hero): LeadershipPersonState => {
  const current = state.people[hero.id];
  if (current) return current;
  const person: LeadershipPersonState = {
    heroId: hero.id,
    role: 'independent',
    feelings: emptyFeelings(hero),
    bonds: {},
  };
  state.people[hero.id] = person;
  return person;
};

const ensureBond = (person: LeadershipPersonState, targetId: string): LeadershipBond => {
  const current = person.bonds[targetId];
  if (current) return current;
  const bond = emptyBond(targetId);
  person.bonds[targetId] = bond;
  return bond;
};

const average = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const candidateScore = (hero: Hero, world: WorldState): number => {
  const others = Object.values(world.heroes).filter((candidate) => candidate.id !== hero.id);
  const recognition = average(others.map((other) => {
    const relation = other.relationships[hero.id]?.values;
    return (relation?.respect ?? 0) * 0.65 + (relation?.trust ?? 0) * 0.35;
  }));
  return hero.traits.ambition * 0.24
    + hero.traits.discipline * 0.2
    + hero.traits.courage * 0.14
    + hero.traits.loyalty * 0.1
    + hero.psyche.confidence * 0.16
    + recognition * 0.16;
};

const addHistory = (
  world: WorldState,
  state: LeadershipState,
  type: LeadershipHistoryEntry['type'],
  text: string,
  heroIds: string[],
): void => {
  const entry: LeadershipHistoryEntry = {
    id: `leadership-${world.tick}-${state.history.length}-${type}`,
    tick: world.tick,
    type,
    text,
    heroIds,
  };
  state.history.unshift(entry);
  state.history = state.history.slice(0, 80);
  world.journal.unshift({
    id: `${world.tick}-${world.journal.length}-leadership`,
    tick: world.tick,
    text,
    heroIds,
    kind: 'system',
  });
  world.journal = world.journal.slice(0, 240);
};

const appointInitialLeader = (world: WorldState, state: LeadershipState): void => {
  const heroes = Object.values(world.heroes);
  if (!heroes.length) return;
  const leader = [...heroes].sort((left, right) => candidateScore(right, world) - candidateScore(left, world))[0];
  const group: LeadershipGroup = {
    id: 'family-core',
    name: 'Основная группа семьи',
    leaderId: leader.id,
    memberIds: heroes.map((hero) => hero.id),
    legitimacy: 55,
    cohesion: 58,
    createdAt: world.tick,
    formedBy: 'founding',
  };
  state.groups = [group];
  state.familyLeaderId = leader.id;
  heroes.forEach((hero) => {
    const person = ensurePerson(state, hero);
    person.groupId = group.id;
    person.role = hero.id === leader.id ? 'leader' : 'follower';
    const bond = ensureBond(person, leader.id);
    const relation = hero.relationships[leader.id]?.values;
    bond.authority = hero.id === leader.id ? 100 : clamp(35 + (relation?.respect ?? 0) * 0.4);
    bond.obedience = hero.id === leader.id ? 100 : clamp(30 + hero.traits.loyalty * 0.35 - hero.traits.independence * 0.18);
    bond.politicalLoyalty = hero.id === leader.id ? 100 : clamp(28 + (relation?.trust ?? 0) * 0.45 + hero.traits.loyalty * 0.28);
    bond.confidence = hero.id === leader.id ? 100 : clamp(35 + (relation?.respect ?? 0) * 0.45);
    bond.groupBond = 45;
  });
  const leaderState = ensurePerson(state, leader);
  leaderState.feelings.responsibility = 48;
  leaderState.feelings.pressure = 28;
  leaderState.feelings.pride = 42;
  leaderState.feelings.fearOfFailure = 24;
  leaderState.feelings.burden = 20;
  addHistory(
    world,
    state,
    'appointed',
    `${leader.name} признан первым лидером семьи. Теперь на нём лежат координация, безопасность и ответственность за решения группы.`,
    heroes.map((hero) => hero.id),
  );
};

export const ensureLeadership = (world: WorldState): LeadershipState => {
  const extended = world as LeadershipWorld;
  if (!extended.leadership) {
    extended.leadership = {
      groups: [],
      people: {},
      lastEvaluationDay: -1,
      nextGroupId: 1,
      history: [],
    };
  }
  const state = extended.leadership;
  Object.values(world.heroes).forEach((hero) => ensurePerson(state, hero));
  if (!state.groups.length || !state.familyLeaderId) appointInitialLeader(world, state);
  return state;
};

const recentExpeditionEffect = (world: WorldState, leaderId: string): number => {
  const recent = world.expeditions.find((expedition) =>
    expedition.partyIds.includes(leaderId)
    && (expedition.status === 'completed' || expedition.status === 'retreated')
    && world.tick - expedition.plannedReturnTick <= 30);
  if (!recent) return 0;
  return recent.status === 'completed' ? 8 : -14;
};

const updateGroupMetrics = (world: WorldState, state: LeadershipState, group: LeadershipGroup): void => {
  const leader = world.heroes[group.leaderId];
  if (!leader) return;
  const followers = group.memberIds.filter((id) => id !== leader.id).map((id) => world.heroes[id]).filter(Boolean);
  const expeditionEffect = recentExpeditionEffect(world, leader.id);

  followers.forEach((follower) => {
    const person = ensurePerson(state, follower);
    const bond = ensureBond(person, leader.id);
    const relation = follower.relationships[leader.id]?.values;
    const competence = candidateScore(leader, world) * 0.35 + expeditionEffect;
    const fairness = leader.traits.kindness * 0.18 + leader.traits.honesty * 0.16 - leader.traits.cruelty * 0.15;
    const resentment = Math.max(0, relation?.resentment ?? 0);
    const rivalry = Math.max(0, relation?.rivalry ?? 0);
    bond.authority = clamp(bond.authority * 0.75 + competence * 0.25 - resentment * 0.12);
    bond.confidence = clamp(bond.confidence * 0.72 + (competence + (relation?.respect ?? 0) * 0.35) * 0.28);
    bond.politicalLoyalty = clamp(
      bond.politicalLoyalty * 0.78
      + (follower.traits.loyalty * 0.25 + (relation?.trust ?? 0) * 0.3 + fairness * 0.2) * 0.22
      - resentment * 0.12
      - rivalry * 0.08,
    );
    bond.obedience = clamp(
      bond.obedience * 0.8
      + (bond.authority * 0.35 + follower.traits.loyalty * 0.2 - follower.traits.independence * 0.15) * 0.2,
    );
    bond.grievance = clamp(
      bond.grievance * 0.82
      + (resentment * 0.45 + rivalry * 0.22 + Math.max(0, 45 - bond.confidence) * 0.25) * 0.18,
    );
    bond.groupBond = clamp(
      bond.groupBond * 0.8
      + (follower.needs.belonging * 0.2 + follower.traits.loyalty * 0.25 + (relation?.closeness ?? 0) * 0.25) * 0.2,
    );
    const challengerPressure = follower.traits.ambition * 0.45
      + follower.traits.pride * 0.2
      + rivalry * 0.3
      + bond.grievance * 0.25
      - bond.politicalLoyalty * 0.35;
    person.role = challengerPressure > 45 ? 'challenger' : 'follower';
    person.groupId = group.id;
    person.feelings.ambition = clamp(person.feelings.ambition * 0.8 + challengerPressure * 0.2);
  });

  const loyaltyValues = followers.map((hero) => ensureBond(ensurePerson(state, hero), leader.id).politicalLoyalty);
  const confidenceValues = followers.map((hero) => ensureBond(ensurePerson(state, hero), leader.id).confidence);
  const grievanceValues = followers.map((hero) => ensureBond(ensurePerson(state, hero), leader.id).grievance);
  group.legitimacy = clamp(average(loyaltyValues) * 0.45 + average(confidenceValues) * 0.45 - average(grievanceValues) * 0.25 + 20);
  group.cohesion = clamp(average(followers.map((hero) => ensureBond(ensurePerson(state, hero), leader.id).groupBond)) * 0.6 + group.legitimacy * 0.4);

  const leaderState = ensurePerson(state, leader);
  leaderState.role = 'leader';
  leaderState.groupId = group.id;
  const wounded = group.memberIds.map((id) => world.heroes[id]).filter(Boolean).filter((hero) => hero.condition.injury > 15).length;
  leaderState.feelings.responsibility = clamp(38 + group.memberIds.length * 8 + wounded * 7);
  leaderState.feelings.pressure = clamp(
    leaderState.feelings.pressure * 0.7
    + (100 - group.legitimacy) * 0.18
    + wounded * 6
    + leader.psyche.stress * 0.12,
  );
  leaderState.feelings.pride = clamp(leaderState.feelings.pride * 0.75 + group.legitimacy * 0.25 + Math.max(0, expeditionEffect));
  leaderState.feelings.fearOfFailure = clamp(
    leaderState.feelings.fearOfFailure * 0.72
    + Math.max(0, 58 - group.legitimacy) * 0.3
    + wounded * 5,
  );
  leaderState.feelings.burden = clamp(leaderState.feelings.pressure * 0.55 + leaderState.feelings.responsibility * 0.35);
  leaderState.feelings.ambition = clamp(leader.traits.ambition * 0.65 + leaderState.feelings.pride * 0.2);
  leader.psyche.stress = clamp(leader.psyche.stress + leaderState.feelings.burden * 0.025);
  leader.emotions.anxiety = clamp(leader.emotions.anxiety + leaderState.feelings.fearOfFailure * 0.018);
  leader.emotions.inspiration = clamp(leader.emotions.inspiration + group.legitimacy * 0.012);
}

const strongestChallenger = (world: WorldState, state: LeadershipState, group: LeadershipGroup): Hero | undefined =>
  group.memberIds
    .filter((id) => id !== group.leaderId)
    .map((id) => world.heroes[id])
    .filter(Boolean)
    .sort((left, right) => {
      const leftState = ensurePerson(state, left);
      const rightState = ensurePerson(state, right);
      const leftBond = ensureBond(leftState, group.leaderId);
      const rightBond = ensureBond(rightState, group.leaderId);
      const leftScore = candidateScore(left, world) + leftState.feelings.ambition * 0.25 + leftBond.grievance * 0.35;
      const rightScore = candidateScore(right, world) + rightState.feelings.ambition * 0.25 + rightBond.grievance * 0.35;
      return rightScore - leftScore;
    })[0];

const replaceLeader = (world: WorldState, state: LeadershipState, group: LeadershipGroup, challenger: Hero): void => {
  const oldLeader = world.heroes[group.leaderId];
  if (!oldLeader) return;
  group.leaderId = challenger.id;
  if (state.familyLeaderId === oldLeader.id) state.familyLeaderId = challenger.id;
  ensurePerson(state, oldLeader).role = 'follower';
  ensurePerson(state, challenger).role = 'leader';
  group.memberIds.forEach((id) => {
    const member = world.heroes[id];
    if (!member) return;
    const bond = ensureBond(ensurePerson(state, member), challenger.id);
    bond.authority = clamp(35 + (member.relationships[challenger.id]?.values.respect ?? 0) * 0.45);
    bond.politicalLoyalty = clamp(30 + (member.relationships[challenger.id]?.values.trust ?? 0) * 0.4);
    bond.confidence = clamp(35 + candidateScore(challenger, world) * 0.3);
  });
  addHistory(
    world,
    state,
    'replaced',
    `${challenger.name} добился смещения ${oldLeader.name} и возглавил ${group.name.toLowerCase()}. Часть семьи испытывает надежду, часть — тревогу и обиду.`,
    group.memberIds,
  );
};

const splitGroup = (world: WorldState, state: LeadershipState, group: LeadershipGroup, challenger: Hero): void => {
  if (group.memberIds.length < 3) return;
  const supporters = group.memberIds
    .filter((id) => id !== challenger.id && id !== group.leaderId)
    .map((id) => world.heroes[id])
    .filter(Boolean)
    .sort((left, right) => {
      const leftRelation = left.relationships[challenger.id]?.values;
      const rightRelation = right.relationships[challenger.id]?.values;
      const leftSupport = (leftRelation?.trust ?? 0) + (leftRelation?.closeness ?? 0) + (leftRelation?.respect ?? 0);
      const rightSupport = (rightRelation?.trust ?? 0) + (rightRelation?.closeness ?? 0) + (rightRelation?.respect ?? 0);
      return rightSupport - leftSupport;
    });
  const supporter = supporters[0];
  const newMembers = supporter ? [challenger.id, supporter.id] : [challenger.id];
  group.memberIds = group.memberIds.filter((id) => !newMembers.includes(id));
  const newGroup: LeadershipGroup = {
    id: `group-${state.nextGroupId}`,
    name: `Группа ${challenger.name}`,
    leaderId: challenger.id,
    memberIds: newMembers,
    legitimacy: 48,
    cohesion: 52,
    createdAt: world.tick,
    formedBy: 'split',
  };
  state.nextGroupId += 1;
  state.groups.push(newGroup);
  newMembers.forEach((id) => {
    const hero = world.heroes[id];
    if (!hero) return;
    const person = ensurePerson(state, hero);
    person.groupId = newGroup.id;
    person.role = id === challenger.id ? 'leader' : 'follower';
  });
  addHistory(
    world,
    state,
    'split',
    `${challenger.name} отказался подчиняться прежнему лидеру и увёл за собой ${newMembers.length - 1} сторонника. Семья раскололась на две группы.`,
    [...group.memberIds, ...newMembers],
  );
};

const evaluatePowerStruggle = (world: WorldState, state: LeadershipState, group: LeadershipGroup): void => {
  const challenger = strongestChallenger(world, state, group);
  if (!challenger) return;
  const leader = world.heroes[group.leaderId];
  if (!leader) return;
  const challengerState = ensurePerson(state, challenger);
  const challengerBond = ensureBond(challengerState, leader.id);
  const advantage = candidateScore(challenger, world) - candidateScore(leader, world)
    + challengerState.feelings.ambition * 0.22
    + challengerBond.grievance * 0.32
    - challengerBond.politicalLoyalty * 0.2;

  if (advantage > 18 && group.legitimacy < 48) {
    challengerState.role = 'challenger';
    addHistory(
      world,
      state,
      'challenged',
      `${challenger.name} всё открытее ставит под сомнение решения ${leader.name}. В группе растёт борьба за влияние.`,
      [challenger.id, leader.id],
    );
  }

  const eventRoll = roll(world, `leadership:${Math.floor(world.tick / 24)}:${group.id}:${challenger.id}`);
  if (advantage > 30 && group.legitimacy < 32 && eventRoll > 0.38) {
    replaceLeader(world, state, group, challenger);
    return;
  }
  if (advantage > 22 && group.legitimacy < 42 && group.cohesion < 45 && eventRoll > 0.68) {
    splitGroup(world, state, group, challenger);
  }
};

export const advanceLeadership = (world: WorldState): LeadershipState => {
  const previous = ensureLeadership(world);
  const day = Math.floor(world.tick / 24);
  if (previous.lastEvaluationDay === day) return previous;

  const state: LeadershipState = {
    ...previous,
    groups: previous.groups.map((group) => ({ ...group, memberIds: [...group.memberIds] })),
    people: Object.fromEntries(Object.entries(previous.people).map(([id, person]) => [
      id,
      {
        ...person,
        feelings: { ...person.feelings },
        bonds: Object.fromEntries(Object.entries(person.bonds).map(([targetId, bond]) => [targetId, { ...bond }])),
      },
    ])),
    history: previous.history.map((entry) => ({ ...entry, heroIds: [...entry.heroIds] })),
    lastEvaluationDay: day,
  };
  (world as LeadershipWorld).leadership = state;
  state.groups.forEach((group) => updateGroupMetrics(world, state, group));
  [...state.groups].forEach((group) => evaluatePowerStruggle(world, state, group));
  return state;
};

export const leadershipStateOf = (world: WorldState): LeadershipState => ensureLeadership(world);
