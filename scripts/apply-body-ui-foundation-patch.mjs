import { readFileSync, writeFileSync } from 'node:fs';

const replaceExact = (path, from, to) => {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Expected fragment not found in ${path}: ${from.slice(0, 120)}`);
  writeFileSync(path, source.replace(from, to), 'utf8');
};

replaceExact(
  'src/rts/realtime.ts',
  "  sleep: [{ x: 77, y: 19 }, { x: 84, y: 19 }, { x: 89, y: 19 }],",
  "  sleep: [{ x: 72.7, y: 20.2 }, { x: 78.3, y: 21.8 }, { x: 84, y: 20.2 }],",
);
replaceExact(
  'src/rts/realtime.ts',
  "  recover: [{ x: 77, y: 22 }, { x: 84, y: 22 }, { x: 89, y: 22 }],",
  "  recover: [{ x: 72.7, y: 20.2 }, { x: 78.3, y: 21.8 }, { x: 84, y: 20.2 }],",
);
replaceExact(
  'src/rts/realtime.ts',
  "const socialActions = new Set<ActionId>(['talk', 'help', 'apologize']);\nconst distance = (left: Point, right: Point) => Math.hypot(right.x - left.x, right.y - left.y);",
  "const socialActions = new Set<ActionId>(['talk', 'help', 'apologize']);\nconst actionMovementRate = (actionId: ActionId | undefined): number => {\n  if (actionId === 'recover' || actionId === 'sleep') return 0.62;\n  if (actionId === 'seekSolitude' || actionId === 'read') return 0.78;\n  if (actionId === 'dungeon') return 0.84;\n  if (actionId === 'work' || actionId === 'help') return 0.9;\n  if (actionId === 'train') return 1.06;\n  return 1;\n};\nconst distance = (left: Point, right: Point) => Math.hypot(right.x - left.x, right.y - left.y);",
);
replaceExact(
  'src/rts/realtime.ts',
  "const unitsPerSecond = 8.5 * Math.max(0.7, speedRef.current) * (actor.movementRate ?? 1);",
  "const unitsPerSecond = 8.5 * Math.max(0.7, speedRef.current) * (actor.movementRate ?? 1) * actionMovementRate(directive.actionId);",
);
replaceExact(
  'src/rts/realtime.ts',
  "const unitsPerSecond = 8.5 * Math.max(0.7, speedRef.current) * (actor.movementRate ?? 1);",
  "const unitsPerSecond = 8.5 * Math.max(0.7, speedRef.current) * (actor.movementRate ?? 1) * actionMovementRate(action.actionId);",
);

replaceExact(
  'src/three/AssetHeroBody3D.tsx',
  "function modelPoseFor(posture: InteractionPosture): { position: [number, number, number]; rotation: [number, number, number] } {\n  if (posture === 'seated')",
  "function modelPoseFor(posture: InteractionPosture, intent: AnimationIntent): { position: [number, number, number]; rotation: [number, number, number] } {\n  if (intent === 'sleep') return { position: [0, 0.46, -0.54], rotation: [-Math.PI / 2, 0, 0] };\n  if (posture === 'seated')",
);
replaceExact(
  'src/three/AssetHeroBody3D.tsx',
  '  const modelPose = modelPoseFor(posture);',
  '  const modelPose = modelPoseFor(posture, intent);',
);
replaceExact(
  'src/three/AssetHeroBody3D.tsx',
  "  const bubbleX = bubbleLane * 0.4;\n  const bubbleY = (compact ? 3.03 : 3.42) + Math.abs(bubbleLane) * 0.1;",
  "  const bubbleX = bubbleLane * 1.12;\n  const bubbleY = (compact ? 3.03 : 3.42) + Math.abs(bubbleLane) * 0.22;",
);
replaceExact(
  'src/three/AssetHeroBody3D.tsx',
  "  const dialogueMaxWidth = actor.dialogueLength === 'expanded' ? 340 : actor.dialogueLength === 'terse' ? 220 : 280;",
  "  const dialogueMaxWidth = actor.dialogueLength === 'expanded' ? 300 : actor.dialogueLength === 'terse' ? 210 : 260;\n  const dialogueWidth = actor.dialogueLength === 'expanded' ? 280 : actor.dialogueLength === 'terse' ? 190 : 240;\n  const showDialogueBubble = Boolean(actor.bubble) && actor.phase !== 'moving' && (!actor.sceneId || actor.dialogueIsSpeaker !== false);",
);
replaceExact(
  'src/three/AssetHeroBody3D.tsx',
  '          data-dialogue-reason={actor.dialogueReason ?? \'\'}\n          data-facing=',
  '          data-dialogue-reason={actor.dialogueReason ?? \'\'}\n          data-body-pose={hero.body.pose.name}\n          data-facing=',
);
replaceExact(
  'src/three/AssetHeroBody3D.tsx',
  "      {actor.bubble && actor.phase !== 'moving' && (\n        <Html center position={[bubbleX, bubbleY, 0]} zIndexRange={[35, 12]}>",
  "      {showDialogueBubble && (\n        <Html center position={[bubbleX, bubbleY, 0]} zIndexRange={[35, 12]} wrapperClass=\"world3d-dialogue-anchor\">",
);
replaceExact(
  'src/three/AssetHeroBody3D.tsx',
  "            data-dialogue-memory-id={actor.dialogueMemoryId ?? 'none'}\n            title={actor.dialogueReason}",
  "            data-dialogue-memory-id={actor.dialogueMemoryId ?? 'none'}\n            data-dialogue-is-speaker={actor.dialogueIsSpeaker ? 'true' : 'false'}\n            title={actor.dialogueReason}",
);
replaceExact(
  'src/three/AssetHeroBody3D.tsx',
  "              maxWidth: dialogueMaxWidth,\n              lineHeight: dialogueLineHeight,",
  "              width: dialogueWidth,\n              maxWidth: dialogueMaxWidth,\n              lineHeight: dialogueLineHeight,",
);

// This file is intentionally temporary and will be removed after the source patch is committed.
