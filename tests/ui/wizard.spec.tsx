import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Wizard from '../../src/components/Wizard.tsx';
import { QUESTIONS } from '../../src/lib/wizard.ts';

const first = QUESTIONS[0];

describe('Wizard（问卷第一步）', () => {
  it('首屏就说明接下来会发生什么，并渲染第一个问题与全部选项', () => {
    render(<Wizard lang="zh" onPick={vi.fn()} pickedId={null} onFinish={vi.fn()} />);
    // 用户打开网站看到的第一屏不能只是一个问题，还得说清流程
    expect(screen.getByText('从问卷开始')).toBeTruthy();
    expect(screen.getByText(first.title.zh)).toBeTruthy();
    for (const option of first.options) {
      expect(screen.getByText(option.label.zh)).toBeTruthy();
    }
  });

  it('点选项后该项标记为已选，并自动进入下一题', () => {
    vi.useFakeTimers();
    try {
      render(<Wizard lang="zh" onPick={vi.fn()} pickedId={null} onFinish={vi.fn()} />);
      const button = screen.getByRole('button', { name: first.options[0].label.zh });
      fireEvent.click(button);
      expect(button.getAttribute('aria-pressed')).toBe('true');
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByText(QUESTIONS[1].title.zh)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('跳过问卷时回调 skipped=true（熟手与新手走不同的默认值）', () => {
    const onFinish = vi.fn();
    render(<Wizard lang="zh" onPick={vi.fn()} pickedId={null} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: /跳过问卷/ }));
    expect(onFinish).toHaveBeenCalledWith(true);
  });

  it('必答项没答完时，主出口按钮不可点', () => {
    render(<Wizard lang="zh" onPick={vi.fn()} pickedId={null} onFinish={vi.fn()} />);
    const go = screen.getByRole('button', { name: /去选择与对比挑定/ }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
  });

  it('英文界面用同一组件渲染英文文案', () => {
    render(<Wizard lang="en" onPick={vi.fn()} pickedId={null} onFinish={vi.fn()} />);
    expect(screen.getByText(first.title.en)).toBeTruthy();
  });
});
