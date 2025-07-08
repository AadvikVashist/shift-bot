import WebSocket from 'ws';
import { WebSocketSession } from './ws-session';
import { v4 as uuidv4 } from 'uuid';
import { PortableTicket } from '../types/ticket';
import supabaseService from '../helpers/supabase/client';
import { toPortableTicket } from '../helpers/ticketItem';
import { verifyToken } from '../helpers/auth/verifier';
import { Logger } from '../helpers/logger';

interface TicketData {
  type: WebSocketMessageType;
  data: PortableTicket[] | PortableTicket;
}

export enum WebSocketMessageType {
  BASELINE = 'baseline',
  NEW_ITEM = 'new_item',
  PING = 'ping',
  ERROR = 'error',
  CONNECTION_CLOSED = 'connection-closed',
  AUTH = 'auth',
}

const SESSION_TIMEOUT_MS = 30000; // 30 seconds
const CLEANUP_INTERVAL_MS = 15000; // 15 seconds

export class WebSocketServer {
  private server: WebSocket.Server;
  private sessions: Map<string, WebSocketSession>;
  private cleanupInterval: NodeJS.Timeout | null;
  private logger: Logger;

  private static instance: WebSocketServer | undefined;

  public static getInstance(server?: any): WebSocketServer | undefined {
    if (!WebSocketServer.instance && server) {
      WebSocketServer.instance = new WebSocketServer(server);
    }
    return WebSocketServer.instance;
  }

  constructor(httpServer: any) {
    this.server = new WebSocket.Server({ server: httpServer });
    this.sessions = new Map();
    this.cleanupInterval = null;
    this.logger = Logger.create('WebSocketServer');
    this.initialize();
  }

  private initialize(): void {
    this.server.on('connection', this.handleConnection.bind(this));
    this.server.on('close', this.handleClose.bind(this));
    this.startSessionCleanup();
  }

  private handleConnection(ws: WebSocket): void {
    const sessionId = this.generateSessionId();
    const session = new WebSocketSession(ws, sessionId);
    this.sessions.set(sessionId, session);

    ws.on('message', (message: string) => {
      this.handleMessage(session, message);
    });
  }

  private generateSessionId(): string {
    return uuidv4();
  }

  private handleMessage(session: WebSocketSession, message: string): void {
    const parsed = JSON.parse(message);
    this.logger.debug('Received message', parsed);

    switch (parsed.type) {
      case WebSocketMessageType.PING:
        this.handlePing(session);
        break;
      case WebSocketMessageType.AUTH:
        this.handleAuth(session, parsed.data);
        break;
      default:
        session.sendMessage({
          type: WebSocketMessageType.ERROR,
          data: {
            message: 'Invalid message type',
          },
        });
    }
  }

  private sendFailedAuth(session: WebSocketSession): void {
    this.logger.info('User authentication failed');
    session.sendMessage({
      type: WebSocketMessageType.AUTH,
      data: {
        success: false,
        error: 'Invalid access token',
      },
    });
  }

  private async handleAuth(
    session: WebSocketSession,
    data: any,
  ): Promise<void> {
    const accessToken = data.token;
    try {
      const { userId } = await verifyToken(accessToken);
      if (!userId) {
        this.sendFailedAuth(session);
        return;
      }
      session.setIsAuthenticated(true);
      session.sendMessage({
        type: WebSocketMessageType.AUTH,
        data: {
          success: true,
        },
      });
      this.logger.info('User authenticated', { userId });

      await this.fetchAndSendLatestTickets();
    } catch (error) {
      this.logger.error('Failed to handle auth', error);
      session.sendMessage({
        type: WebSocketMessageType.AUTH,
        data: {
          success: false,
          error: 'Invalid access token',
        },
      });
    }
  }

  private handlePing(session: WebSocketSession): void {
    session.updateLastPing();
    session.sendMessage({
      type: WebSocketMessageType.PING,
      data: {
        success: true,
      },
    });
  }

  private handleClose(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public broadcastTickets(tickets: PortableTicket | PortableTicket[]): void {
    let payload: TicketData;
    if (Array.isArray(tickets)) {
      payload = {
        type: WebSocketMessageType.BASELINE,
        data: tickets,
      };
    } else {
      payload = {
        type: WebSocketMessageType.NEW_ITEM,
        data: tickets,
      };
    }

    for (const session of this.sessions.values()) {
      if (session.isAuthenticated) {
        session.sendMessage(payload);
      }
    }
  }

  private startSessionCleanup(): void {
    this.cleanupInterval = setInterval(
      () => this.wsSessionCleanup(),
      CLEANUP_INTERVAL_MS,
    );
  }

  private wsSessionCleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      const lastPing = session.getLastPing();
      if (now - lastPing > SESSION_TIMEOUT_MS) {
        session.close();
        this.sessions.delete(sessionId);
      }
    }
  }

  private async fetchAndSendLatestTickets(): Promise<void> {
    const { data: rows } = await supabaseService
      .from('tickets')
      .select('id, status, platform, thread_id, last_activity_at')
      .order('last_activity_at', { ascending: false })
      .limit(20);

    const portable = (rows ?? []).map(toPortableTicket);
    this.broadcastTickets(portable);
  }

  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    for (const session of this.sessions.values()) {
      session.close();
    }
    this.sessions.clear();
    this.server.close();
  }
}

/**
 * Initialise the singleton WebSocketServer instance.
 * Must be called once with the HTTP server before any `getWebSocketServer` calls.
 */
export function initWebSocketServer(httpServer: any): WebSocketServer {
  const instance = WebSocketServer.getInstance(httpServer);
  if (!instance) {
    throw new Error('Failed to initialise WebSocketServer');
  }
  return instance;
}

/**
 * Retrieve the already-initialised WebSocketServer instance.
 * Throws if called before `initWebSocketServer`.
 */
export function getWebSocketServer(): WebSocketServer {
  const instance = WebSocketServer.getInstance();
  if (!instance) {
    throw new Error('WebSocketServer has not been initialised');
  }
  return instance;
}
