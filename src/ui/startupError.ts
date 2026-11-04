import { bi, setText } from '../i18n/text';

/** Keep a failed module load visible instead of navigating into an empty app. */
export function showStartupError(error: unknown) {
  console.error('Hamilton startup failed', error);
  const app = document.querySelector<HTMLElement>('#app')!;
  app.inert = false;
  const panel = document.createElement('section');
  panel.className = 'startup-error'; panel.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  setText(title, bi('旅程暂时未能启动', 'The journey could not start'));
  const message = document.createElement('p');
  setText(message, bi('开场加载遇到了问题。请返回标题页重试。', 'There was a problem loading the opening. Return to the title screen to try again.'));
  const retry = document.createElement('a');
  const url = new URL(location.href); url.searchParams.delete('story'); url.searchParams.delete('demo');
  retry.href = url.href;
  setText(retry, bi('返回标题页重试', 'Return to title and retry'));
  panel.append(title, message, retry); app.replaceChildren(panel);
}
