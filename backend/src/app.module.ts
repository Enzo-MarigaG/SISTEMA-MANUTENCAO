import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { ServiceOrdersModule } from './service-orders/service-orders.module.js';
import { PartsModule } from './parts/parts.module.js';
import { ReportsModule } from './reports/reports.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ServiceOrdersModule,
    PartsModule,
    ReportsModule,
  ],
})
export class AppModule {}
