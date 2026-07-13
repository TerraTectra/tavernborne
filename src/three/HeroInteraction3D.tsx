import { Html, Sparkles } from '@react-three/drei';
import type { ActionId, VisualGesture, VisualProp } from '../simulation';
import type { ActorPhase } from '../rts/realtime';

export type InteractionKind =
  | 'none'
  | 'meal'
  | 'sleep'
  | 'training'
  | 'reading'
  | 'conversation'
  | 'care'
  | 'solitude'
  | 'work'
  | 'dungeon'
  | 'recovery';

export type InteractionPosture = 'standing' | 'seated' | 'kneeling' | 'resting' | 'leaning' | 'ready';

export interface InteractionActor {
  phase: ActorPhase;
  actionId?: ActionId;
  gesture?: VisualGesture;
  sceneProp?: VisualProp;
}

const actionLabels: Record<InteractionKind, string> = {
  none: '',
  meal: 'трапеза',
  sleep: 'сон',
  training: 'тренировка',
  reading: 'чтение',
  conversation: 'разговор',
  care: 'помощь',
  solitude: 'уединение',
  work: 'работа',
  dungeon: 'готовность',
  recovery: 'восстановление',
};

export const interactionKindForActor = (actor: InteractionActor): InteractionKind => {
  if (actor.phase === 'moving' || actor.phase === 'away') return 'none';
  switch (actor.actionId) {
    case 'eat': return 'meal';
    case 'sleep': return 'sleep';
    case 'train': return 'training';
    case 'read': return 'reading';
    case 'talk':
    case 'apologize': return 'conversation';
    case 'help': return 'care';
    case 'seekSolitude': return 'solitude';
    case 'work': return actor.gesture === 'pack' ? 'care' : 'work';
    case 'dungeon': return 'dungeon';
    case 'recover': return 'recovery';
    default: return 'none';
  }
};

export const interactionPostureForActor = (actor: InteractionActor): InteractionPosture => {
  const kind = interactionKindForActor(actor);
  if (kind === 'meal' || kind === 'reading' || kind === 'conversation') return 'seated';
  if (kind === 'care' || kind === 'recovery') return 'kneeling';
  if (kind === 'sleep') return 'resting';
  if (kind === 'work') return 'leaning';
  if (kind === 'training' || kind === 'dungeon') return 'ready';
  return 'standing';
};

export const interactionLabelForActor = (actor: InteractionActor): string => actionLabels[interactionKindForActor(actor)];

function MealProps() {
  return (
    <group position={[0, 0, 0.5]}>
      <mesh castShadow receiveShadow position={[0, 0.38, 0]}><cylinderGeometry args={[0.28, 0.22, 0.12, 18]} /><meshStandardMaterial color="#8f6b43" roughness={0.82} /></mesh>
      <mesh castShadow position={[0, 0.47, 0]}><cylinderGeometry args={[0.2, 0.16, 0.08, 18]} /><meshStandardMaterial color="#d8c6a5" roughness={0.72} /></mesh>
      <mesh castShadow position={[0.34, 0.42, 0]}><cylinderGeometry args={[0.08, 0.09, 0.22, 14]} /><meshStandardMaterial color="#7f5637" roughness={0.8} /></mesh>
      <mesh castShadow position={[-0.29, 0.45, 0.04]} rotation={[0, 0, -0.2]}><boxGeometry args={[0.05, 0.38, 0.035]} /><meshStandardMaterial color="#b9b4aa" metalness={0.35} roughness={0.46} /></mesh>
    </group>
  );
}

function SleepProps() {
  return (
    <group position={[0, 0.02, 0]}>
      <mesh receiveShadow position={[0, 0.04, 0]}><boxGeometry args={[1.05, 0.08, 1.9]} /><meshStandardMaterial color="#49382f" roughness={0.95} /></mesh>
      <mesh castShadow position={[0, 0.13, -0.72]}><boxGeometry args={[0.68, 0.15, 0.34]} /><meshStandardMaterial color="#b9ad91" roughness={0.94} /></mesh>
      <mesh castShadow position={[0, 0.18, 0.22]}><boxGeometry args={[0.86, 0.12, 1.08]} /><meshStandardMaterial color="#435f6a" roughness={0.9} /></mesh>
    </group>
  );
}

function TrainingProps() {
  return (
    <group position={[0, 0, 0.64]}>
      <mesh castShadow position={[0, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.06, 0.92, 10]} /><meshStandardMaterial color="#8e9aa3" metalness={0.5} roughness={0.38} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}><torusGeometry args={[0.52, 0.025, 8, 36]} /><meshStandardMaterial color="#d69b43" emissive="#8f541b" emissiveIntensity={0.45} /></mesh>
      <Sparkles count={10} scale={[1.2, 0.7, 1.1]} size={1.4} speed={0.35} color="#f5bf68" position={[0, 0.5, 0]} />
    </group>
  );
}

function ReadingProps() {
  return (
    <group position={[0, 0, 0.44]} rotation={[0.08, 0, 0]}>
      <mesh castShadow position={[-0.18, 0.82, 0]} rotation={[0, 0.16, -0.08]}><boxGeometry args={[0.38, 0.04, 0.52]} /><meshStandardMaterial color="#d8c7a0" roughness={0.78} /></mesh>
      <mesh castShadow position={[0.18, 0.82, 0]} rotation={[0, -0.16, 0.08]}><boxGeometry args={[0.38, 0.04, 0.52]} /><meshStandardMaterial color="#d8c7a0" roughness={0.78} /></mesh>
      <mesh castShadow position={[0, 0.8, -0.02]}><boxGeometry args={[0.05, 0.06, 0.54]} /><meshStandardMaterial color="#6c3e27" roughness={0.86} /></mesh>
    </group>
  );
}

function ConversationProps() {
  return (
    <group position={[0, 1.42, 0.34]}>
      <mesh rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.2, 0.025, 8, 22, Math.PI * 1.25]} /><meshStandardMaterial color="#a9c4d6" emissive="#547c96" emissiveIntensity={0.35} /></mesh>
      <mesh position={[0.28, 0.11, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.12, 0.018, 8, 18, Math.PI]} /><meshStandardMaterial color="#d4c6f2" emissive="#725f98" emissiveIntensity={0.3} /></mesh>
    </group>
  );
}

function CareProps() {
  return (
    <group position={[0, 0, 0.52]}>
      <mesh castShadow position={[-0.25, 0.2, 0]}><boxGeometry args={[0.42, 0.3, 0.34]} /><meshStandardMaterial color="#6b4b33" roughness={0.88} /></mesh>
      <mesh castShadow position={[0.18, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.11, 0.11, 0.38, 16]} /><meshStandardMaterial color="#e2d8bf" roughness={0.82} /></mesh>
      <mesh position={[-0.25, 0.22, 0.18]}><boxGeometry args={[0.17, 0.04, 0.04]} /><meshStandardMaterial color="#c86659" emissive="#7a2f2a" emissiveIntensity={0.25} /></mesh>
      <mesh position={[-0.25, 0.22, 0.18]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.17, 0.04, 0.04]} /><meshStandardMaterial color="#c86659" emissive="#7a2f2a" emissiveIntensity={0.25} /></mesh>
    </group>
  );
}

function SolitudeProps() {
  return (
    <group position={[0, 0, 0.52]}>
      <mesh castShadow position={[0, 0.18, 0]}><cylinderGeometry args={[0.08, 0.1, 0.34, 14]} /><meshStandardMaterial color="#d7ccb2" roughness={0.86} /></mesh>
      <mesh position={[0, 0.42, 0]}><sphereGeometry args={[0.08, 12, 10]} /><meshStandardMaterial color="#ffd47a" emissive="#ff9d35" emissiveIntensity={2.1} /></mesh>
      <pointLight color="#ffbd69" intensity={1.6} distance={2.2} position={[0, 0.48, 0]} />
    </group>
  );
}

function WorkProps() {
  return (
    <group position={[0, 0, 0.58]}>
      <mesh castShadow receiveShadow position={[0, 0.23, 0]}><boxGeometry args={[0.68, 0.28, 0.44]} /><meshStandardMaterial color="#414b52" metalness={0.34} roughness={0.54} /></mesh>
      <mesh castShadow position={[0.34, 0.55, 0]} rotation={[0, 0, -0.42]}><boxGeometry args={[0.1, 0.68, 0.1]} /><meshStandardMaterial color="#8c969d" metalness={0.48} roughness={0.4} /></mesh>
      <Sparkles count={12} scale={[0.9, 0.8, 0.8]} size={1.8} speed={0.45} color="#ffb65c" position={[0, 0.58, 0]} />
    </group>
  );
}

function DungeonProps() {
  return (
    <group position={[0.36, 0, 0.34]}>
      <mesh castShadow position={[0, 0.38, 0]}><cylinderGeometry args={[0.09, 0.11, 0.42, 12]} /><meshStandardMaterial color="#4e555c" metalness={0.42} roughness={0.5} /></mesh>
      <mesh position={[0, 0.48, 0]}><sphereGeometry args={[0.1, 12, 10]} /><meshStandardMaterial color="#eabf69" emissive="#c56c24" emissiveIntensity={1.8} /></mesh>
      <pointLight color="#f2bd6b" intensity={1.4} distance={2.4} position={[0, 0.52, 0]} />
    </group>
  );
}

function RecoveryProps() {
  return (
    <group position={[0, 0, 0.18]}>
      <mesh receiveShadow position={[0, 0.08, 0]}><cylinderGeometry args={[0.48, 0.52, 0.14, 20]} /><meshStandardMaterial color="#5a4b63" roughness={0.92} /></mesh>
      <mesh castShadow position={[0.28, 0.24, 0.28]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.34, 16]} /><meshStandardMaterial color="#e5ddca" roughness={0.84} /></mesh>
    </group>
  );
}

function SceneProp({ prop }: { prop?: VisualProp }) {
  if (prop === 'map') {
    return <group position={[0, 0.88, 0.48]}><mesh castShadow rotation={[-0.18, 0, 0]}><boxGeometry args={[0.74, 0.035, 0.5]} /><meshStandardMaterial color="#c8ad78" roughness={0.78} /></mesh><mesh position={[0, 0.025, 0.01]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.54, 0.32]} /><meshBasicMaterial color="#706446" transparent opacity={0.5} /></mesh></group>;
  }
  if (prop === 'pack') {
    return <group position={[-0.42, 0.34, 0.16]}><mesh castShadow><boxGeometry args={[0.42, 0.58, 0.3]} /><meshStandardMaterial color="#725238" roughness={0.9} /></mesh><mesh position={[0, 0.3, 0]}><torusGeometry args={[0.16, 0.025, 8, 18]} /><meshStandardMaterial color="#a88354" roughness={0.78} /></mesh></group>;
  }
  if (prop === 'weapon') {
    return <mesh castShadow position={[0.34, 0.82, 0.12]} rotation={[0, 0, -0.28]}><boxGeometry args={[0.06, 1.2, 0.05]} /><meshStandardMaterial color="#b8c0c7" metalness={0.58} roughness={0.36} /></mesh>;
  }
  return null;
}

export function HeroInteraction3D({ heroId, actor, compact = false }: { heroId: string; actor: InteractionActor; compact?: boolean }) {
  const kind = interactionKindForActor(actor);
  const posture = interactionPostureForActor(actor);
  if (kind === 'none' && !actor.sceneProp) return null;

  return (
    <group scale={compact ? 0.82 : 1}>
      {kind === 'meal' && <MealProps />}
      {kind === 'sleep' && <SleepProps />}
      {kind === 'training' && <TrainingProps />}
      {kind === 'reading' && <ReadingProps />}
      {kind === 'conversation' && <ConversationProps />}
      {kind === 'care' && <CareProps />}
      {kind === 'solitude' && <SolitudeProps />}
      {kind === 'work' && <WorkProps />}
      {kind === 'dungeon' && <DungeonProps />}
      {kind === 'recovery' && <RecoveryProps />}
      <SceneProp prop={actor.sceneProp} />
      <Html position={[0, 0, 0]} zIndexRange={[0, 0]}>
        <span
          data-testid={`interaction-${heroId}`}
          data-interaction-kind={kind}
          data-interaction-posture={posture}
          data-interaction-contact={kind === 'none' ? 'none' : 'active'}
          data-interaction-prop={actor.sceneProp ?? 'none'}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      </Html>
    </group>
  );
}
