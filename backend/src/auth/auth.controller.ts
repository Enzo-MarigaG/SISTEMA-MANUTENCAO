import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';

const isProduction = process.env.NODE_ENV === 'production';
const isCrossOrigin = process.env.COOKIE_CROSS_ORIGIN === 'true';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isCrossOrigin ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 8 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: any) {
    const result = await this.authService.login(loginDto.email, loginDto.password);
    res.cookie('access_token', result.access_token, COOKIE_OPTIONS);
    return { user: result.user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logout(@Res({ passthrough: true }) res: any) {
    res.clearCookie('access_token', COOKIE_OPTIONS);
    return { ok: true };
  }
}
