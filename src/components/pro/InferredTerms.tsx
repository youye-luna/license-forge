'use client';

import { useMemo } from 'react';
import { FAMILY_LABEL } from '../../lib/licenses.ts';
import { type ChooseALicenseTerms, deriveFacts, lookupTerms } from '../../lib/spdx.ts';
import type { Lang } from '../../lib/types.ts';
import { buildTermGroups, TermsBox } from './TermsBox';

/* ------------------------------------------------------------------ *
 * 白话对照表
 *
 * 详情面板是给"正在发第一个开源项目的人"看的，不是给法务看的。
 * 术语本身保留（搜索、对照资料时要用到），但每个术语旁边补一句
 * **"这意味着我该怎么做"**——否则看到"弱著佐权"四个字仍然不知道要不要开源。
 * ------------------------------------------------------------------ */

/** 许可类型：术语 + 一句"这意味着什么" */
const FAMILY_PLAIN: Record<string, { zh: string; en: string }> = {
  permissive: { zh: '随便用，改了也不必开源', en: 'use it freely; forks need not stay open' },
  'public-domain': {
    zh: '作者基本放弃了权利，几乎没有条件',
    en: 'the author waived their rights; almost no conditions',
  },
  content: { zh: '给文字、图片、数据用的，不是给代码用的', en: 'for text, images and data — not for code' },
  'weak-copyleft': {
    zh: '改过的那几个文件要跟着开源，整个项目可以不开源',
    en: 'modified files must stay open; the wider project need not',
  },
  'strong-copyleft': {
    zh: '用了它，整个项目发布时都要用同一个许可开源',
    en: 'the whole project must ship under the same license',
  },
  'network-copyleft': {
    zh: '做成网站给别人用，也要把源码公开',
    en: 'running it as a service also requires publishing source',
  },
  proprietary: {
    zh: '这不是开源许可，对使用和分发有限制',
    en: 'not open source; it restricts use and distribution',
  },
  unknown: { zh: '类型不明确，请直接看原文', en: 'unclear — read the text' },
};

/** 从正文推断条款，并把"这是推断"写在明面上 */
export function InferredTerms({
  lang,
  id,
  text,
  osiApproved,
  categoryFamily,
  terms,
  nonOpen,
}: {
  lang: Lang;
  id: string;
  text: string;
  osiApproved: boolean;
  categoryFamily?: string;
  terms: ChooseALicenseTerms | null;
  nonOpen: boolean;
}) {
  const zh = lang === 'zh';
  const facts = useMemo(
    () => deriveFacts(id, text, osiApproved, categoryFamily, terms),
    [id, text, osiApproved, categoryFamily, terms],
  );

  const familySourceNote =
    facts.familySource === 'scancode-category'
      ? zh
        ? 'ScanCode 数据库给它的分类'
        : 'a category from the ScanCode database'
      : facts.familySource === 'spdx-id'
        ? zh
          ? '它的 SPDX 名字'
          : 'its SPDX identifier'
        : zh
          ? '读正文猜的（最不可靠的一档）'
          : 'text matching (the least reliable tier)';

  const rows: { label: string; value: string; tone?: 'yes' | 'no' | 'warn' }[] = [
    {
      label: zh ? '许可类型' : 'License type',
      value: `${FAMILY_LABEL[facts.family][lang]}　${FAMILY_PLAIN[facts.family]?.[lang] ?? ''}`,
    },
    {
      // 最基础的一条义务：分发时要不要带上版权声明与许可证全文。
      // 只有 0BSD / CC0 / MIT-0 / Unlicense / WTFPL 五个明确不要求。
      label: zh ? '保留版权声明与许可证' : 'Keep the copyright notice and license',
      value:
        facts.includeCopyright === 'required'
          ? zh
            ? '要带上：分发时要附上版权声明和许可证全文'
            : 'yes — include the notice and the full license when you distribute'
          : facts.includeCopyright === 'source-only'
            ? zh
              ? '只在源码里要带，二进制分发不必'
              : 'only in source form; binaries are exempt'
            : facts.includeCopyright === 'not-required'
              ? zh
                ? '不要求：连署名都不要求'
                : 'not required — not even attribution'
              : zh
                ? '正文没写（不等于没义务：版权法本身通常要求保留声明）'
                : 'not stated in the text — which is not the same as no duty: copyright law usually requires it',
      tone: facts.includeCopyright === 'silent' ? 'warn' : undefined,
    },
    {
      label: zh ? '专利' : 'Patents',
      value:
        facts.patentGrant === 'explicit'
          ? zh
            ? '明确授予了专利使用权'
            : 'grants patent rights'
          : facts.patentGrant === 'none'
            ? zh
              ? '明确说了不授予'
              : 'grants none'
            : zh
              ? '没提到（不等于安全）'
              : 'not mentioned — which is not the same as safe',
      tone: facts.patentGrant === 'explicit' ? 'yes' : facts.patentGrant === 'none' ? 'no' : 'warn',
    },
    {
      label: zh ? '做成网站给别人用' : 'Running it as a service',
      value: facts.networkTrigger
        ? zh
          ? '也要开源'
          : 'must publish source'
        : zh
          ? '不需要开源'
          : 'no extra duty',
      tone: facts.networkTrigger ? 'yes' : 'no',
    },
    {
      label: zh ? '新项目是否开源' : 'Must your new project be open source',
      value: facts.sameLicenseWholeWork
        ? zh
          ? '要：整个项目都得用同一许可开源'
          : 'yes — the whole project must ship under the same license'
        : facts.sameLicensePerFile
          ? zh
            ? '只有改过的那几个文件要开源，新写的代码可以不开源'
            : 'only the files you modified; newly written code need not be'
          : zh
            ? '不用：新项目可以闭源'
            : 'no — your project can stay closed source',
    },
    {
      // 背书与促销是两种不同性质的行为，条款也常分开写，所以列成两条：
      //   背书 = 意见表达（"XX 官方推荐本产品"）——借别人的信誉为你增信
      //   促销 = 市场行为（"本产品基于 XX 的技术"）——借别人的知名度吸引流量
      // 实测 262 个许可两者都禁、53 个只禁背书、4 个只禁促销，
      // 合成一条会让那 57 个的结论失真。
      //
      // 也与「商标」不是一回事：商标讲能不能用它的商品名，
      // Apache-2.0 有商标条款却不禁这两项，BSD-3-Clause 才是典型。
      label: zh ? '用作者名义背书' : 'Endorsement with their names',
      value:
        facts.endorse === 'prohibited'
          ? zh
            ? '不许：不能说"作者认可/推荐本产品"'
            : 'not allowed: you may not imply they endorse or recommend your product'
          : zh
            ? '正文没写（不等于可以：借别人信誉增信通常要另行取得同意）'
            : 'not stated — which does not mean it is allowed; borrowing their credibility usually needs separate consent',
      tone: facts.endorse === 'silent' ? 'warn' : 'no',
    },
    {
      label: zh ? '用作者名义促销' : 'Promotion with their names',
      value:
        facts.promote === 'prohibited'
          ? zh
            ? '不许：不能在宣传里说"本产品基于作者的技术"'
            : 'not allowed: you may not advertise your product as built on their work'
          : zh
            ? '正文没写（不等于可以：用别人名义做宣传通常要另行取得同意）'
            : 'not stated — which does not mean it is allowed; promoting with their name usually needs separate consent',
      tone: facts.promote === 'silent' ? 'warn' : 'no',
    },
    {
      label: zh ? '变更说明' : 'Change notices',
      value: facts.stateChanges ? (zh ? '要写明改了什么' : 'yes') : zh ? '没有要求' : 'not required',
      tone: facts.stateChanges ? 'yes' : undefined,
    },
    {
      // 商标一律是"不授权"。区别只在于许可有没有**明写**这一句。
      //
      // ChooseALicense 对 `trademark-use` 的说明很直白："This license explicitly
      // states that it does NOT grant trademark rights, **even though licenses
      // without such a statement probably do not grant any implicit trademark
      // rights**."——没写的那 32 个（含 MIT、BSD、GPL）实质上也一样不授权。
      //
      // 所以默认文案就是"不授权"，只有明写了才额外标出"许可里写明了"。
      // 早先写成"没提到"，会让人以为 MIT 的商标情况比 Apache-2.0 宽松，
      // 那是把用户往错的方向引。
      label: zh ? '商标' : 'Trademarks',
      value: facts.trademarkClause
        ? zh
          ? '不授予商标权（许可里写明了）'
          : 'no trademark rights, stated explicitly'
        : zh
          ? '不授予商标权（许可里没写，但同样不授权）'
          : 'no trademark rights — not stated, but still not granted',
    },
  ];

  // GitHub 式条款框的数据：47 个上游标注过的直接照抄，其余从推断出的事实映射
  const groups = buildTermGroups(lookupTerms(terms, id), facts, nonOpen);

  return (
    <section className="space-y-4">
      {/* GitHub 式条款框：三组纵向堆叠（GitHub 横向三列，这里窄屏放不下，改纵向） */}
      <TermsBox lang={lang} groups={groups} termsSource={facts.termsSource} />

      {/* 白话逐条解释收进折叠区：条款框负责"一眼看懂有什么权利"，这里负责"细看每一项的边界" */}
      <details className="rounded-lg border border-ink-900/10 bg-white p-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-400">
          {zh ? '这份许可的几条关键规定（逐条白话）' : 'What this license actually requires, line by line'}
        </summary>
        <dl className="mt-2 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="border-b border-ink-900/[0.06] pb-2 text-sm last:border-0">
              <dt className="text-ink-600">{r.label}</dt>
              <dd
                className={[
                  'mt-1',
                  r.tone === 'yes'
                    ? 'text-ok'
                    : r.tone === 'no'
                      ? 'text-ink-400'
                      : r.tone === 'warn'
                        ? 'text-advisory'
                        : '',
                ].join(' ')}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-600">
          {facts.termsSource === 'choosealicense'
            ? zh
              ? '以上几条是上游逐条标注的，可以放心参考。'
              : 'These were labelled upstream and can be relied on.'
            : zh
              ? '以上几条是机器读正文猜的，只能当参考。要下正式判断请打开许可证原文。'
              : 'These were inferred by machine from the text — treat them as a hint only. For a real decision, read the license itself.'}
        </p>
        <details className="mt-2 rounded-lg border border-ink-900/10 p-3 text-xs text-ink-600">
          <summary className="cursor-pointer text-ink-400">
            {zh ? '这些结论是怎么来的' : 'Where these conclusions come from'}
          </summary>
          <div className="mt-2 space-y-2">
            <p>
              {zh ? `许可类型来自：${familySourceNote}。` : `License type comes from: ${familySourceNote}.`}
            </p>
            <p>
              {facts.termsSource === 'choosealicense'
                ? zh
                  ? '其余几条来自 ChooseALicense 的词表逐条标注（覆盖 47 个主流许可证），比机器读正文可靠得多。它的词表分成 permissions / conditions / limitations 三段，其中 `patent-use` 在 permissions 里表示"授予专利"、在 limitations 里表示"不授予专利"，合并时已按段区分。'
                  : 'The rest come from ChooseALicense’s upstream-labelled vocabulary (47 mainstream licenses), which is far more reliable than machine reading. Its vocabulary splits into permissions / conditions / limitations, and `patent-use` means "grants patents" under permissions but "grants none" under limitations — that distinction is handled when merging.'
                : zh
                  ? '其余几条由许可证正文的关键词匹配得出。这个许可证不在 ChooseALicense 的 47 个标注范围内，所以只能这样。我们宁可标注"不确定"，也不给一个看起来确定的答案。'
                  : 'The rest come from keyword matching over the license text, because this license is outside ChooseALicense’s 47 labelled entries. We label the uncertainty rather than show a confident answer we cannot back.'}
            </p>
          </div>
        </details>
      </details>
    </section>
  );
}
