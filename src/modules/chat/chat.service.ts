import { Injectable, Logger } from '@nestjs/common';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  type: 'text' | 'image' | 'system';
  timestamp: Date;
  readBy: string[];
}

export interface ChatRoom {
  id: string;
  orderId?: string;
  participants: string[];
  messages: ChatMessage[];
  lastActivity: Date;
  unreadCount: Map<string, number>;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private rooms: Map<string, ChatRoom> = new Map();

  createRoom(orderId: string, participants: string[]): string {
    const roomId = `chat_${orderId}_${Date.now()}`;
    this.rooms.set(roomId, {
      id: roomId,
      orderId,
      participants,
      messages: [],
      lastActivity: new Date(),
      unreadCount: new Map(),
    });

    this.addSystemMessage(
      roomId,
      'Chat started for order support',
    );

    return roomId;
  }

  getOrCreateRoom(orderId: string, participants: string[]): string {
    for (const [id, room] of this.rooms) {
      if (
        room.orderId === orderId &&
        participants.every((p) => room.participants.includes(p))
      ) {
        return id;
      }
    }
    return this.createRoom(orderId, participants);
  }

  addMessage(
    roomId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp' | 'readBy'>,
  ): ChatMessage | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.warn(`Room ${roomId} not found`);
      return null;
    }

    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      readBy: [message.senderId],
    };

    room.messages.push(newMessage);
    room.lastActivity = new Date();

    for (const participant of room.participants) {
      if (participant !== message.senderId) {
        room.unreadCount.set(
          participant,
          (room.unreadCount.get(participant) || 0) + 1,
        );
      }
    }

    return newMessage;
  }

  addSystemMessage(roomId: string, content: string): ChatMessage | null {
    return this.addMessage(roomId, {
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      content,
      type: 'system',
    });
  }

  getRoomMessages(roomId: string, limit: number = 50): ChatMessage[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return room.messages.slice(-limit);
  }

  getRoom(roomId: string): ChatRoom | null {
    return this.rooms.get(roomId) || null;
  }

  getUserRooms(userId: string): ChatRoom[] {
    const userRooms: ChatRoom[] = [];
    for (const room of this.rooms.values()) {
      if (room.participants.includes(userId)) {
        userRooms.push(room);
      }
    }
    return userRooms.sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
    );
  }

  markAsRead(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.unreadCount.set(userId, 0);
      for (const message of room.messages) {
        if (!message.readBy.includes(userId)) {
          message.readBy.push(userId);
        }
      }
    }
  }

  getUnreadCount(roomId: string, userId: string): number {
    const room = this.rooms.get(roomId);
    return room?.unreadCount.get(userId) || 0;
  }

  getTotalUnreadCount(userId: string): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      if (room.participants.includes(userId)) {
        total += room.unreadCount.get(userId) || 0;
      }
    }
    return total;
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  getRoomParticipants(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    return room?.participants || [];
  }
}
