'use client';

import { useMemo, useState } from 'react';
import { FAMILY_LABEL } from '../lib/licenses.ts';
import { QUESTIONS, recommend, summarizeAnswers, type Answers } from '../lib/wizard.ts';
import { t } from '../lib/ui.ts';
import type { Lang, LicenseEntry } from '../lib/types.ts';

interface Props {
  lang: Lang;
  onPick: (id: string) => void;
  pickedId: string | null;
  /**
   * 问卷走完（或用户选择跳过）时调用。
   * 传入 `skipped`：走完问卷的人通常第一次发项目，跳过的通常是熟手——
   * 这个区别只用于决定 REUSE 布局的默认值。
   */
  onFinish: (skipped: boolean) => void;
}

export default function Wizard({ lang, onPick, pickedId, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [showResults, setShowResults] = useState(false);
  const tr = t(lang);

  const q = QUESTIONS[index];
  const atEnd = index >= QUESTIONS.length - 1;
  const recommendations = useMemo(() => (showResults ? recommend(answers) : []), [showResults, answers]);
  const allAnswered = QUESTIONS.filter((item) => item.required).every((item) => answers[item.id]);

  const answer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [q.id]: prev[q.id] === value ? null : value }));
    // 单选：点完自动前进，减少无谓点击；最后一个问题不自动跳，避免抢走结果页
    if (!atEnd) {
      window.setTimeout(() => setIndex((i) => Math.min(i + 1, QUESTIONS.length - 1)), 160);
    }
  };

  return (
    <div className="space-y-6">
      {/* 流程起点说明：这里就是网站打开后的第一屏，先把"接下来会发生什么"讲清楚 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-900/10 bg-white p-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{lang === 'zh' ? '从问卷开始' : 'Start with the questionnaire'}</h2>
          <p className="mt-1 text-xs text-ink-600">
            {lang === 'zh'
              ? '答完这几题会给你一组候选与各自的代价，然后进入「选择与对比」挑定一个，最后生成整套文件。'
              : 'Answering these gives you a candidate set with each one’s cost; then pick one under "Pick and compare" and generate the full file set.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onFinish(true)}
          className="shrink-0 rounded-lg border border-ink-900/20 px-3 py-2 text-sm hover:border-ink-900"
        >
          {lang === 'zh' ? '跳过问卷，直接选许可证 →' : 'Skip — pick a license directly →'}
        </button>
      </div>

      {/* 进度 */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
        <span className="mono rounded bg-ink-900 px-2 py-1 text-xs text-white">
          {tr.step} {index + 1} / {QUESTIONS.length}
        </span>
        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded bg-ink-900/10">
          <div
            className="h-full rounded bg-ink-900 transition-all"
            style={{ width: `${((index + 1) / QUESTIONS.length) * 100}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setAnswers({});
            setIndex(0);
            setShowResults(false);
          }}
          className="ml-auto underline decoration-dotted hover:text-ink-900"
        >
          {tr.restart}
        </button>
      </div>

      <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold sm:text-2xl">{q.title[lang]}</h2>
        {/* "为什么问这个"是本项目的核心差异：竞品只给问题，不给理由 */}
        <p className="mt-3 border-l-2 border-ink-900/20 pl-3 text-sm leading-relaxed text-ink-600">
          {q.why[lang]}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {q.options.map((opt) => {
            const active = answers[q.id] === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => answer(opt.value)}
                aria-pressed={active}
                className={[
                  'rounded-lg border p-4 text-left transition',
                  active
                    ? 'border-ink-900 bg-ink-900 text-white shadow'
                    : 'border-ink-900/15 bg-white hover:border-ink-900/40 hover:bg-ink-900/[0.03]',
                ].join(' ')}
              >
                <span className="block font-medium">{opt.label[lang]}</span>
                {opt.note ? (
                  <span className={['mt-1 block text-xs', active ? 'text-white/75' : 'text-ink-400'].join(' ')}>
                    {opt.note[lang]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm disabled:opacity-40"
          >
            {tr.prev}
          </button>
          {!atEnd ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="rounded-lg bg-ink-900 px-4 py-2 text-sm text-white"
            >
              {tr.next}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowResults(true)}
            className="rounded-lg border border-ink-900 px-4 py-2 text-sm font-medium"
          >
            {tr.seeResults}
          </button>
          {/* 这一步是流程的主出口：问卷的产出是"候选集"，选哪个要去选择页看完整条款 */}
          <button
            type="button"
            onClick={() => onFinish(false)}
            disabled={!allAnswered}
            title={allAnswered ? undefined : lang === 'zh' ? '先答完必答项' : 'Answer the required questions first'}
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {lang === 'zh' ? '去选择与对比挑定 →' : 'Go pick one →'}
          </button>
        </div>
      </section>

      {showResults ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-xl font-semibold">{tr.results}</h2>
            <p className="text-sm text-ink-600">
              {lang === 'zh'
                ? '下面不是"唯一正确答案"，而是候选集与各自的代价——决定权在你。点「用它」直接生成，或点上面的按钮去「选择与对比」看完整条款。'
                : 'Not a single correct answer, but a candidate set with each one’s cost. It is your call. Click "Use" to generate, or head to "Pick and compare" for the full terms.'}
            </p>
          </div>

          {recommendations.map((rec) => (
            <RecCard
              key={rec.license.id}
              lang={lang}
              entry={rec.license}
              reasons={rec.reasons}
              cautions={rec.cautions}
              active={pickedId === rec.license.id}
              onPick={() => onPick(rec.license.id)}
            />
          ))}

          <details className="rounded-lg border border-ink-900/10 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-medium">
              {lang === 'zh' ? '复查我的回答' : 'Review my answers'}
            </summary>
            <pre className="mono mt-3 whitespace-pre-wrap text-xs text-ink-600">{summarizeAnswers(answers, lang)}</pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}

function RecCard({
  lang,
  entry,
  reasons,
  cautions,
  active,
  onPick,
}: {
  lang: Lang;
  entry: LicenseEntry;
  reasons: { zh: string; en: string }[];
  cautions: { zh: string; en: string }[];
  active: boolean;
  onPick: () => void;
}) {
  const tr = t(lang);
  return (
    <article
      className={[
        'rounded-xl border bg-white p-5 shadow-sm',
        active ? 'border-ink-900 ring-1 ring-ink-900/20' : 'border-ink-900/10',
      ].join(' ')}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{entry.name}</h3>
        <code className="mono rounded bg-ink-900/[0.06] px-1.5 py-0.5 text-xs">{entry.id}</code>
        <span className="rounded-full border border-ink-900/15 px-2 py-0.5 text-xs text-ink-600">
          {FAMILY_LABEL[entry.family][lang]}
        </span>
      </header>

      <p className="mt-2 text-sm text-ink-600">{entry.tagline[lang]}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ok">{tr.reasons}</h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-ok">
                  +
                </span>
                <span>{r[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-advisory">{tr.cautions}</h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {cautions.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-advisory">
                  −
                </span>
                <span>{c[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={onPick}
        className="mt-4 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white"
      >
        {active ? (lang === 'zh' ? '已选择' : 'Selected') : tr.useThis}
      </button>
    </article>
  );
}
