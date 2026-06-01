import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PartsService } from './parts.service.js';
import { CreatePartDto } from './dto/create-part.dto.js';
import { UpdatePartDto } from './dto/update-part.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('parts')
export class PartsController {
  constructor(private partsService: PartsService) {}

  @Get('low-stock')
  getLowStock() {
    return this.partsService.getLowStock();
  }

  @Post()
  create(@Body() dto: CreatePartDto) {
    return this.partsService.create(dto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.partsService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.partsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePartDto) {
    return this.partsService.update(id, dto);
  }

  @Post(':id/stock')
  adjustStock(
    @Param('id') id: string,
    @Body()
    body: {
      quantity: number;
      type: 'IN' | 'OUT' | 'ADJUSTMENT';
      reason?: string;
    },
  ) {
    return this.partsService.adjustStock(
      id,
      body.quantity,
      body.type,
      body.reason,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.partsService.remove(id);
  }
}
