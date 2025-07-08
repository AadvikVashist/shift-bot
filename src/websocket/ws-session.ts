import WebSocket from 'ws';

/**
 * TicketMessage – payloads exchanged over WebSocket.
 * Defined here to avoid circular import with ws-server.ts.
 * Structure mirrors the object assembled in ws-server:
 *   { type: 'baseline' | 'new_item' | 'ping' | 'error' | 'auth', data: any }
 */
interface TicketMessage {
  type: string;
  data: unknown;
}

export class WebSocketSession {
  private ws: WebSocket;
  private id: string;
  private lastPing: number;
  public isAuthenticated: boolean;

  constructor(ws: WebSocket, id: string) {
    this.ws = ws;
    this.id = id;
    this.lastPing = Date.now();
    this.isAuthenticated = false;
  }

  public getId(): string {
    return this.id;
  }

  public updateLastPing(): void {
    this.lastPing = Date.now();
  }

  public getLastPing(): number {
    return this.lastPing;
  }

  public sendMessage(data: TicketMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public close(): void {
    this.ws.close();
  }

  public setIsAuthenticated(isAuthenticated: boolean): void {
    this.isAuthenticated = isAuthenticated;
  }
}
