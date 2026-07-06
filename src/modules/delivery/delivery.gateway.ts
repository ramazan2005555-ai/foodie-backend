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
import { Logger } from '@nestjs/common';
import { Delivery } from './delivery.entity';

@WebSocketGateway({
  namespace: '/delivery',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class DeliveryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DeliveryGateway.name);
  private courierSockets: Map<string, string> = new Map();

  handleConnection(client: Socket): void {
    const courierId = client.handshake.query.courierId as string;
    const userId = client.handshake.query.userId as string;

    if (courierId) {
      this.courierSockets.set(courierId, client.id);
      client.join(`courier:${courierId}`);
    }

    if (userId) {
      client.join(`user:${userId}`);
    }

    this.logger.log(
      `Delivery client connected: ${client.id} (courier: ${courierId}, user: ${userId})`,
    );
  }

  handleDisconnect(client: Socket): void {
    for (const [courierId, socketId] of this.courierSockets.entries()) {
      if (socketId === client.id) {
        this.courierSockets.delete(courierId);
        break;
      }
    }
    this.logger.log(`Delivery client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinDelivery')
  handleJoinDelivery(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deliveryId: string },
  ): void {
    client.join(`delivery:${data.deliveryId}`);
    this.logger.log(`Client ${client.id} joined delivery ${data.deliveryId}`);
  }

  @SubscribeMessage('leaveDelivery')
  handleLeaveDelivery(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deliveryId: string },
  ): void {
    client.leave(`delivery:${data.deliveryId}`);
  }

  @SubscribeMessage('updateLocation')
  handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deliveryId: string; lat: number; lng: number },
  ): void {
    this.server
      .to(`delivery:${data.deliveryId}`)
      .emit('courierLocation', {
        deliveryId: data.deliveryId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      });
  }

  @SubscribeMessage('courierOnline')
  handleCourierOnline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { courierId: string; lat: number; lng: number },
  ): void {
    client.join('available-couriers');
    this.server.to('available-couriers').emit('courierOnline', {
      courierId: data.courierId,
      lat: data.lat,
      lng: data.lng,
      timestamp: new Date().toISOString(),
    });
  }

  sendDeliveryUpdate(delivery: Delivery): void {
    this.server
      .to(`delivery:${delivery.id}`)
      .emit('deliveryUpdate', delivery);

    if (delivery.courierId) {
      this.server
        .to(`courier:${delivery.courierId}`)
        .emit('deliveryAssigned', delivery);
    }
  }

  sendCourierLocation(delivery: Delivery): void {
    this.server
      .to(`delivery:${delivery.id}`)
      .emit('courierLocationUpdate', {
        deliveryId: delivery.id,
        lat: delivery.currentLat,
        lng: delivery.currentLng,
        timestamp: new Date().toISOString(),
      });
  }

  sendNewDeliveryAvailable(delivery: Delivery): void {
    this.server
      .to('available-couriers')
      .emit('newDeliveryAvailable', delivery);
  }
}
