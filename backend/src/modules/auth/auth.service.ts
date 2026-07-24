import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { EnvironmentVariables } from '../../config/env.validation';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const INVALID_CREDENTIALS_MESSAGE = 'Credenciales inválidas.';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmailForAuthentication(loginDto.email);

    if (user?.isActive !== true) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const payload: JwtPayload = {
      sub: user.uuid,
      email: user.email,
      role: user.role,
    };
    const expiresIn = this.configService.get('JWT_EXPIRES_IN', { infer: true });

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn,
      user: UserResponseDto.fromEntity(user),
    };
  }

  async validateJwtPayload(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findActiveByUuidForAuthentication(payload.sub);

    if (user === null) {
      throw new UnauthorizedException('Token inválido o usuario no autorizado.');
    }

    return {
      uuid: user.uuid,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: true,
    };
  }
}
