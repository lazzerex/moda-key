import { 
  Controller, 
  Get, 
  Post,
  Put,
  Body,
  Param, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiBearerAuth,
  ApiResponse 
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Get user orders' })
  @ApiResponse({
    status: 200,
    description: 'List of user orders',
  })
  async getOrders(@Request() req: any) {
    return this.ordersService.getOrders(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details' })
  @ApiResponse({
    status: 200,
    description: 'Order details',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async getOrderById(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.getOrderById(id, req.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create order from cart',
    description: 'Creates an order from the user\'s cart with atomic inventory reservation'
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cart empty or insufficient stock',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - inventory concurrency issue',
  })
  async createOrder(
    @Request() req: any,
    @Body() createOrderDto: CreateOrderDto
  ) {
    return this.ordersService.createOrder(req.user.id, createOrderDto);
  }

  @Put(':id/cancel')
  @ApiOperation({ 
    summary: 'Cancel order',
    description: 'Cancels an order and releases reserved inventory'
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel order in current state',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async cancelOrder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() cancelDto: CancelOrderDto
  ) {
    return this.ordersService.cancelOrder(id, req.user.id, cancelDto);
  }
}
