import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers: Map<string, string[]> = new Map();

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket): void {
    const userId = client.handshake.query.userId as string;
    const role = client.handshake.query.role as string;

    if (userId) {
      const existing = this.connectedUsers.get(userId) || [];
      existing.push(client.id);
      this.connectedUsers.set(userId, existing);
      client.join(`user:${userId}`);
      this.logger.log(`Chat client connected: ${client.id} (user: ${userId}, role: ${role})`);
    }
  }

  handleDisconnect(client: Socket): void {
    for (const [userId, sockets] of this.connectedUsers.entries()) {
      const filtered = sockets.filter((s) => s !== client.id);
      if (filtered.length === 0) {
        this.connectedUsers.delete(userId);
      } else {
        this.connectedUsers.set(userId, filtered);
      }
    }
    this.logger.log(`Chat client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): void {
    client.join(data.roomId);
    this.logger.log(`Client ${client.id} joined chat room ${data.roomId}`);

    const messages = this.chatService.getRoomMessages(data.roomId);
    client.emit('roomMessages', messages);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): void {
    client.leave(data.roomId);
  }

  @SubscribeMessage('sendMessage')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      content: string;
      type?: 'text' | 'image';
      senderName: string;
      senderRole: string;
    },
  ): void {
    const userId = client.handshake.query.userId as string;

    const message = this.chatService.addMessage(data.roomId, {
      senderId: userId,
      senderName: data.senderName,
      senderRole: data.senderRole,
      content: data.content,
      type: data.type || 'text',
    });

    if (message) {
      this.server.to(data.roomId).emit('newMessage', message);
      this.server.to(data.roomId).emit('typing', { userId, isTyping: false });
    }
  }

  @SubscribeMessage('createRoom')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; participants: string[] },
  ): void {
    const roomId = this.chatService.createRoom(
      data.orderId,
      data.participants,
    );

    client.join(roomId);
    client.emit('roomCreated', {
      roomId,
      orderId: data.orderId,
      participants: data.participants,
    });

    for (const participant of data.participants) {
      this.server.to(`user:${participant}`).emit('newRoom', {
        roomId,
        orderId: data.orderId,
      });
    }
  }

  @SubscribeMessage('markRead')
  handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): void {
    const userId = client.handshake.query.userId as string;
    this.chatService.markAsRead(data.roomId, userId);
    this.server.to(data.roomId).emit('readReceipt', {
      userId,
      roomId: data.roomId,
    });
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isTyping: boolean },
  ): void {
    const userId = client.handshake.query.userId as string;
    client.to(data.roomId).emit('typing', {
      userId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('getRooms')
  handleGetRooms(@ConnectedSocket() client: Socket): void {
    const userId = client.handshake.query.userId as string;
    const rooms = this.chatService.getUserRooms(userId);
    client.emit('userRooms', rooms);
  }

  @SubscribeMessage('getUnreadCount')
  handleGetUnreadCount(@ConnectedSocket() client: Socket): void {
    const userId = client.handshake.query.userId as string;
    const totalUnread = this.chatService.getTotalUnreadCount(userId);
    client.emit('totalUnreadCount', { count: totalUnread });
  }

  @SubscribeMessage('getRoomMessages')
  handleGetRoomMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; limit?: number },
  ): void {
    const messages = this.chatService.getRoomMessages(
      data.roomId,
      data.limit || 50,
    );
    client.emit('roomMessages', messages);
  }
}
