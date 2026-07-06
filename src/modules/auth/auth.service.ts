import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../../common/guards/roles.guard';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private otpStore: Map<string, { otp: string; expires: Date }> = new Map();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<any> {
    const { name, email, password, phone, role } = registerDto;

    const existingEmail = await this.userRepository.findOne({ where: { email } });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    if (phone) {
      const existingPhone = await this.userRepository.findOne({ where: { phone } });
      if (existingPhone) {
        throw new ConflictException('Phone already registered');
      }
    }

    const hashedPassword = await bcrypt.hash(
      password,
      this.configService.get<number>('app.bcryptSaltRounds')!,
    );

    const user = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      role: role || UserRole.USER,
      isActive: true,
      isEmailVerified: false,
      bonusPoints: 0,
      isPremium: false,
      avatar: null,
      refreshToken: null,
    } as unknown as DeepPartial<User>);

    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    user.refreshToken = tokens.refreshToken;
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Registration successful',
      data: {
        user: this.sanitizeUser(user),
        ...tokens,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<any> {
    const { email, phone, password } = loginDto;

    if (!email && !phone) {
      throw new BadRequestException('Email or phone is required');
    }

    const user = email
      ? await this.userRepository.findOne({ where: { email } })
      : await this.userRepository.findOne({ where: { phone } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    user.refreshToken = tokens.refreshToken;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Login successful',
      data: {
        user: this.sanitizeUser(user),
        ...tokens,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<any> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('app.jwtRefreshSecret'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user);

      user.refreshToken = tokens.refreshToken;
      await this.userRepository.save(user);

      return {
        success: true,
        data: tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async verifyEmail(email: string, otp: string): Promise<any> {
    const stored = this.otpStore.get(`email:${email}`);
    if (!stored || stored.otp !== otp || stored.expires < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.isEmailVerified = true;
    await this.userRepository.save(user);
    this.otpStore.delete(`email:${email}`);

    return { success: true, message: 'Email verified successfully' };
  }

  async sendOtp(phone: string): Promise<any> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpStore.set(`phone:${phone}`, {
      otp,
      expires: new Date(Date.now() + 5 * 60 * 1000),
    });

    this.logger.log(`OTP for ${phone}: ${otp}`);

    return { success: true, message: 'OTP sent successfully' };
  }

  async verifyPhone(phone: string, otp: string): Promise<any> {
    const stored = this.otpStore.get(`phone:${phone}`);
    if (!stored || stored.otp !== otp || stored.expires < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const user = await this.userRepository.findOne({ where: { phone } });
    if (user) {
      user.isPhoneVerified = true;
      await this.userRepository.save(user);
    }

    this.otpStore.delete(`phone:${phone}`);

    return { success: true, message: 'Phone verified successfully' };
  }

  async googleAuth(idToken: string): Promise<any> {
    try {
      const jwtParts = idToken.split('.');
      const payload = JSON.parse(
        Buffer.from(jwtParts[1], 'base64').toString(),
      );

      const { email, name, picture, sub } = payload;

      let user = await this.userRepository.findOne({ where: { email } });

      if (!user) {
        user = this.userRepository.create({
          name: name || 'Google User',
          email,
          avatar: picture,
          googleId: sub,
          isActive: true,
          isEmailVerified: true,
          role: UserRole.USER,
          bonusPoints: 0,
          isPremium: false,
          password: null,
      } as unknown as DeepPartial<User>);
      await this.userRepository.save(user);
    } else {
        user.googleId = sub;
        if (!user.avatar) user.avatar = picture;
        await this.userRepository.save(user);
      }

      const tokens = await this.generateTokens(user);
      user.refreshToken = tokens.refreshToken;
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      return {
        success: true,
        data: { user: this.sanitizeUser(user), ...tokens },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  async appleAuth(identityToken: string): Promise<any> {
    try {
      const jwtParts = identityToken.split('.');
      const payload = JSON.parse(
        Buffer.from(jwtParts[1], 'base64').toString(),
      );

      const { email, sub } = payload;

      let user = await this.userRepository.findOne({
        where: { appleId: sub },
      });

      if (!user && email) {
        user = await this.userRepository.findOne({ where: { email } });
      }

      if (!user) {
        user = this.userRepository.create({
          name: 'Apple User',
          email: email || `apple_${sub}@privaterelay.appleid.com`,
          appleId: sub,
          isActive: true,
          isEmailVerified: !!email,
          role: UserRole.USER,
          bonusPoints: 0,
          isPremium: false,
          password: null,
        } as unknown as DeepPartial<User>);
        await this.userRepository.save(user);
      } else {
        user.appleId = sub;
        await this.userRepository.save(user);
      }

      const tokens = await this.generateTokens(user);
      user.refreshToken = tokens.refreshToken;
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      return {
        success: true,
        data: { user: this.sanitizeUser(user), ...tokens },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid Apple token');
    }
  }

  async phoneAuth(phone: string, verificationCode: string): Promise<any> {
    const stored = this.otpStore.get(`phone:${phone}`);
    if (
      !stored ||
      stored.otp !== verificationCode ||
      stored.expires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    let user = await this.userRepository.findOne({ where: { phone } });

    if (!user) {
      user = this.userRepository.create({
        phone,
        name: `User_${phone.slice(-4)}`,
        isActive: true,
        isPhoneVerified: true,
        role: UserRole.USER,
        bonusPoints: 0,
        isPremium: false,
        password: null,
        } as unknown as DeepPartial<User>);
        await this.userRepository.save(user);
      } else {
      user.isPhoneVerified = true;
    }

    const tokens = await this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);
    this.otpStore.delete(`phone:${phone}`);

    return {
      success: true,
      data: { user: this.sanitizeUser(user), ...tokens },
    };
  }

  async googleLogin(profile: any): Promise<any> {
    const { email, firstName, lastName, picture } = profile;
    const name = `${firstName || ''} ${lastName || ''}`.trim() || 'Google User';

    let user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      user = this.userRepository.create({
        name,
        email,
        avatar: picture,
        googleId: email,
        isActive: true,
        isEmailVerified: true,
        role: UserRole.USER,
        bonusPoints: 0,
        isPremium: false,
        password: null,
      } as unknown as DeepPartial<User>);
      await this.userRepository.save(user);
    }

    const tokens = await this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return {
      success: true,
      data: { user: this.sanitizeUser(user), ...tokens },
    };
  }

  async logout(user: User): Promise<any> {
    user.refreshToken = null as any;
    await this.userRepository.save(user);
    return { success: true, message: 'Logged out successfully' };
  }

  async changePassword(
    user: User,
    oldPassword: string,
    newPassword: string,
  ): Promise<any> {
    if (!user.password) {
      throw new BadRequestException(
        'Cannot change password for social login accounts',
      );
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(
      newPassword,
      this.configService.get<number>('app.bcryptSaltRounds')!,
    );
    await this.userRepository.save(user);

    return { success: true, message: 'Password changed successfully' };
  }

  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwtRefreshSecret'),
      expiresIn: this.configService.get<string>('app.jwtRefreshExpiresIn'),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  private sanitizeUser(user: User): any {
    const { password, refreshToken, ...sanitized } = user;
    return sanitized;
  }
}
