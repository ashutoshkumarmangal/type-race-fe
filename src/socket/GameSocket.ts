import type { ClientCommand, Envelope } from '../types/protocol';

type Handler = (type: string, data: unknown) => void;
type StatusHandler = (status: SocketStatus) => void;

export type SocketStatus = 'connecting' | 'open' | 'closed';

/**
 * Thin, typed WebSocket wrapper: one connection per tab, JSON frames, automatic reconnect with
 * backoff, and an outbound queue so commands sent while reconnecting are not silently dropped.
 */
export class GameSocket {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private onMessage: Handler = () => {};
  private onStatus: StatusHandler = () => {};
  private queue: string[] = [];
  private attempts = 0;
  private manualClose = false;
  private nickname = 'Racer';

  constructor(url?: string) {
    const fallback = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/game`;
    this.url = url ?? (import.meta.env.VITE_WS_URL as string | undefined) ?? fallback;
  }

  connect(nickname: string): void {
    this.nickname = nickname;
    this.manualClose = false;
    this.open();
  }

  private open(): void {
    this.onStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.onStatus('open');
      this.raw(JSON.stringify({ type: 'hello', nickname: this.nickname }));
      const pending = this.queue;
      this.queue = [];
      pending.forEach((frame) => this.raw(frame));
    };

    ws.onmessage = (event) => {
      let parsed: Envelope<unknown>;
      try {
        parsed = JSON.parse(event.data as string) as Envelope<unknown>;
      } catch {
        return;
      }
      if (parsed && typeof parsed.type === 'string') {
        this.onMessage(parsed.type, parsed.data);
      }
    };

    ws.onclose = () => {
      this.ws = null;
      this.onStatus('closed');
      if (!this.manualClose) {
        this.attempts += 1;
        const delay = Math.min(8000, 400 * 2 ** Math.min(this.attempts, 4));
        window.setTimeout(() => this.open(), delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  send(command: ClientCommand): void {
    const frame = JSON.stringify(command);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.raw(frame);
    } else {
      this.queue.push(frame);
    }
  }

  private raw(frame: string): void {
    try {
      this.ws?.send(frame);
    } catch {
      this.queue.push(frame);
    }
  }

  setHandlers(onMessage: Handler, onStatus: StatusHandler): void {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }

  get ready(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close(): void {
    this.manualClose = true;
    this.ws?.close();
    this.ws = null;
  }
}

export const gameSocket = new GameSocket();