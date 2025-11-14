import {
  Controller,
  Get,
  Req,
  UseGuards,
  Put,
  Param,
  ParseIntPipe,
  Body,
  Delete,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateUserDto } from '../dto';
import { UpdateUserResponseDto } from '../dto/update-user-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user from JWT' })
  @ApiResponse({ status: 200, description: 'Current user payload' })
  getMe(@Req() req: any) {
    const user = req.user;
    return {
      id: user.sub as number,
      email: user.email,
      name: user.name,
      roles: user.roles,
    };
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Get('id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get full user info from database using token' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Req() req: any) {
    const userId = req.user.sub;
    return this.usersService.findById(userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', description: 'User ID (number)', type: 'integer' })
  @ApiResponse({ status: 200, description: 'User updated', type: UpdateUserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateById(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiParam({ name: 'id', description: 'User ID (number)', type: 'integer' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUserById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteById(id);
  }
}
