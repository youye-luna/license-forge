/**
 * 404 页。
 *
 * 这是全站**唯一**不用浅色主题的页面：全黑底、极简排版，让人一眼看出"走错地方了"，
 * 而不是误以为自己遇到了加载失败。底色用站点色板里的 `ink-950`（#0b0f14，近黑）
 * 而非纯黑，这样它仍属于同一套设计，不引入一个新的黑。
 *
 * 静态导出时它产出 `out/404.html`，由托管平台（IIS / GitHub Pages / 静态服务器）
 * 对未知路径直接返回。因此这里**不依赖任何客户端 JS**——纯静态也要能正常显示，
 * 否则用户在"页面不存在"时看到的会是一片空白。
 *
 * 截图那版没有返回入口，这里补了一个：404 是死胡同，总得给条路回去。
 * 特意做得安静（半透明、悬停下划线），不抢上面那组排版的注意力。
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-ink-950 px-6 text-white">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-9">
        <p className="text-[5.5rem] font-black italic leading-[0.8] tracking-tighter sm:text-[9rem]">
          404
        </p>
        <div className="text-center sm:text-left">
          <p className="text-2xl font-bold leading-snug sm:text-3xl">Page not found!</p>
          <p className="text-2xl font-bold leading-snug sm:text-3xl">未找到此页面！</p>
        </div>
      </div>

      <a
        href="./"
        className="rounded-full border border-white/25 px-4 py-2 text-sm text-white/70 transition hover:border-white/60 hover:text-white"
      >
        返回首页 · Back to home
      </a>
    </main>
  );
}
