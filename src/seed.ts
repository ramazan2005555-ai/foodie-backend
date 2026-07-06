import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './modules/users/user.entity';
import { UserRole } from './common/guards/roles.guard';
import { Restaurant, RestaurantStatus } from './modules/restaurants/restaurant.entity';
import { MenuCategory } from './modules/menu/menu-category.entity';
import { MenuItem } from './modules/menu/menu-item.entity';
import { Banner } from './modules/banners/banner.entity';
import { Coupon, CouponType, CouponStatus } from './modules/coupons/coupon.entity';

async function seed() {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const dataSource = new DataSource(
    dbType === 'postgres' || process.env.DB_HOST
      ? {
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'premium_food_delivery',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
          logging: false,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        }
      : {
          type: 'sqlite',
          database: './data/food_delivery.db',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
          logging: false,
        },
  );

  await dataSource.initialize();
  console.log('Database connected');

  const userRepo = dataSource.getRepository(User);
  const restaurantRepo = dataSource.getRepository(Restaurant);
  const categoryRepo = dataSource.getRepository(MenuCategory);
  const itemRepo = dataSource.getRepository(MenuItem);
  const bannerRepo = dataSource.getRepository(Banner);
  const couponRepo = dataSource.getRepository(Coupon);

  const existingUsers = await userRepo.count();
  if (existingUsers > 0) {
    console.log('Seeding already done, clearing first...');
    if (dbType === 'sqlite') {
      await dataSource.query('PRAGMA foreign_keys = OFF');
    }
    await itemRepo.clear();
    await categoryRepo.clear();
    await bannerRepo.clear();
    await couponRepo.clear();
    await restaurantRepo.clear();
    await userRepo.clear();
    if (dbType === 'sqlite') {
      await dataSource.query('PRAGMA foreign_keys = ON');
    }
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  const adminUser = userRepo.create({
    name: 'Администратор',
    email: 'admin@foodie.app',
    password: passwordHash,
    phone: '+7 (999) 000-00-01',
    role: UserRole.ADMIN,
    isActive: true,
    isEmailVerified: true,
    isPremium: true,
    bonusPoints: 10000,
    addresses: [
      { id: 'addr-1', label: 'Офис', street: 'Тверская ул.', building: '10', lat: 55.7658, lng: 37.6063, isDefault: true },
    ],
  });
  await userRepo.save(adminUser);
  console.log(`Admin created: ${adminUser.email}`);

  const ownerUser = userRepo.create({
    name: 'Иван Петров',
    email: 'owner@foodie.app',
    password: passwordHash,
    phone: '+7 (999) 000-00-02',
    role: UserRole.OWNER,
    isActive: true,
    isEmailVerified: true,
    isPremium: true,
    bonusPoints: 5000,
    addresses: [
      { id: 'addr-2', label: 'Дом', street: 'Арбат ул.', building: '25', lat: 55.7517, lng: 37.5904, isDefault: true },
    ],
  });
  await userRepo.save(ownerUser);
  console.log(`Owner created: ${ownerUser.email}`);

  const courierUser = userRepo.create({
    name: 'Алексей Соколов',
    email: 'courier@foodie.app',
    password: passwordHash,
    phone: '+7 (999) 000-00-03',
    role: UserRole.COURIER,
    isActive: true,
    isEmailVerified: true,
    bonusPoints: 1200,
    addresses: [
      { id: 'addr-3', label: 'Дом', street: 'Ленинградский пр-т', building: '15', lat: 55.7911, lng: 37.5401, isDefault: true },
    ],
  });
  await userRepo.save(courierUser);
  console.log(`Courier created: ${courierUser.email}`);

  const testUser = userRepo.create({
    name: 'Тестовый',
    email: '0',
    password: await bcrypt.hash('0', 10),
    phone: '+7 (000) 000-00-00',
    role: UserRole.USER,
    isActive: true,
    isEmailVerified: true,
    isPremium: false,
    bonusPoints: 99999,
    addresses: [
      { id: 'addr-test', label: 'Тест', street: 'ул. Тестовая', building: '1', lat: 55.7558, lng: 37.6176, isDefault: true },
    ],
  });
  await userRepo.save(testUser);
  console.log(`Test user created: ${testUser.email}`);

  const regularUser = userRepo.create({
    name: 'Мария Иванова',
    email: 'user@foodie.app',
    password: passwordHash,
    phone: '+7 (999) 000-00-04',
    role: UserRole.USER,
    isActive: true,
    isEmailVerified: true,
    isPremium: false,
    bonusPoints: 450,
    addresses: [
      { id: 'addr-4', label: 'Дом', street: 'Пятницкая ул.', building: '42', lat: 55.7425, lng: 37.6264, isDefault: true },
      { id: 'addr-5', label: 'Работа', street: 'Кутузовский пр-т', building: '36', lat: 55.7411, lng: 37.5378, isDefault: false },
    ],
  });
  await userRepo.save(regularUser);
  console.log(`User created: ${regularUser.email}`);

  const restaurantsData = [
    {
      name: 'Итальянский Дворик',
      slug: 'italian-courtyard',
      description: 'Аутентичная итальянская кухня от шеф-повара из Милана. Домашняя паста, пицца в дровяной печи, свежайшие морепродукты.',
      logo: '/images/restaurants/italian-logo.png',
      cover: '/images/restaurants/italian-cover.jpg',
      rating: 4.8,
      reviewsCount: 1247,
      deliveryTimeMin: 25,
      deliveryTimeMax: 45,
      deliveryCost: 249,
      minOrder: 500,
      workingHours: {
        monday: { open: '10:00', close: '23:00', isOpen: true },
        tuesday: { open: '10:00', close: '23:00', isOpen: true },
        wednesday: { open: '10:00', close: '23:00', isOpen: true },
        thursday: { open: '10:00', close: '23:00', isOpen: true },
        friday: { open: '10:00', close: '00:00', isOpen: true },
        saturday: { open: '11:00', close: '00:00', isOpen: true },
        sunday: { open: '12:00', close: '22:00', isOpen: true },
      },
      address: 'ул. Большая Дмитровка, 12',
      lat: 55.7615, lng: 37.6168,
      categories: ['Итальянская', 'Пицца', 'Паста'],
      cuisines: ['italian', 'pizza', 'pasta'],
      status: RestaurantStatus.ACTIVE,
      isVerified: true,
      isActive: true,
      isFeatured: true,
      commissionRate: 15,
      phone: '+7 (495) 123-45-67',
      website: '',
      email: 'info@italian-courtyard.ru',
      ownerId: ownerUser.id,
    },
    {
      name: 'Японский Сад',
      slug: 'japanese-garden',
      description: 'Традиционная японская кухня: суши, сашими, роллы и горячие блюда от шефа из Токио.',
      logo: '/images/restaurants/japanese-logo.png',
      cover: '/images/restaurants/japanese-cover.jpg',
      rating: 4.9,
      reviewsCount: 2341,
      deliveryTimeMin: 20,
      deliveryTimeMax: 40,
      deliveryCost: 299,
      minOrder: 800,
      workingHours: {
        monday: { open: '11:00', close: '22:30', isOpen: true },
        tuesday: { open: '11:00', close: '22:30', isOpen: true },
        wednesday: { open: '11:00', close: '22:30', isOpen: true },
        thursday: { open: '11:00', close: '22:30', isOpen: true },
        friday: { open: '11:00', close: '23:00', isOpen: true },
        saturday: { open: '12:00', close: '23:00', isOpen: true },
        sunday: { open: '12:00', close: '22:00', isOpen: true },
      },
      address: 'Тверской бульвар, 7',
      lat: 55.7569, lng: 37.5982,
      categories: ['Японская', 'Суши', 'Азиатская'],
      cuisines: ['japanese', 'sushi', 'asian'],
      status: RestaurantStatus.ACTIVE,
      isVerified: true,
      isActive: true,
      isFeatured: true,
      commissionRate: 18,
      phone: '+7 (495) 234-56-78',
      website: '',
      email: 'info@japanese-garden.ru',
      ownerId: ownerUser.id,
    },
    {
      name: 'Бургер Хаус',
      slug: 'burger-house',
      description: 'Премиальные бургеры из мраморной говядины, домашние соусы и хрустящий картофель.',
      logo: '/images/restaurants/burger-logo.png',
      cover: '/images/restaurants/burger-cover.jpg',
      rating: 4.6,
      reviewsCount: 3120,
      deliveryTimeMin: 15,
      deliveryTimeMax: 30,
      deliveryCost: 199,
      minOrder: 400,
      workingHours: {
        monday: { open: '10:00', close: '23:00', isOpen: true },
        tuesday: { open: '10:00', close: '23:00', isOpen: true },
        wednesday: { open: '10:00', close: '23:00', isOpen: true },
        thursday: { open: '10:00', close: '23:00', isOpen: true },
        friday: { open: '10:00', close: '02:00', isOpen: true },
        saturday: { open: '10:00', close: '02:00', isOpen: true },
        sunday: { open: '11:00', close: '23:00', isOpen: true },
      },
      address: 'Новый Арбат, 15',
      lat: 55.7532, lng: 37.5951,
      categories: ['Бургеры', 'Фастфуд', 'Американская'],
      cuisines: ['burgers', 'fastfood', 'american'],
      status: RestaurantStatus.ACTIVE,
      isVerified: true,
      isActive: true,
      isFeatured: true,
      commissionRate: 12,
      phone: '+7 (495) 345-67-89',
      website: '',
      email: 'info@burger-house.ru',
      ownerId: ownerUser.id,
    },
    {
      name: 'Вок Шоу',
      slug: 'wok-show',
      description: 'Азиатская кухня: WOK с лапшой и рисом, том-ям, спринг-роллы. Всё готовится при вас!',
      logo: '/images/restaurants/wok-logo.png',
      cover: '/images/restaurants/wok-cover.jpg',
      rating: 4.5,
      reviewsCount: 873,
      deliveryTimeMin: 20,
      deliveryTimeMax: 35,
      deliveryCost: 179,
      minOrder: 350,
      workingHours: {
        monday: { open: '11:00', close: '22:00', isOpen: true },
        tuesday: { open: '11:00', close: '22:00', isOpen: true },
        wednesday: { open: '11:00', close: '22:00', isOpen: true },
        thursday: { open: '11:00', close: '22:00', isOpen: true },
        friday: { open: '11:00', close: '23:00', isOpen: true },
        saturday: { open: '12:00', close: '23:00', isOpen: true },
        sunday: { open: '12:00', close: '22:00', isOpen: true },
      },
      address: 'ул. Мясницкая, 24',
      lat: 55.7623, lng: 37.6389,
      categories: ['Азиатская', 'WOK', 'Том-ям'],
      cuisines: ['asian', 'wok', 'thai'],
      status: RestaurantStatus.ACTIVE,
      isVerified: true,
      isActive: true,
      isFeatured: false,
      commissionRate: 10,
      phone: '+7 (495) 456-78-90',
      website: '',
      email: 'info@wok-show.ru',
      ownerId: ownerUser.id,
    },
    {
      name: 'Здоровое Меню',
      slug: 'healthy-menu',
      description: 'Правильное питание с доставкой: Кето, Low Carb, High Protein. Всё без сахара и ГМО.',
      logo: '/images/restaurants/healthy-logo.png',
      cover: '/images/restaurants/healthy-cover.jpg',
      rating: 4.7,
      reviewsCount: 562,
      deliveryTimeMin: 25,
      deliveryTimeMax: 40,
      deliveryCost: 249,
      minOrder: 600,
      workingHours: {
        monday: { open: '08:00', close: '22:00', isOpen: true },
        tuesday: { open: '08:00', close: '22:00', isOpen: true },
        wednesday: { open: '08:00', close: '22:00', isOpen: true },
        thursday: { open: '08:00', close: '22:00', isOpen: true },
        friday: { open: '08:00', close: '22:00', isOpen: true },
        saturday: { open: '09:00', close: '21:00', isOpen: true },
        sunday: { open: '09:00', close: '21:00', isOpen: true },
      },
      address: 'Чистопрудный бульвар, 8',
      lat: 55.7598, lng: 37.6458,
      categories: ['Здоровое', 'Фитнес', 'ПП'],
      cuisines: ['healthy', 'fitness', 'pp'],
      status: RestaurantStatus.ACTIVE,
      isVerified: true,
      isActive: true,
      isFeatured: true,
      commissionRate: 14,
      phone: '+7 (495) 567-89-01',
      website: '',
      email: 'info@healthy-menu.ru',
      ownerId: ownerUser.id,
    },
  ];

  const restaurants: Restaurant[] = [];
  for (const rData of restaurantsData) {
    const restaurant = restaurantRepo.create(rData);
    const saved = await restaurantRepo.save(restaurant);
    restaurants.push(saved);
    console.log(`Restaurant created: ${saved.name}`);
  }

  const menuData: { restaurantIndex: number; categoryName: string; sortOrder: number; items: { name: string; description: string; price: number; discountPrice: number; weight: number; weightUnit: string; calories: number; isPopular: boolean; estimatedPrepTime: number; dietaryTags: string[] }[] }[] = [
    {
      restaurantIndex: 0,
      categoryName: 'Пицца',
      sortOrder: 0,
      items: [
        { name: 'Маргарита', description: 'Свежие томаты, моцарелла, базилик', price: 450, discountPrice: 0, weight: 320, weightUnit: 'г', calories: 680, isPopular: true, estimatedPrepTime: 15, dietaryTags: ['vegetarian'] },
        { name: 'Пепперони', description: 'Пикантная пепперони, моцарелла, томатный соус', price: 520, discountPrice: 0, weight: 350, weightUnit: 'г', calories: 750, isPopular: true, estimatedPrepTime: 18, dietaryTags: [] },
        { name: 'Четыре Сыра', description: 'Моцарелла, горгонзола, пармезан, фета', price: 590, discountPrice: 0, weight: 340, weightUnit: 'г', calories: 820, isPopular: true, estimatedPrepTime: 18, dietaryTags: ['vegetarian'] },
        { name: 'Тоскана', description: 'Прошутто, руккола, пармезан, трюфельное масло', price: 690, discountPrice: 590, weight: 330, weightUnit: 'г', calories: 720, isPopular: false, estimatedPrepTime: 20, dietaryTags: [] },
      ],
    },
    {
      restaurantIndex: 0,
      categoryName: 'Паста',
      sortOrder: 1,
      items: [
        { name: 'Карбонара', description: 'Спагетти, гуанчиале, яйцо, пармезан', price: 490, discountPrice: 0, weight: 280, weightUnit: 'г', calories: 650, isPopular: true, estimatedPrepTime: 15, dietaryTags: [] },
        { name: 'Болоньезе', description: 'Тальятелле с мясным соусом болоньезе', price: 520, discountPrice: 0, weight: 300, weightUnit: 'г', calories: 700, isPopular: false, estimatedPrepTime: 20, dietaryTags: [] },
        { name: 'Креветки с лингвини', description: 'Лингвини, тигровые креветки, чеснок, лимон', price: 690, discountPrice: 0, weight: 290, weightUnit: 'г', calories: 580, isPopular: true, estimatedPrepTime: 18, dietaryTags: [] },
      ],
    },
    {
      restaurantIndex: 0,
      categoryName: 'Десерты',
      sortOrder: 2,
      items: [
        { name: 'Тирамису', description: 'Классический итальянский десерт', price: 390, discountPrice: 0, weight: 180, weightUnit: 'г', calories: 450, isPopular: true, estimatedPrepTime: 5, dietaryTags: ['vegetarian'] },
        { name: 'Панна-котта', description: 'Сливочная панна-котта с ягодным соусом', price: 350, discountPrice: 0, weight: 150, weightUnit: 'г', calories: 380, isPopular: false, estimatedPrepTime: 5, dietaryTags: ['vegetarian', 'gluten-free'] },
      ],
    },
    {
      restaurantIndex: 1,
      categoryName: 'Суши и Роллы',
      sortOrder: 0,
      items: [
        { name: 'Филадельфия', description: 'Лосось, сливочный сыр, огурец', price: 390, discountPrice: 0, weight: 220, weightUnit: 'г', calories: 420, isPopular: true, estimatedPrepTime: 15, dietaryTags: [] },
        { name: 'Калифорния', description: 'Краб, авокадо, огурец, икра масаго', price: 420, discountPrice: 0, weight: 210, weightUnit: 'г', calories: 380, isPopular: true, estimatedPrepTime: 15, dietaryTags: [] },
        { name: 'Дракон', description: 'Угорь, авокадо, сливочный сыр, соус унаги', price: 490, discountPrice: 0, weight: 240, weightUnit: 'г', calories: 460, isPopular: true, estimatedPrepTime: 18, dietaryTags: [] },
        { name: 'Нигири Сет', description: '7 нигири с разными видами рыбы', price: 890, discountPrice: 790, weight: 280, weightUnit: 'г', calories: 520, isPopular: false, estimatedPrepTime: 20, dietaryTags: [] },
      ],
    },
    {
      restaurantIndex: 1,
      categoryName: 'Горячие блюда',
      sortOrder: 1,
      items: [
        { name: 'Тонкацу', description: 'Свинина в панировке с капустой и соусом', price: 520, discountPrice: 0, weight: 300, weightUnit: 'г', calories: 580, isPopular: false, estimatedPrepTime: 25, dietaryTags: [] },
        { name: 'Курица Терияки', description: 'Куриное филе с соусом терияки, кунжут', price: 480, discountPrice: 0, weight: 280, weightUnit: 'г', calories: 520, isPopular: true, estimatedPrepTime: 20, dietaryTags: [] },
        { name: 'Рамен Мисо', description: 'Японский суп с лапшой, свининой, яйцом', price: 550, discountPrice: 0, weight: 450, weightUnit: 'г', calories: 480, isPopular: true, estimatedPrepTime: 20, dietaryTags: [] },
      ],
    },
    {
      restaurantIndex: 2,
      categoryName: 'Бургеры',
      sortOrder: 0,
      items: [
        { name: 'Чизбургер Классик', description: 'Говяжья котлета 200г, чеддер, маринованные огурцы', price: 390, discountPrice: 0, weight: 280, weightUnit: 'г', calories: 750, isPopular: true, estimatedPrepTime: 12, dietaryTags: [] },
        { name: 'Бургер BBQ', description: 'Говяжья котлета, бекон, лук фри, соус BBQ', price: 450, discountPrice: 0, weight: 320, weightUnit: 'г', calories: 850, isPopular: true, estimatedPrepTime: 15, dietaryTags: [] },
        { name: 'Дабл Чиз', description: 'Две говяжьи котлеты, двойной чеддер, фирменный соус', price: 520, discountPrice: 0, weight: 380, weightUnit: 'г', calories: 980, isPopular: true, estimatedPrepTime: 15, dietaryTags: [] },
        { name: 'Вегги Бургер', description: 'Котлета из нута и овощей, авокадо, салат', price: 350, discountPrice: 0, weight: 260, weightUnit: 'г', calories: 450, isPopular: false, estimatedPrepTime: 14, dietaryTags: ['vegetarian', 'vegan'] },
      ],
    },
    {
      restaurantIndex: 2,
      categoryName: 'Снеки',
      sortOrder: 1,
      items: [
        { name: 'Картофель фри', description: 'Хрустящий картофель фри с солью', price: 150, discountPrice: 0, weight: 180, weightUnit: 'г', calories: 380, isPopular: true, estimatedPrepTime: 8, dietaryTags: ['vegan', 'gluten-free'] },
        { name: 'Чикен Наггетс', description: 'Куриные наггетсы с соусом', price: 220, discountPrice: 0, weight: 200, weightUnit: 'г', calories: 420, isPopular: false, estimatedPrepTime: 10, dietaryTags: [] },
        { name: 'Сырные палочки', description: 'Моцарелла в панировке, соус маринара', price: 250, discountPrice: 0, weight: 160, weightUnit: 'г', calories: 350, isPopular: false, estimatedPrepTime: 10, dietaryTags: ['vegetarian'] },
      ],
    },
    {
      restaurantIndex: 3,
      categoryName: 'WOK',
      sortOrder: 0,
      items: [
        { name: 'Лапша WOK с курицей', description: 'Яичная лапша, курица, овощи, соус терияки', price: 380, discountPrice: 0, weight: 350, weightUnit: 'г', calories: 520, isPopular: true, estimatedPrepTime: 12, dietaryTags: [] },
        { name: 'Рис WOK с креветками', description: 'Жасминовый рис, тигровые креветки, овощи, соус', price: 490, discountPrice: 0, weight: 340, weightUnit: 'г', calories: 480, isPopular: true, estimatedPrepTime: 15, dietaryTags: [] },
        { name: 'Удон с говядиной', description: 'Японская лапша удон, мраморная говядина, перец', price: 520, discountPrice: 0, weight: 360, weightUnit: 'г', calories: 560, isPopular: false, estimatedPrepTime: 15, dietaryTags: [] },
        { name: 'Лапша WOK с овощами', description: 'Стеклянная лапша, сезонные овощи, соус', price: 300, discountPrice: 0, weight: 320, weightUnit: 'г', calories: 320, isPopular: false, estimatedPrepTime: 10, dietaryTags: ['vegan', 'gluten-free'] },
      ],
    },
    {
      restaurantIndex: 3,
      categoryName: 'Супы',
      sortOrder: 1,
      items: [
        { name: 'Том Ям с креветками', description: 'Острый тайский суп на кокосовом молоке', price: 450, discountPrice: 0, weight: 400, weightUnit: 'г', calories: 380, isPopular: true, estimatedPrepTime: 18, dietaryTags: ['gluten-free'] },
        { name: 'Фо Бо', description: 'Вьетнамский суп с говядиной и рисовой лапшой', price: 420, discountPrice: 0, weight: 450, weightUnit: 'г', calories: 400, isPopular: false, estimatedPrepTime: 20, dietaryTags: ['gluten-free'] },
      ],
    },
    {
      restaurantIndex: 4,
      categoryName: 'Салаты',
      sortOrder: 0,
      items: [
        { name: 'Цезарь с курицей', description: 'Айсберг, курица гриль, пармезан, гренки, соус', price: 380, discountPrice: 0, weight: 250, weightUnit: 'г', calories: 320, isPopular: true, estimatedPrepTime: 10, dietaryTags: [] },
        { name: 'Греческий салат', description: 'Свежие овощи, фета, оливки, оливковое масло', price: 350, discountPrice: 0, weight: 280, weightUnit: 'г', calories: 280, isPopular: true, estimatedPrepTime: 8, dietaryTags: ['vegetarian', 'gluten-free'] },
        { name: 'Боул с киноа', description: 'Киноа, авокадо, нут, овощи, соус', price: 420, discountPrice: 0, weight: 320, weightUnit: 'г', calories: 380, isPopular: false, estimatedPrepTime: 12, dietaryTags: ['vegan', 'gluten-free'] },
      ],
    },
    {
      restaurantIndex: 4,
      categoryName: 'Основные блюда',
      sortOrder: 1,
      items: [
        { name: 'Куриное филе гриль', description: 'Куриная грудка на гриле с овощами', price: 420, discountPrice: 0, weight: 280, weightUnit: 'г', calories: 340, isPopular: true, estimatedPrepTime: 20, dietaryTags: ['gluten-free'] },
        { name: 'Лосось с овощами', description: 'Филе лосося на пару с брокколи и шпинатом', price: 590, discountPrice: 0, weight: 300, weightUnit: 'г', calories: 420, isPopular: true, estimatedPrepTime: 25, dietaryTags: ['gluten-free'] },
        { name: 'Индейка с бататом', description: 'Индейка запечённая с бататом и розмарином', price: 480, discountPrice: 0, weight: 310, weightUnit: 'г', calories: 390, isPopular: false, estimatedPrepTime: 25, dietaryTags: ['gluten-free'] },
      ],
    },
  ];

  for (const mData of menuData) {
    const restaurant = restaurants[mData.restaurantIndex];
    const category = categoryRepo.create({
      name: mData.categoryName,
      sortOrder: mData.sortOrder,
      restaurantId: restaurant.id,
      isActive: true,
    });
    const savedCategory = await categoryRepo.save(category);

    for (const iData of mData.items) {
      const item = itemRepo.create({
        name: iData.name,
        description: iData.description,
        price: iData.price,
        discountPrice: iData.discountPrice,
        image: `/images/menu/${savedCategory.id.slice(0, 8)}.jpg`,
        weight: iData.weight,
        weightUnit: iData.weightUnit,
        calories: iData.calories,
        isPopular: iData.isPopular,
        isAvailable: true,
        isActive: true,
        categoryId: savedCategory.id,
        sortOrder: 0,
        estimatedPrepTime: iData.estimatedPrepTime,
        dietaryTags: iData.dietaryTags,
        ingredients: `{${iData.name}}`,
      });
      await itemRepo.save(item);
    }
    console.log(`Category created: ${savedCategory.name} (${mData.items.length} items)`);
  }

  const bannersData = [
    {
      title: 'Скидка 20% на первый заказ',
      description: 'Промокод WELCOME20 действует для новых пользователей',
      image: '/images/banners/welcome-banner.jpg',
      link: '/offers/welcome',
      sortOrder: 0,
      isActive: true,
      backgroundColor: '#6C63FF',
      textColor: '#FFFFFF',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-12-31'),
      targetAudience: 'all',
    },
    {
      title: 'Бесплатная доставка',
      description: 'При заказе от 1500₽ во всех ресторанах',
      image: '/images/banners/free-delivery.jpg',
      link: '/offers/free-delivery',
      sortOrder: 1,
      isActive: true,
      backgroundColor: '#FF6B35',
      textColor: '#FFFFFF',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-12-31'),
      targetAudience: 'all',
    },
    {
      title: 'Премиум подписка',
      description: 'Кешбэк 10% и эксклюзивные предложения',
      image: '/images/banners/premium.jpg',
      link: '/premium',
      sortOrder: 2,
      isActive: true,
      backgroundColor: '#000000',
      textColor: '#FFD700',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-12-31'),
      targetAudience: 'all',
    },
  ];

  for (const bData of bannersData) {
    const banner = bannerRepo.create(bData);
    await bannerRepo.save(banner);
  }
  console.log(`${bannersData.length} banners created`);

  const couponsData = [
    {
      code: 'WELCOME20',
      type: CouponType.PERCENTAGE,
      value: 20,
      minOrder: 0,
      maxDiscount: 500,
      usageLimit: 10000,
      usedCount: 0,
      perUserLimit: 1,
      status: CouponStatus.ACTIVE,
      startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2026-12-31'),
      description: '20% на первый заказ',
      isFirstOrderOnly: true,
    },
    {
      code: 'FREEDEL',
      type: CouponType.FREE_DELIVERY,
      value: 0,
      minOrder: 1500,
      usageLimit: 5000,
      usedCount: 0,
      perUserLimit: 1,
      status: CouponStatus.ACTIVE,
      startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2026-12-31'),
      description: 'Бесплатная доставка при заказе от 1500₽',
      isFirstOrderOnly: false,
    },
    {
      code: 'BONUS100',
      type: CouponType.BONUS_POINTS,
      value: 100,
      minOrder: 800,
      usageLimit: 3000,
      usedCount: 0,
      perUserLimit: 3,
      status: CouponStatus.ACTIVE,
      startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2026-12-31'),
      description: '100 бонусных баллов на счёт',
      isFirstOrderOnly: false,
    },
    {
      code: 'SUMMER10',
      type: CouponType.PERCENTAGE,
      value: 10,
      minOrder: 600,
      maxDiscount: 300,
      usageLimit: 10000,
      usedCount: 0,
      perUserLimit: 5,
      status: CouponStatus.ACTIVE,
      startsAt: new Date('2025-06-01'),
      expiresAt: new Date('2026-08-31'),
      description: '10% летняя скидка на любой заказ',
      isFirstOrderOnly: false,
    },
    {
      code: 'VIP500',
      type: CouponType.FIXED,
      value: 500,
      minOrder: 2000,
      usageLimit: 500,
      usedCount: 0,
      perUserLimit: 1,
      status: CouponStatus.ACTIVE,
      startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2026-12-31'),
      description: '500₽ на заказ для премиум-клиентов',
      isFirstOrderOnly: false,
    },
  ];

  for (const cData of couponsData) {
    const coupon = couponRepo.create(cData);
    await couponRepo.save(coupon);
  }
  console.log(`${couponsData.length} coupons created`);

  console.log('\n=== Seeding complete! ===');
  console.log('Users:');
  console.log('  0 / 0 (Test User)');
  console.log('  admin@foodie.app / password123 (Admin)');
  console.log('  owner@foodie.app / password123 (Owner)');
  console.log('  courier@foodie.app / password123 (Courier)');
  console.log('  user@foodie.app / password123 (User)');
  console.log(`\nRestaurants: ${restaurants.length}`);
  console.log(`Menu categories & items added`);
  console.log(`Coupons: ${couponsData.length}`);
  console.log(`Banners: ${bannersData.length}`);

  await dataSource.destroy();
  console.log('Connection closed');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
