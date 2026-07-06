import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createHash } from 'crypto';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { DataSource } from 'typeorm';
import { UserRole } from './common/guards/roles.guard';
import { RestaurantStatus } from './modules/restaurants/restaurant.entity';
import { CouponType, CouponStatus } from './modules/coupons/coupon.entity';

function hashPassword(pwd: string): string {
  return createHash('sha256').update(pwd).digest('hex');
}

async function seedDatabase(app) {
  const logger = new Logger('Seed');
  const ds = app.get(DataSource);
  const queryRunner = ds.createQueryRunner();
  const tables = await queryRunner.getTables();
  await queryRunner.release();

  if (tables.length === 0) {
    logger.log('No tables found, running synchronize...');
    await ds.synchronize();
  }

  const userRepo = ds.getRepository('User');
  const existing = await userRepo.count();
  if (existing > 0) {
    logger.log('Database already seeded');
    return;
  }

  logger.log('Seeding database...');

  const userData = [
    { name: 'Администратор', email: 'admin@foodie.app', password: hashPassword('password123'), phone: '+7 (999) 000-00-01', role: UserRole.ADMIN, isActive: true, isEmailVerified: true, isPremium: true, bonusPoints: 10000 },
    { name: 'Иван Петров', email: 'owner@foodie.app', password: hashPassword('password123'), phone: '+7 (999) 000-00-02', role: UserRole.OWNER, isActive: true, isEmailVerified: true, isPremium: true, bonusPoints: 5000 },
    { name: 'Алексей Соколов', email: 'courier@foodie.app', password: hashPassword('password123'), phone: '+7 (999) 000-00-03', role: UserRole.COURIER, isActive: true, isEmailVerified: true, bonusPoints: 1200 },
    { name: 'Тестовый', email: '0', password: hashPassword('0'), phone: '+7 (000) 000-00-00', role: UserRole.USER, isActive: true, isEmailVerified: true, bonusPoints: 99999 },
    { name: 'Мария Иванова', email: 'user@foodie.app', password: hashPassword('password123'), phone: '+7 (999) 000-00-04', role: UserRole.USER, isActive: true, isEmailVerified: true, bonusPoints: 450 },
  ];

  const users = [];
  for (const u of userData) {
    const saved = await userRepo.save(userRepo.create(u));
    users.push(saved);
    logger.log(`User: ${saved.email}`);
  }

  const restaurantData = [
    { name: 'Итальянский Дворик', slug: 'italian-courtyard', description: 'Аутентичная итальянская кухня', rating: 4.8, deliveryTimeMin: 25, deliveryTimeMax: 45, deliveryCost: 249, minOrder: 500, address: 'ул. Большая Дмитровка, 12', lat: 55.7615, lng: 37.6168, categories: ['Итальянская', 'Пицца'], cuisines: ['italian', 'pizza'], status: RestaurantStatus.ACTIVE, isVerified: true, isActive: true, isFeatured: true, phone: '+7 (495) 123-45-67', email: 'info@italian.ru', ownerId: users[1].id },
    { name: 'Японский Сад', slug: 'japanese-garden', description: 'Традиционная японская кухня', rating: 4.9, deliveryTimeMin: 20, deliveryTimeMax: 40, deliveryCost: 299, minOrder: 800, address: 'Тверской бульвар, 7', lat: 55.7569, lng: 37.5982, categories: ['Японская', 'Суши'], cuisines: ['japanese', 'sushi'], status: RestaurantStatus.ACTIVE, isVerified: true, isActive: true, isFeatured: true, phone: '+7 (495) 234-56-78', email: 'info@japanese.ru', ownerId: users[1].id },
    { name: 'Бургер Хаус', slug: 'burger-house', description: 'Премиальные бургеры', rating: 4.6, deliveryTimeMin: 15, deliveryTimeMax: 30, deliveryCost: 199, minOrder: 400, address: 'Новый Арбат, 15', lat: 55.7532, lng: 37.5951, categories: ['Бургеры', 'Фастфуд'], cuisines: ['burgers', 'fastfood'], status: RestaurantStatus.ACTIVE, isVerified: true, isActive: true, isFeatured: true, phone: '+7 (495) 345-67-89', email: 'info@burger.ru', ownerId: users[1].id },
  ];

  const restaurantRepo = ds.getRepository('Restaurant');
  const restaurants = [];
  for (const r of restaurantData) {
    const saved = await restaurantRepo.save(restaurantRepo.create(r));
    restaurants.push(saved);
    logger.log(`Restaurant: ${saved.name}`);
  }

  const couponRepo = ds.getRepository('Coupon');
  const coupons = [
    { code: 'WELCOME20', type: CouponType.PERCENTAGE, value: 20, maxDiscount: 500, usageLimit: 10000, status: CouponStatus.ACTIVE, description: '20% на первый заказ', isFirstOrderOnly: true },
    { code: 'FREEDEL', type: CouponType.FREE_DELIVERY, value: 0, minOrder: 1500, usageLimit: 5000, status: CouponStatus.ACTIVE, description: 'Бесплатная доставка' },
    { code: 'BONUS100', type: CouponType.BONUS_POINTS, value: 100, minOrder: 800, usageLimit: 3000, status: CouponStatus.ACTIVE, description: '100 бонусов' },
  ];
  for (const c of coupons) {
    await couponRepo.save(couponRepo.create(c));
  }

  logger.log(`Seeded: ${users.length} users, ${restaurants.length} restaurants, ${coupons.length} coupons`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');

  app.use(helmet());
  app.use(compression());
  app.use(morgan('combined'));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Premium Food Delivery API')
    .setDescription('API for premium food delivery application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await seedDatabase(app);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Application running on port ${port}`);
}

bootstrap();
