import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene rol suficiente.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un usuario administrado por el Administrador.' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'El email ya está registrado.' })
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios con paginación, búsqueda, filtros y ordenamiento limitado.' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findAll(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    return this.usersService.findAll(query);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Consultar un usuario por UUID.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  findOne(@Param('uuid', ParseUUIDPipe) uuid: string): Promise<UserResponseDto> {
    return this.usersService.findOne(uuid);
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Actualizar datos generales o contraseña de un usuario.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'El email ya está registrado.' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(uuid, updateUserDto);
  }

  @Patch(':uuid/status')
  @ApiOperation({ summary: 'Activar o desactivar un usuario.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({
    description:
      'No se puede dejar el sistema sin Administrador activo ni desactivar usuarios con responsabilidades activas.',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  updateStatus(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateStatus(uuid, updateUserStatusDto.isActive);
  }

  @Patch(':uuid/role')
  @ApiOperation({ summary: 'Asignar rol a un usuario.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'No se puede dejar el sistema sin Administrador activo.' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado.' })
  updateRole(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateRole(uuid, updateUserRoleDto.role);
  }
}
