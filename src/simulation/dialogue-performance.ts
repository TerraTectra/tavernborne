import { activeLifeSceneOf } from './life-scenes';
import type { Hero, Memory, WorldState } from './model';
import type { RelationallyPerformedDirective } from './relationship-performance';
import { activeVisualSceneOf } from './visual-scenes';

export type DialoguePerformanceId =
  | 'neutral'
  | 'warm'
  | 'blunt'
  | 'formal'
  | 'commanding'
  | 'defiant'
  | 'careful'
  | 'hesitant'
  | 'reflective'
  | 'wounded';

export type DialogueLength = 'terse' | 'standard' | 'expanded';
export type DialogueCadence = 'clipped' | 'steady' | 'measured' | 'halting' | 'flowing';
export type DialogueTone = 'neutral' | 'warm' | 'calm' | 'firm' | 'hurt' | 'angry' | 'apologetic' | 'doubtful' | 'tense';

export interface DialoguePerformanceMetadata {
  dialoguePerformance: DialoguePerformanceId;
  dialogueLength: DialogueLength;
  dialogueCadence: DialogueCadence;
  dialogueTone: DialogueTone;
  dialogueWordCount: number;
  dialogueIsSpeaker: boolean;
  dialogueOriginalText?: string;
  dialogueMemoryId?: string;
  dialogueMemoryReference?: string;
  dialoguePartnerId?: string;
  dialogueReason: string;
  dialogueColor: string;
}

export type DialoguedDirective = RelationallyPerformedDirective & DialoguePerformanceMetadata;

type DialogueSource = {
  text: string;
  tone: DialogueTone;
  speakerId: string;
  sceneType: string;
  role?: string;
};

type Profile = {
  cadence: DialogueCadence;
  tone?: DialogueTone;
  color: string;
  reason: string;
};

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
const wordCount = (value: string): number => value.trim().split(/\s+/u).filter(Boolean).length;
const lowerFirst = (value: string): string => value ? `${value[0].toLocaleLowerCase('ru-RU')}${value.slice(1)}` : value;
const stripTerminal = (value: string): string => value.trim().replace(/[.!?…]+$/u, '');
const compactWhitespace = (value: string): string => value.replace(/\s+/gu, ' ').trim();

const profiles: Record<DialoguePerformanceId, Profile> = {
  neutral: { cadence: 'steady', color: '#cbd5e1', reason: 'говорит без выраженного речевого уклона' },
  warm: { cadence: 'flowing', tone: 'warm', color: '#f9a8d4', reason: 'старается сохранить близость и взаимопонимание' },
  blunt: { cadence: 'clipped', tone: 'firm', color: '#fb923c', reason: 'предпочитает прямоту и короткие формулировки' },
  formal: { cadence: 'measured', tone: 'calm', color: '#fde68a', reason: 'держит речь собранной и уважительной' },
  commanding: { cadence: 'clipped', tone: 'firm', color: '#facc15', reason: 'говорит с позиции ответственности и власти' },
  defiant: { cadence: 'clipped', tone: 'tense', color: '#f59e0b', reason: 'подчёркивает независимость и несогласие' },
  careful: { cadence: 'measured', tone: 'doubtful', color: '#93c5fd', reason: 'подбирает слова, чтобы не усилить напряжение' },
  hesitant: { cadence: 'halting', tone: 'apologetic', color: '#c4b5fd', reason: 'говорит с заметной неуверенностью' },
  reflective: { cadence: 'measured', tone: 'calm', color: '#67e8f9', reason: 'связывает разговор с опытом и памятью' },
  wounded: { cadence: 'halting', tone: 'hurt', color: '#fb7185', reason: 'говорит через сохраняющуюся обиду или боль' },
};

const normalizedTone = (tone: string | undefined): DialogueTone => {
  if (tone === 'warm' || tone === 'calm' || tone === 'firm' || tone === 'hurt' || tone === 'angry' || tone === 'apologetic' || tone === 'doubtful' || tone === 'tense') return tone;
  return 'neutral';
};

const sourceForHero = (world: WorldState, heroId: string): DialogueSource | undefined => {
  const life = activeLifeSceneOf(world);
  if (life?.participantIds.includes(heroId)) {
    const current = life.dialogue[life.currentLineIndex];
    if (current) return { text: current.text, tone: normalizedTone(current.tone), speakerId: current.speakerId, sceneType: life.type, role: life.roles[heroId] };
  }
  const visual = activeVisualSceneOf(world);
  if (visual?.participantIds.includes(heroId)) {
    const current = visual.dialogue[visual.currentLineIndex];
    if (current) return { text: current.text, tone: normalizedTone(current.tone), speakerId: current.speakerId, sceneType: visual.type, role: visual.roles[heroId] };
  }
  return undefined;
};

const memoryScore = (world: WorldState, memory: Memory): number => {
  const age = Math.max(0, world.tick - memory.createdAt);
  return memory.importance * 1.25 + Math.abs(memory.valence) * 0.35 + Math.max(0, 30 - age * 0.2);
};

const relevantMemory = (world: WorldState, hero: Hero, partnerId?: string): Memory | undefined => {
  const candidates = hero.memories
    .filter((memory) => memory.importance >= 30 && (!partnerId || memory.participants.includes(partnerId)))
    .sort((left, right) => memoryScore(world, right) - memoryScore(world, left));
  return candidates[0];
};

const memoryReference = (memory: Memory | undefined): string | undefined => {
  if (!memory) return undefined;
  const withoutPrefix = memory.summary.replace(/^[^:]{2,48}:\s*/u, '');
  const compact = stripTerminal(compactWhitespace(withoutPrefix));
  return compact.length > 112 ? `${compact.slice(0, 109).trimEnd()}…` : compact;
};

const chooseLength = (hero: Hero, id: DialoguePerformanceId, memory?: Memory): DialogueLength => {
  if (id === 'blunt' || id === 'commanding' || id === 'defiant' || hero.needs.fatigue >= 75 || hero.emotions.anger >= 82) return 'terse';
  if (id === 'reflective' || id === 'warm' || (id === 'formal' && hero.traits.patience >= 62) || (memory && hero.traits.curiosity >= 58)) return 'expanded';
  return 'standard';
};

const profileFor = (
  hero: Hero,
  directive: RelationallyPerformedDirective,
  source: DialogueSource | undefined,
  memory?: Memory,
): DialoguePerformanceId => {
  const relationship = directive.relationshipPerformance;
  const stance = directive.leadershipStance;
  const scores: Record<Exclude<DialoguePerformanceId, 'neutral'>, number> = {
    warm: hero.traits.kindness * 0.28 + hero.traits.friendliness * 0.24 + hero.traits.empathy * 0.28 + hero.emotions.affection * 0.25,
    blunt: hero.traits.honesty * 0.34 + hero.traits.independence * 0.24 + hero.traits.impulsiveness * 0.24 + hero.traits.pride * 0.12,
    formal: hero.traits.discipline * 0.34 + hero.traits.patience * 0.25 + hero.traits.honesty * 0.16 + hero.psyche.confidence * 0.12,
    commanding: hero.traits.discipline * 0.3 + hero.traits.ambition * 0.24 + hero.psyche.confidence * 0.24 + (stance === 'leader' || source?.role === 'leader' ? 38 : 0),
    defiant: hero.traits.independence * 0.3 + hero.traits.pride * 0.22 + hero.traits.ambition * 0.2 + hero.emotions.anger * 0.2 + (stance === 'challenger' ? 42 : 0),
    careful: hero.traits.caution * 0.36 + hero.traits.patience * 0.2 + hero.emotions.anxiety * 0.26 + hero.psyche.stress * 0.12,
    hesitant: hero.emotions.fear * 0.34 + hero.emotions.guilt * 0.28 + hero.emotions.shame * 0.24 + hero.traits.approvalSeeking * 0.2,
    reflective: hero.traits.curiosity * 0.3 + hero.traits.patience * 0.24 + hero.traits.honesty * 0.14 + (memory ? 30 : 0),
    wounded: hero.emotions.sadness * 0.26 + hero.emotions.anger * 0.18 + (relationship === 'resentful' ? 44 : 0),
  };

  if (relationship === 'bonded' || relationship === 'trusting' || relationship === 'protective') scores.warm += 34;
  if (relationship === 'respectful' || relationship === 'deferential') scores.formal += 30;
  if (relationship === 'guarded') scores.careful += 34;
  if (relationship === 'intimidated') scores.hesitant += 42;
  if (relationship === 'rivalrous') scores.defiant += 38;
  if (source?.tone === 'angry' || source?.tone === 'tense') { scores.blunt += 20; scores.defiant += 14; }
  if (source?.tone === 'hurt') scores.wounded += 35;
  if (source?.tone === 'apologetic') scores.hesitant += 30;
  if (source?.tone === 'warm') scores.warm += 24;
  if (source?.tone === 'firm') scores.formal += 12;

  const [winner, raw] = (Object.entries(scores) as [Exclude<DialoguePerformanceId, 'neutral'>, number][])
    .sort((left, right) => right[1] - left[1])[0];
  return raw >= 40 ? winner : 'neutral';
};

const firstSentence = (text: string): string => text.match(/^.*?[.!?…](?:\s|$)/u)?.[0]?.trim() ?? text.trim();
const limitWords = (text: string, limit: number): string => {
  const words = compactWhitespace(text).split(' ');
  if (words.length <= limit) return compactWhitespace(text);
  return `${words.slice(0, limit).join(' ').replace(/[,;:]$/u, '')}…`;
};

const renderText = (
  baseText: string,
  id: DialoguePerformanceId,
  length: DialogueLength,
  partnerName?: string,
  memory?: string,
): string => {
  const base = compactWhitespace(baseText);
  const addressed = partnerName ? `${partnerName}, ` : '';
  let rendered = base;

  if (id === 'warm') rendered = `${addressed}${lowerFirst(base)} Мне важно, чтобы мы услышали друг друга.`;
  else if (id === 'blunt') rendered = `Скажу прямо: ${lowerFirst(firstSentence(base))}`;
  else if (id === 'formal') rendered = `${addressed}${base} Давайте опираться на факты и договорённости.`;
  else if (id === 'commanding') rendered = `Решение такое: ${lowerFirst(firstSentence(base))} Действуем без суеты.`;
  else if (id === 'defiant') rendered = `Нет. ${base} Я не уступлю только потому, что от меня этого ждут.`;
  else if (id === 'careful') rendered = `Скажу осторожно: ${lowerFirst(base)} Не хочу сделать хуже.`;
  else if (id === 'hesitant') rendered = `Я… ${lowerFirst(base)} Мне непросто это говорить.`;
  else if (id === 'reflective') rendered = memory
    ? `Я помню: ${memory}. Поэтому ${lowerFirst(base)}`
    : `Я обдумал это. ${base}`;
  else if (id === 'wounded') rendered = memory
    ? `После того, как ${lowerFirst(memory)}, я не могу говорить как раньше. ${base}`
    : `Мне до сих пор больно. ${base}`;

  if (length === 'terse') return limitWords(firstSentence(rendered), 18);
  if (length === 'expanded' && wordCount(rendered) < 18 && id === 'neutral') return `${rendered} Я хочу объяснить это до конца, без недомолвок.`;
  return rendered;
};

export const performDialogue = (
  world: WorldState,
  heroId: string,
  directive: RelationallyPerformedDirective | undefined,
): DialoguedDirective | undefined => {
  if (!directive) return undefined;
  const hero = world.heroes[heroId];
  const source = sourceForHero(world, heroId);
  const isSpeaker = Boolean(source && source.speakerId === heroId && directive.bubble);
  const originalText = directive.bubble;
  const partnerId = directive.relationshipPartnerId ?? directive.partnerId ?? directive.targetId;
  const partner = partnerId ? world.heroes[partnerId] : undefined;

  if (!hero || !originalText || !isSpeaker) {
    return {
      ...directive,
      dialoguePerformance: 'neutral',
      dialogueLength: 'standard',
      dialogueCadence: 'steady',
      dialogueTone: source?.tone ?? 'neutral',
      dialogueWordCount: originalText ? wordCount(originalText) : 0,
      dialogueIsSpeaker: false,
      dialogueOriginalText: originalText,
      dialoguePartnerId: partnerId,
      dialogueReason: profiles.neutral.reason,
      dialogueColor: profiles.neutral.color,
    };
  }

  const memory = relevantMemory(world, hero, partnerId);
  const memoryText = memoryReference(memory);
  const performance = profileFor(hero, directive, source, memory);
  const profile = profiles[performance];
  const length = chooseLength(hero, performance, memory);
  const text = renderText(originalText, performance, length, partner?.name, memoryText);
  const tone = profile.tone ?? source?.tone ?? 'neutral';

  return {
    ...directive,
    bubble: text,
    dialoguePerformance: performance,
    dialogueLength: length,
    dialogueCadence: profile.cadence,
    dialogueTone: tone,
    dialogueWordCount: wordCount(text),
    dialogueIsSpeaker: true,
    dialogueOriginalText: originalText,
    dialogueMemoryId: memoryText && (performance === 'reflective' || performance === 'wounded') ? memory?.id : undefined,
    dialogueMemoryReference: memoryText && (performance === 'reflective' || performance === 'wounded') ? memoryText : undefined,
    dialoguePartnerId: partnerId,
    dialogueReason: profile.reason,
    dialogueColor: profile.color,
    reaction: directive.reaction ?? (performance === 'neutral' ? undefined : profile.reason),
  };
};
