import WebSocket from 'ws';
import { WebSocketSession } from './ws-session';
import { v4 as uuidv4 } from 'uuid';
import { PortableNewsItem } from '../types/news';
import supabaseService from '../helpers/supabase/client';
import { enrichNewsRow } from '../helpers/newsItem';
import { verifyToken } from '../helpers/auth/verifier';
import { Logger } from '../helpers/logger';

interface NewsData {
  type: WebSocketMessageType;
  data: PortableNewsItem[] | PortableNewsItem;
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

  private static instance: WebSocketServer;

  public static getInstance(server?: any): WebSocketServer {
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

      await this.fetchAndSendLatestNews();
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

  public broadcastNews(newsItems: PortableNewsItem | PortableNewsItem[]): void {
    let newsData: NewsData;
    if (Array.isArray(newsItems)) {
      newsData = {
        type: WebSocketMessageType.BASELINE,
        data: newsItems,
      };
    } else {
      newsData = {
        type: WebSocketMessageType.NEW_ITEM,
        data: newsItems,
      };
    }

    for (const session of this.sessions.values()) {
      if (session.isAuthenticated) {
        session.sendMessage(newsData);
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

  private async fetchAndSendLatestNews(): Promise<void> {
    const { data: items } = await supabaseService
      .from('news_items')
      .select(
        '*, news_sources!inner(id, platform, title, source_uid, handle, source_name)',
      )
      .order('created_at', { ascending: false })
      .limit(20);

    const enriched = (items ?? []).map(enrichNewsRow);
    this.broadcastNews(enriched);
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

export const wsServer = WebSocketServer.getInstance();
