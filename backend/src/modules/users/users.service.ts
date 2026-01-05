import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current user profile with addresses
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Check if email is being changed and is already taken
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
    }

    // Hash password if provided
    const updateData: any = { ...dto };
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Get all addresses for a user
   */
  async listAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  /**
   * Create a new address for a user
   */
  async createAddress(userId: string, dto: CreateAddressDto) {
    // If this is set as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  /**
   * Update an existing address
   */
  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    // Verify address belongs to user
    const address = await this.prisma.userAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('You can only update your own addresses');
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.update({
      where: { id: addressId },
      data: dto,
    });
  }

  /**
   * Delete an address
   */
  async deleteAddress(userId: string, addressId: string) {
    // Verify address belongs to user
    const address = await this.prisma.userAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('You can only delete your own addresses');
    }

    await this.prisma.userAddress.delete({
      where: { id: addressId },
    });

    return { message: 'Address deleted successfully' };
  }

  /**
   * Set an address as default
   */
  async setDefaultAddress(userId: string, addressId: string) {
    // Verify address belongs to user
    const address = await this.prisma.userAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('You can only modify your own addresses');
    }

    // Unset all other defaults
    await this.prisma.userAddress.updateMany({
      where: { userId, id: { not: addressId } },
      data: { isDefault: false },
    });

    // Set this one as default
    return this.prisma.userAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }
}
