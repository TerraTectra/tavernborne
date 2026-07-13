import { activeLifeSceneOf } from './life-scenes';
import type { DialoguedDirective, DialogueTone } from './dialogue-performance';
import type { WorldState } from './model';
import { activeVisualSceneOf } from './visual-scenes';

export type ConversationContinuityId =
  | 'opening'
  | 'answer'
  | 'acknowledge'
  | 'build'
  | 'challenge'
  | 'repair'
  | 'conclude';

export interface ConversationContinuityMetadata {
  conversationContinuity: ConversationContinuityId;
  conversationThreadId?: string;
  conversationTurnIndex: number;
  conversationTopic: string;
  conversationCurrentLineId?: string;
  conversationAnchorLineId?: string;
  conversationAnchorSpeakerId?: string;
  conversationAnchorText?: string;
  conversationUsesPriorLine: boolean;
  conversationReason: string;
  conversationColor: string;
}

export type ContinuousDialogueDirective = DialoguedDirective & ConversationContinuityMetadata;

type ContinuityLine = {
  id: string;
  phase: string;
  speakerId: string;
  text: string;
  tone: DialogueTone;
};

type ContinuitySource = {
  sceneId: string;
  sceneType: string;
  topic: string;
  currentLineIndex: number;
  current?: ContinuityLine;
  previous?: ContinuityLine;
};

type ContinuityProfile = {
  color: string;
  reason: string;
};

const profiles: Record<ConversationContinuityId, ContinuityProfile> = {
  opening: { color: '#cbd5e1', reason: 'открывает тему без ссылки на предыдущую реплику' },
  answer: { color: '#fde68a', reason: 'отвечает на конкретный вопрос или требование' },
  acknowledge: { color: '#86efac', reason: 'сначала признаёт услышанный тезис собеседника' },
  build: { color: '#67e8f9', reason: 'последовательно развивает уже начатую мысль' },
  challenge: { color: '#f59e0b', reason: 'оспаривает конкретные слова предыдущего говорящего' },
  repair: { color: '#f9a8d4', reason: 'признаёт боль в предыдущей реплике и пытается восстановить контакт' },
  conclude: { color: '#c4b5fd', reason: 'подводит итог текущей теме разговора' },
};

const topicLabels: Record<string, string> = {
  meal: 'общая трапеза',
  conversation: 'личный разговор',
  help: 'совместная помощь',
  apology: 'примирение',
  conflict: 'причина конфликта',
  treatment: 'восстановление',
  debrief: 'итоги похода',
  expeditionCouncil: 'план похода',
};

const normalizeTone = (tone: string | undefined): DialogueTone => {
  if (tone === 'warm' || tone === 'calm' || tone === 'firm' || tone === 'hurt' || tone === 'angry' || tone === 'apologetic' || tone === 'doubtful' || tone === 'tense') return tone;
  return 'neutral';
};

const lowerFirst = (value: string): string => value
  ? `${value[0].toLocaleLowerCase('ru-RU')}${value.slice(1)}`
  : value;

const continuationCase = (value: string): string => {
  const addressed = value.match(/^([^,]{1,40},\s+)([А-ЯЁ])/u);
  if (!addressed) return lowerFirst(value);
  return `${addressed[1]}${addressed[2].toLocaleLowerCase('ru-RU')}${value.slice(addressed[0].length)}`;
};

const hesitantSentenceCase = (value: string): string => value.replace(
  /^Я…\s+([а-яё])/u,
  (_match, letter: string) => `Я… ${letter.toLocaleUpperCase('ru-RU')}`,
);

const compact = (value: string): string => value.replace(/\s+/gu, ' ').trim();

const quoteAnchor = (value: string): string => {
  const cleaned = compact(value)
    .replace(/^[«"“”]+|[»"“”]+$/gu, '')
    .replace(/\s*[.!?…]+$/u, '');
  const words = cleaned.split(' ').filter(Boolean);
  const shortened = words.length > 13 ? `${words.slice(0, 13).join(' ')}…` : cleaned;
  return shortened.length > 104 ? `${shortened.slice(0, 101).trimEnd()}…` : shortened;
};

const sourceForHero = (world: WorldState, heroId: string): ContinuitySource | undefined => {
  const life = activeLifeSceneOf(world);
  if (life?.participantIds.includes(heroId)) {
    const lines: ContinuityLine[] = life.dialogue.map((line) => ({
      id: line.id,
      phase: line.phase,
      speakerId: line.speakerId,
      text: line.text,
      tone: normalizeTone(line.tone),
    }));
    const index = Math.max(0, Math.min(life.currentLineIndex, lines.length - 1));
    return {
      sceneId: life.id,
      sceneType: life.type,
      topic: topicLabels[life.type] ?? life.title,
      currentLineIndex: index,
      current: lines[index],
      previous: index > 0 ? lines[index - 1] : undefined,
    };
  }

  const visual = activeVisualSceneOf(world);
  if (visual?.participantIds.includes(heroId)) {
    const lines: ContinuityLine[] = visual.dialogue.map((line) => ({
      id: line.id,
      phase: line.phase,
      speakerId: line.speakerId,
      text: line.text,
      tone: normalizeTone(line.tone),
    }));
    const index = Math.max(0, Math.min(visual.currentLineIndex, lines.length - 1));
    return {
      sceneId: visual.id,
      sceneType: visual.type,
      topic: topicLabels[visual.type] ?? visual.title,
      currentLineIndex: index,
      current: lines[index],
      previous: index > 0 ? lines[index - 1] : undefined,
    };
  }

  return undefined;
};

const continuityFor = (
  directive: DialoguedDirective,
  source: ContinuitySource,
): ConversationContinuityId => {
  const current = source.current;
  const previous = source.previous;
  if (!current || !previous) return 'opening';
  if (current.phase === 'resolution' || current.phase === 'departure' || current.phase === 'completed') return 'conclude';
  if (previous.speakerId === current.speakerId) return 'build';
  if (directive.dialoguePerformance === 'wounded' || current.tone === 'hurt' || previous.tone === 'hurt') return 'repair';
  if (directive.dialoguePerformance === 'defiant' || directive.dialoguePerformance === 'blunt' || current.tone === 'angry' || current.tone === 'tense') return 'challenge';
  if (previous.text.includes('?') || directive.dialoguePerformance === 'commanding' || directive.dialoguePerformance === 'formal') return 'answer';
  if (directive.dialoguePerformance === 'warm' || directive.dialoguePerformance === 'careful' || directive.dialoguePerformance === 'hesitant' || directive.dialoguePerformance === 'reflective') return 'acknowledge';
  return 'acknowledge';
};

const renderContinuousText = (
  text: string,
  continuity: ConversationContinuityId,
  anchor: string | undefined,
  topic: string,
): string => {
  const base = compact(text);
  if (continuity === 'opening') return base;
  if (continuity === 'build') return `Продолжу эту мысль: ${continuationCase(base)}`;
  if (continuity === 'conclude') return `Значит, по теме «${topic}» главное сказано. ${base}`;
  if (!anchor) return base;
  if (continuity === 'answer') return `На слова «${anchor}» отвечу прямо: ${continuationCase(base)}`;
  if (continuity === 'challenge') return `Не могу согласиться со словами «${anchor}». ${base}`;
  if (continuity === 'repair') return `Я понимаю, что за словами «${anchor}» стоит боль. ${hesitantSentenceCase(base)}`;
  return `Я услышал тебя: «${anchor}». ${base}`;
};

export const continueConversation = (
  world: WorldState,
  heroId: string,
  directive: DialoguedDirective | undefined,
): ContinuousDialogueDirective | undefined => {
  if (!directive) return undefined;
  const source = sourceForHero(world, heroId);
  const current = source?.current;
  const previous = source?.previous;
  const isCurrentSpeaker = Boolean(source && current?.speakerId === heroId && directive.dialogueIsSpeaker);
  const anchor = previous ? quoteAnchor(previous.text) : undefined;
  const continuity = source && isCurrentSpeaker ? continuityFor(directive, source) : 'opening';
  const profile = profiles[continuity];
  const usesPriorLine = Boolean(isCurrentSpeaker && previous && continuity !== 'opening');
  const bubble = isCurrentSpeaker && directive.bubble
    ? renderContinuousText(directive.bubble, continuity, usesPriorLine ? anchor : undefined, source?.topic ?? 'разговор')
    : directive.bubble;

  return {
    ...directive,
    bubble,
    dialogueWordCount: bubble ? bubble.trim().split(/\s+/u).filter(Boolean).length : 0,
    dialogueReason: continuity === 'opening' ? directive.dialogueReason : `${directive.dialogueReason}; ${profile.reason}`,
    dialogueColor: continuity === 'opening' ? directive.dialogueColor : profile.color,
    conversationContinuity: continuity,
    conversationThreadId: source?.sceneId,
    conversationTurnIndex: source?.currentLineIndex ?? 0,
    conversationTopic: source?.topic ?? 'разговор',
    conversationCurrentLineId: current?.id,
    conversationAnchorLineId: usesPriorLine ? previous?.id : undefined,
    conversationAnchorSpeakerId: usesPriorLine ? previous?.speakerId : undefined,
    conversationAnchorText: usesPriorLine ? anchor : undefined,
    conversationUsesPriorLine: usesPriorLine,
    conversationReason: profile.reason,
    conversationColor: profile.color,
  };
};
