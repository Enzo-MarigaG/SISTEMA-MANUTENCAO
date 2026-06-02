import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePartDto } from './dto/create-part.dto.js';
import { UpdatePartDto } from './dto/update-part.dto.js';

@Injectable()
export class PartsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePartDto) {
    return this.prisma.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: {
          name: dto.name,
          sku: dto.sku,
          unitPrice: dto.unitPrice,
          stockQty: dto.stockQty ?? 0,
          minStock: dto.minStock ?? 0,
        },
      });

      if ((dto.stockQty ?? 0) > 0) {
        await tx.stockMovement.create({
          data: {
            partId: part.id,
            type: 'IN',
            quantity: dto.stockQty!,
            reason: 'Estoque inicial',
          },
        });
      }

      return part;
    });
  }

  async findAll(search?: string) {
    return this.prisma.part.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const part = await this.prisma.part.findUnique({
      where: { id },
      include: {
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!part) throw new NotFoundException('Peça não encontrada');
    return part;
  }

  async update(id: string, dto: UpdatePartDto) {
    await this.findOne(id);
    return this.prisma.part.update({ where: { id }, data: dto });
  }

  async adjustStock(
    id: string,
    quantity: number,
    type: 'IN' | 'OUT' | 'ADJUSTMENT',
    reason?: string,
  ) {
    const part = await this.findOne(id);

    if (type === 'OUT' && part.stockQty < quantity) {
      throw new BadRequestException('Estoque insuficiente');
    }

    const newQty =
      type === 'IN'
        ? part.stockQty + quantity
        : type === 'OUT'
          ? part.stockQty - quantity
          : quantity;

    return this.prisma.$transaction(async (tx) => {
      await tx.part.update({
        where: { id },
        data: { stockQty: newQty },
      });
      return tx.stockMovement.create({
        data: { partId: id, type, quantity, reason },
      });
    });
  }

  async getLowStock() {
    const parts = await this.prisma.part.findMany();
    return parts.filter((p) => p.stockQty <= p.minStock);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.part.delete({ where: { id } });
  }
}
