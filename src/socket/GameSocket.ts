import type { ClientCommand, Envelope } from '../types/protocol';
import { gameSocketUrl } from '../config';

type Handler = (type: string, data: unknown) => void;
type StatusHandler = (status: SocketStatus) => void;
type RefusalHandler = (reason: string) => void;

export type SocketStatus = 'connecting' | 'open' | 'closed';

const MAX_QUEUED_FRAMES = 40;

/**
 * Thin, typed WebSocket wrapper: one connection per tab, JSON frames, automatic reconnect with
 * backoff, and an outbound queue so commands sent while reconnecting are not silently dropped.
 *
 * <p>Identity rides in the handshake query string, because a browser cannot attach an Authorization
 * header to a WebSocket upgrade. The token is therefore read through a provider on every attempt
 * rather than captured once, so a reconnect after a token refresh still authenticates.
 *
 * <p>Opening the socket is not the same as being admitted. The server may complete the upgrade and
 * then drop the connection — over the per-account socket cap, for instance — so `welcome` is the only
 * proof the player is really in. After repeated open-then-drop the wrapper stops retrying instead of
 * hammering a server that has already said no.
 */
export class GameSocket {
  private ws: WebSocket | null = null;
  private readonly baseUrl: string;
  private onMessage: Handler = () => {};
  private onStatus: StatusHandler = () => {};
  private onRefusal: RefusalHandler = () => {};
  private queue: string[] = [];
  private attempts = 0;
  private manualClose = false;
  private tokenProvider: () => string | null = () => null;
  /** True once the server has admitted this connection with a welcome. */
  private admitted = false;
  private refusals = 0;

  constructor(url?: string) {
    this.baseUrl = url ?? gameSocketUrl();
  }

  connect(tokenProvider: () => string | null): void {
    this.tokenProvider = tokenProvider;
    this.manualClose = false;
    this.admitted = false;
    this.refusals = 0;
    this.open();
  }

  private open(): void {
    const token = this.tokenProvider();
    if (!token) {
      // Nothing to authenticate with; retrying would just hammer the server with 401s.
      this.onStatus('closed');
      return;
    }

    this.onStatus('connecting');
    const ws = new WebSocket(`${this.baseUrl}?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.onStatus('open');
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
        if (parsed.type === 'welcome') {
          this.admitted = true;
          this.refusals = 0;
        }
        this.onMessage(parsed.type, parsed.data);
      }
    };

    ws.onclose = () => {
      this.ws = null;
      this.onStatus('closed');
      if (this.manualClose) {
        return;
      }
      if (!this.admitted) {
        // Opened but never welcomed: the upgrade was accepted and the server then refused the
        // player, most likely because the account is at its socket cap. Retrying on the normal
        // backoff would never succeed, so give up after a couple of attempts.
        this.refusals += 1;
        if (this.refusals >= 2) {
          this.onRefusal('socket refused — this account already has too many live connections');
          return;
        }
      }
      if (!this.tokenProvider()) {
        return;
      }
      this.attempts += 1;
      const delay = Math.min(8000, 400 * 2 ** Math.min(this.attempts, 4));
      window.setTimeout(() => this.open(), delay);
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
      // A socket that never comes back must not grow this without bound.
      if (this.queue.length < MAX_QUEUED_FRAMES) {
        this.queue.push(frame);
      }
    }
  }

  private raw(frame: string): void {
    try {
      this.ws?.send(frame);
    } catch {
      this.queue.push(frame);
    }
  }

  setHandlers(onMessage: Handler, onStatus: StatusHandler, onRefusal?: RefusalHandler): void {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.onRefusal = onRefusal ?? (() => {});
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