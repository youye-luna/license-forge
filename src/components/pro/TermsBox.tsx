'use client';

import type { Lang } from '../../lib/types.ts';
import { Check, Info, X } from '../Icons';

/* ------------------------------------------------------------------ *
 * GitHub 式条款框
 *
 * GitHub 在每个仓库页展示的许可证框（Permissions / Limitations /
 * Conditions 三组，绿勾、红叉、蓝色 i）用的词表就是 ChooseALicense 的
 * vocabulary。本站对 47 个主流许可证有同一份上游标注，所以能原样呈现；
 * 不在标注范围内的长尾条目，则从已推断出的条款事实映射回同一套标签，
 * 并在框底如实标注"机器猜的"。
 *
 * 用户要求三组**纵向排列**（GitHub 是横向三列，窄屏放不下，纵向更稳）。
 * ------------------------------------------------------------------ */

/** 词表标签的双语文案：label 是条目名，desc 是"这对我意味着什么" */
const TERM_TAGS: Record<
  string,
  { zh: { label: string; desc: string }; en: { label: string; desc: string } }
> = {
  'commercial-use': {
    zh: { label: '商用', desc: '可以用在商业项目里：卖钱、闭源产品都不违反这份许可。' },
    en: {
      label: 'Commercial use',
      desc: 'You may use it in commercial products, including closed-source ones.',
    },
  },
  modifications: {
    zh: { label: '修改', desc: '可以直接改它的源码。' },
    en: { label: 'Modification', desc: 'You may modify the source code.' },
  },
  distribution: {
    zh: { label: '分发', desc: '可以把原始版本或你改过的版本发布给别人。' },
    en: { label: 'Distribution', desc: 'You may share the original or your modified version.' },
  },
  'private-use': {
    zh: { label: '私用', desc: '自己或公司内部使用，不必公开任何改动。' },
    en: { label: 'Private use', desc: 'You may use and modify it privately without releasing anything.' },
  },
  'patent-use': {
    zh: { label: '专利授权', desc: '作者明确授予你使用其相关专利的权利。' },
    en: { label: 'Patent use', desc: 'The license explicitly grants rights to the contributors’ patents.' },
  },
  'include-copyright': {
    zh: { label: '保留版权与许可声明', desc: '分发时必须带上版权声明和许可证全文。' },
    en: {
      label: 'License and copyright notice',
      desc: 'Include the copyright notice and the license text when you distribute.',
    },
  },
  'include-copyright--source': {
    zh: { label: '源码内保留声明', desc: '以源码形式分发时要带上声明，纯二进制分发可豁免。' },
    en: {
      label: 'License and copyright notice for source',
      desc: 'The notice is required in source form; binaries are exempt.',
    },
  },
  'document-changes': {
    zh: { label: '说明变更', desc: '改过的文件里要注明你做了修改。' },
    en: { label: 'State changes', desc: 'Modified files must document the changes you made.' },
  },
  'disclose-source': {
    zh: { label: '公开源码', desc: '分发时（包括你改过的版本）必须把源码一并给到接收方。' },
    en: { label: 'Disclose source', desc: 'When you distribute, you must make the source code available.' },
  },
  'network-use-disclose': {
    zh: {
      label: '做成网站也要公开源码',
      desc: '把它跑成在线服务给别人用，同样触发开源义务——这是它区别于普通 GPL 的地方。',
    },
    en: {
      label: 'Network use is distribution',
      desc: 'Running it as a service for others also triggers the source-disclosure duty.',
    },
  },
  'same-license': {
    zh: { label: '整体同许可', desc: '基于它的衍生作品，整个项目都必须用同一份许可发布。' },
    en: {
      label: 'Same license (work)',
      desc: 'Derivative works as a whole must be released under the same license.',
    },
  },
  'same-license--file': {
    zh: { label: '文件级同许可', desc: '只有被修改的那些文件要保持同许可，你新写的其余代码可以另作安排。' },
    en: {
      label: 'Same license (file)',
      desc: 'Only the modified files stay under the same license; new code need not.',
    },
  },
  'same-license--library': {
    zh: { label: '库级同许可', desc: '闭源程序可以链接使用它，但库本身的修改必须回馈。' },
    en: {
      label: 'Same license (library)',
      desc: 'Proprietary programs may link to it; changes to the library itself must be shared back.',
    },
  },
  'trademark-use': {
    zh: { label: '不含商标授权', desc: '不授予商标权：不能借它的名字或 logo 为你的产品增信。' },
    en: {
      label: 'Trademark use',
      desc: 'No trademark rights are granted — its name and logo stay off-limits for promotion.',
    },
  },
  liability: {
    zh: { label: '责任限制', desc: '使用它造成损失时，作者和贡献者不承担赔偿责任。' },
    en: { label: 'Liability', desc: 'The authors are not liable for damages arising from use.' },
  },
  warranty: {
    zh: { label: '无担保', desc: '按"现状"提供，没有任何质量或适用性担保。' },
    en: { label: 'Warranty', desc: 'Provided "as is", with no warranty of any kind.' },
  },
};

/** 三组的展示顺序与图标配色：与 GitHub 的框一致（绿勾 / 红叉 / 蓝 i） */
const TERM_GROUPS: {
  key: 'permissions' | 'limitations' | 'conditions';
  zh: string;
  en: string;
  tone: string;
  Icon: (props: { className?: string }) => React.ReactNode;
}[] = [
  { key: 'permissions', zh: '权限', en: 'Permissions', tone: 'text-ok', Icon: Check },
  { key: 'limitations', zh: '限制', en: 'Limitations', tone: 'text-mandatory', Icon: X },
  { key: 'conditions', zh: '条件', en: 'Conditions', tone: 'text-info', Icon: Info },
];

/**
 * `patent-use` 在上游词表里同名反义：出现在 permissions 表示"授予专利"，
 * 出现在 limitations 表示"明确不授予"。渲染时必须按所在组区分文案，
 * 否则限制组里会出现一句"作者明确授予你……"，自相矛盾。
 */
function termMeta(tag: string, group: 'permissions' | 'limitations' | 'conditions', zh: boolean) {
  if (group === 'limitations' && tag === 'patent-use') {
    return zh
      ? { label: '不含专利授权', desc: '正文明确不授予任何专利使用权——想保留专利主张时这一条要紧。' }
      : { label: 'Patent use', desc: 'The license explicitly grants no patent rights.' };
  }
  return TERM_TAGS[tag]?.[zh ? 'zh' : 'en'];
}

/** 把条目解析成三组标签：有上游标注直接照抄，没有就从推断出的条款事实映射 */
export function buildTermGroups(
  cal: { permissions: string[]; conditions: string[]; limitations: string[] } | null,
  facts: DerivedFactsLike,
  nonOpen: boolean,
): Record<'permissions' | 'limitations' | 'conditions', string[]> {
  if (cal) return { permissions: cal.permissions, limitations: cal.limitations, conditions: cal.conditions };

  const permissions: string[] = [];
  if (!nonOpen) permissions.push('commercial-use', 'modifications', 'distribution', 'private-use');
  if (facts.patentGrant === 'explicit') permissions.push('patent-use');

  const conditions: string[] = [];
  if (facts.includeCopyright === 'required') conditions.push('include-copyright');
  else if (facts.includeCopyright === 'source-only') conditions.push('include-copyright--source');
  if (facts.stateChanges) conditions.push('document-changes');
  if (facts.sameLicenseWholeWork) conditions.push('disclose-source', 'same-license');
  if (facts.sameLicensePerFile) conditions.push('disclose-source', 'same-license--file');
  if (facts.networkTrigger) conditions.push('network-use-disclose');

  const limitations = ['trademark-use', 'liability', 'warranty'];
  if (facts.patentGrant === 'none') limitations.push('patent-use');

  return { permissions, limitations, conditions };
}

/** buildTermGroups 需要的最小事实集合（deriveFacts 的返回值天然满足） */
interface DerivedFactsLike {
  patentGrant: 'explicit' | 'none' | 'silent';
  stateChanges: boolean;
  sameLicenseWholeWork: boolean;
  sameLicensePerFile: boolean;
  networkTrigger: boolean;
  includeCopyright: 'required' | 'source-only' | 'not-required' | 'silent';
}

/**
 * GitHub 式条款框本体。
 *
 * 详情面板与对比工作台共用同一个组件：两边各写一份的话，
 * 改一处文案另一处就会悄悄落后，用户看到的"同一份许可"会有两套说法。
 */
export function TermsBox({
  lang,
  groups,
  termsSource,
}: {
  lang: Lang;
  groups: Record<'permissions' | 'limitations' | 'conditions', string[]>;
  termsSource: 'choosealicense' | 'text';
}) {
  const zh = lang === 'zh';
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-ink-900/[0.02]">
      {TERM_GROUPS.map((g) => {
        const tags = groups[g.key].filter((t) => termMeta(t, g.key, zh));
        if (!tags.length) return null;
        return (
          <div key={g.key} className="border-t border-ink-900/[0.08] first:border-t-0">
            <h4 className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
              {zh ? g.zh : g.en}
            </h4>
            <ul className="space-y-2 px-4 pb-4">
              {tags.map((t) => {
                const m = termMeta(t, g.key, zh);
                if (!m) return null;
                return (
                  <li key={t} className="flex gap-2">
                    <g.Icon className={`mt-0.5 shrink-0 ${g.tone}`} />
                    <span>
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-ink-600">{m.desc}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-900/[0.08] px-4 py-3 text-xs text-ink-400">
        <span
          className={[
            'rounded-md border px-2 py-1 text-[10px]',
            termsSource === 'choosealicense'
              ? 'border-ok/40 bg-ok/5 text-ok'
              : 'border-advisory/40 bg-advisory/5 text-advisory',
          ].join(' ')}
        >
          {termsSource === 'choosealicense'
            ? zh
              ? '上游逐条标注过'
              : 'upstream-labelled'
            : zh
              ? '机器从正文猜的，别当定论'
              : 'inferred from the text — not authoritative'}
        </span>
        <span>
          {zh
            ? '以上内容不构成法律意见，正式判断请以许可证原文为准。'
            : 'This is not legal advice — for a real decision, read the license text.'}
        </span>
      </div>
    </div>
  );
}
