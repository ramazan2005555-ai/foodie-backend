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
import { Order } from './order.entity';

@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class OrderGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrderGateway.name);
  private userSockets: Map<string, string[]> = new Map();

  handleConnection(client: Socket): void {
    const userId = client.handshake.query.userId as string;
    const role = client.handshake.query.role as string;

    if (userId) {
      const existing = this.userSockets.get(userId) || [];
      existing.push(client.id);
      this.userSockets.set(userId, existing);
    }

    if (role === 'courier') {
      client.join('couriers');
    }

    if (role === 'owner' || role === 'admin') {
      client.join('restaurant-owners');
    }

    this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
  }

  handleDisconnect(client: Socket): void {
    for (const [userId, sockets] of this.userSockets.entries()) {
      const filtered = sockets.filter((s) => s !== client.id);
      if (filtered.length === 0) {
        this.userSockets.delete(userId);
      } else {
        this.userSockets.set(userId, filtered);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinOrder')
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ): void {
    client.join(`order:${data.orderId}`);
    this.logger.log(`Client ${client.id} joined order ${data.orderId}`);
  }

  @SubscribeMessage('leaveOrder')
  handleLeaveOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ): void {
    client.leave(`order:${data.orderId}`);
  }

  @SubscribeMessage('joinRestaurant')
  handleJoinRestaurant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { restaurantId: string },
  ): void {
    client.join(`restaurant:${data.restaurantId}`);
  }

  @SubscribeMessage('courierLocation')
  handleCourierLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lat: number; lng: number; deliveryId: string },
  ): void {
    this.server
      .to(`delivery:${data.deliveryId}`)
      .emit('courierLocationUpdate', {
        deliveryId: data.deliveryId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      });
  }

  sendOrderUpdate(order: Order): void {
    this.server.to(`order:${order.id}`).emit('orderUpdate', {
      orderId: order.id,
      status: order.status,
      order,
    });

    this.server.to(`restaurant:${order.restaurantId}`).emit('newOrder', {
      orderId: order.id,
      status: order.status,
      orderNumber: order.orderNumber,
      order,
    });

    const userSockets = this.userSockets.get(order.userId);
    if (userSockets) {
      this.server
        .to(userSockets)
        .emit('orderStatusChanged', {
          orderId: order.id,
          status: order.status,
          orderNumber: order.orderNumber,
        });
    }

    this.server.to('couriers').emit('orderAvailable', {
      orderId: order.id,
      restaurantId: order.restaurantId,
      deliveryAddress: order.deliveryAddress,
      total: order.total,
    });
  }

  sendNewMessage(data: {
    orderId: string;
    message: string;
    sender: string;
    timestamp: Date;
  }): void {
    this.server
      .to(`order:${data.orderId}`)
      .emit('newMessage', data);
  }
}
