import WebSocket from 'ws';

interface NewsData {
  // Define news data structure later
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

  public sendMessage(data: NewsData): void {
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
