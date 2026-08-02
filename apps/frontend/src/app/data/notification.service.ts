import { Injectable } from '@angular/core';

// A lesson can take a minute or two to generate, so we let the learner walk away
// and ping them when it lands. This is the foreground path (tab open or
// backgrounded on desktop/Android); true "phone locked" delivery would need Web
// Push and a server-side subscription, which is a later step.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private get supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  // Ask once, at a moment the learner has just acted (starting a generation), so
  // the prompt has context. A denied or dismissed permission is fine — we simply
  // never notify.
  async ensurePermission(): Promise<void> {
    if (!this.supported || Notification.permission !== 'default') return;
    try {
      await Notification.requestPermission();
    } catch {
      /* Safari <16 rejects the promiseless form; nothing to do. */
    }
  }

  lessonReady(title: string): void {
    // Only surface it when the tab isn't already in front of them — pinging a
    // tab they're watching is noise.
    if (!this.supported || Notification.permission !== 'granted' || !document.hidden) return;
    try {
      const notification = new Notification('Your lesson is ready', {
        body: title,
        tag: 'pocket-teach-lesson',
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Android Chrome forbids the direct Notification constructor (it wants the
      // service worker's showNotification); skip rather than reject the caller.
    }
  }
}
