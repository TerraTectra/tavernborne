import type { Hero, WorldState } from '../simulation';

interface PersonalityGraphProps {
  hero: Hero;
  world: WorldState;
}

const traitLabels: Record<string, string> = {
  kindness: 'Доброта', cruelty: 'Жестокость', pride: 'Гордость', friendliness: 'Дружелюбие',
  honesty: 'Честность', patience: 'Терпение', curiosity: 'Любопытство', discipline: 'Дисциплина',
  courage: 'Смелость', caution: 'Осторожность', impulsiveness: 'Импульсивность', empathy: 'Эмпатия',
  independence: 'Самостоятельность', approvalSeeking: 'Жажда одобрения', trustfulness: 'Доверчивость',
  vengefulness: 'Мстительность', ambition: 'Амбициозность', loyalty: 'Преданность',
};

const emotionLabels: Record<string, string> = {
  joy: 'Радость', sadness: 'Грусть', anxiety: 'Тревога', anger: 'Гнев', irritation: 'Раздражение',
  guilt: 'Вина', shame: 'Стыд', fear: 'Страх', hope: 'Надежда', interest: 'Интерес',
  loneliness: 'Одиночество', inspiration: 'Воодушевление', affection: 'Привязанность', envy: 'Зависть',
};

const needLabels: Record<string, string> = {
  hunger: 'Голод', fatigue: 'Усталость', safety: 'Безопасность', social: 'Общение',
  solitude: 'Одиночество', recognition: 'Признание', growth: 'Развитие', belonging: 'Принадлежность',
};

const psycheLabels: Record<string, string> = {
  stress: 'Стресс', confidence: 'Уверенность', security: 'Чувство безопасности',
  grief: 'Горе', burnout: 'Истощение', resilience: 'Устойчивость',
};

const relationshipLabels: Record<string, string> = {
  liking: 'Симпатия', trust: 'Доверие', respect: 'Уважение', closeness: 'Близость', fear: 'Страх',
  resentment: 'Обида', envy: 'Зависть', attraction: 'Влечение', debt: 'Чувство долга', rivalry: 'Соперничество',
};

const strongest = (
  values: Record<string, number>,
  labels: Record<string, string>,
  limit = 4,
): Array<[string, number]> =>
  Object.entries(values)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, limit)
    .map(([key, value]) => [labels[key] ?? key, Math.round(value)]);

function Meter({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  const width = signed ? Math.abs(value) : value;
  const positive = value >= 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
        <span className="truncate">{label}</span>
        <span className="font-mono text-slate-100">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${signed && !positive ? 'bg-rose-400/80' : 'bg-amber-300/80'}`}
          style={{ width: `${Math.max(2, Math.min(100, width))}%` }}
        />
      </div>
    </div>
  );
}

function Cluster({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="relative z-10 rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-black/20 backdrop-blur">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function PersonalityGraph({ hero, world }: PersonalityGraphProps) {
  const relationships = Object.entries(hero.relationships)
    .flatMap(([targetId, relationship]) => {
      const targetName = targetId === world.god.id ? world.god.name : world.heroes[targetId]?.name ?? targetId;
      return strongest(relationship.values, relationshipLabels, 2).map(([label, value]) => [
        `${targetName}: ${label}`,
        value,
      ] as [string, number]);
    })
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, 5);

  const decision = hero.currentAction;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.08),_transparent_45%)] p-4 lg:p-6">
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-30" viewBox="0 0 1000 620" preserveAspectRatio="none">
        <g stroke="rgb(251 191 36)" strokeWidth="1.2" fill="none">
          <path d="M260 105 C390 105 410 255 500 305" />
          <path d="M260 305 C390 305 410 305 500 305" />
          <path d="M260 505 C390 505 410 355 500 305" />
          <path d="M740 105 C610 105 590 255 500 305" />
          <path d="M740 305 C610 305 590 305 500 305" />
          <path d="M740 505 C610 505 590 355 500 305" />
        </g>
      </svg>

      <div className="relative grid gap-4 lg:grid-cols-[1fr_0.9fr_1fr] lg:grid-rows-3">
        <Cluster title="Характер" subtitle="Медленно меняющиеся склонности">
          {strongest(hero.traits, traitLabels, 5).map(([label, value]) => (
            <Meter key={label} label={label} value={value} />
          ))}
        </Cluster>

        <div className="hidden lg:block" />

        <Cluster title="Эмоции" subtitle="Одновременные текущие переживания">
          {strongest(hero.emotions, emotionLabels, 5).map(([label, value]) => (
            <Meter key={label} label={label} value={value} />
          ))}
        </Cluster>

        <Cluster title="Потребности" subtitle="Давление тела и социальной среды">
          {strongest(hero.needs, needLabels, 5).map(([label, value]) => (
            <Meter key={label} label={label} value={value} />
          ))}
        </Cluster>

        <section className="relative z-20 flex min-h-64 flex-col justify-center rounded-3xl border border-amber-300/30 bg-amber-200/10 p-5 text-center shadow-2xl shadow-amber-950/30">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Решение</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            {decision?.label ?? 'Оценивает обстановку'}
          </h3>
          {decision?.targetId && (
            <p className="mt-1 text-sm text-slate-300">
              Цель: {decision.targetId === world.god.id ? world.god.name : world.heroes[decision.targetId]?.name}
            </p>
          )}
          <div className="mt-5 space-y-2 text-left">
            {(decision?.reasons ?? []).map((item) => (
              <div key={`${item.label}-${item.value}`} className="flex justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs">
                <span className="text-slate-300">{item.label}</span>
                <span className={item.value >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {item.value >= 0 ? '+' : ''}{item.value.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <Cluster title="Психика" subtitle="Долгосрочное внутреннее состояние">
          {strongest(hero.psyche, psycheLabels, 5).map(([label, value]) => (
            <Meter key={label} label={label} value={value} />
          ))}
        </Cluster>

        <Cluster title="Память" subtitle="Следы событий и личная интерпретация">
          {hero.memories.length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет значимых воспоминаний.</p>
          ) : (
            hero.memories.slice(0, 4).map((memory) => (
              <div key={memory.id} className="rounded-xl bg-white/5 p-3">
                <p className="text-sm text-slate-200">{memory.summary}</p>
                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>важность {Math.round(memory.importance)}</span>
                  <span>{memory.valence >= 0 ? '+' : ''}{memory.valence}</span>
                </div>
              </div>
            ))
          )}
        </Cluster>

        <Cluster title="Цели" subtitle="Причины действовать вопреки сиюминутному состоянию">
          {hero.goals.map((goal) => (
            <div key={goal.id} className="rounded-xl bg-white/5 p-3">
              <p className="text-sm text-slate-200">{goal.label}</p>
              <Meter label="Приоритет" value={goal.priority} />
            </div>
          ))}
        </Cluster>

        <Cluster title="Отношения" subtitle="Направленные связи с богом и детьми">
          {relationships.map(([label, value]) => (
            <Meter key={label} label={label} value={value} signed />
          ))}
        </Cluster>
      </div>
    </div>
  );
}
