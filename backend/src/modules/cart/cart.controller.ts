import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  @ApiResponse({
    status: 200,
    description: 'User cart with items',
  })
  async getCart(@Request() req: any) {
    return this.cartService.getCart(req.user.id);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiResponse({
    status: 201,
    description: 'Item added to cart',
  })
  async addToCart(
    @Request() req: any,
    @Body() addToCartDto: AddToCartDto,
  ) {
    return this.cartService.addToCart(req.user.id, addToCartDto);
  }

  @Put('items/:cartItemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  async updateCartItem(
    @Request() req: any,
    @Param('cartItemId') cartItemId: string,
    @Body() updateDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(req.user.id, cartItemId, updateDto);
  }

  @Delete('items/:cartItemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove item from cart' })
  async removeFromCart(
    @Request() req: any,
    @Param('cartItemId') cartItemId: string,
  ) {
    return this.cartService.removeFromCart(req.user.id, cartItemId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear entire cart' })
  async clearCart(@Request() req: any) {
    return this.cartService.clearCart(req.user.id);
  }
}
