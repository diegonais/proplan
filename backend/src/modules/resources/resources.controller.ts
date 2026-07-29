import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ListResourcesQueryDto } from './dto/list-resources-query.dto';
import { PaginatedResourcesResponseDto } from './dto/paginated-resources-response.dto';
import { ResourceAvailabilityQueryDto } from './dto/resource-availability-query.dto';
import { ResourceAvailabilityResponseDto } from './dto/resource-availability-response.dto';
import { ResourceResponseDto } from './dto/resource-response.dto';
import { UpdateResourceStatusDto } from './dto/update-resource-status.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesService } from './resources.service';

@ApiTags('resources')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, invalido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene rol suficiente.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller({
  path: 'resources',
  version: '1',
})
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear un recurso del catalogo institucional.' })
  @ApiCreatedResponse({ type: ResourceResponseDto })
  @ApiConflictResponse({ description: 'El codigo del recurso ya esta registrado.' })
  create(@Body() createResourceDto: CreateResourceDto): Promise<ResourceResponseDto> {
    return this.resourcesService.create(createResourceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar recursos con paginacion, busqueda, filtros y ordenamiento.' })
  @ApiOkResponse({ type: PaginatedResourcesResponseDto })
  findAll(@Query() query: ListResourcesQueryDto): Promise<PaginatedResourcesResponseDto> {
    return this.resourcesService.findAll(query);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Consultar un recurso activo por UUID.' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiNotFoundResponse({ description: 'Recurso no encontrado o eliminado.' })
  findOne(@Param('uuid', ParseUUIDPipe) uuid: string): Promise<ResourceResponseDto> {
    return this.resourcesService.findOne(uuid);
  }

  @Patch(':uuid')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Editar datos generales de un recurso del catalogo.' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiConflictResponse({ description: 'El codigo del recurso ya esta registrado.' })
  @ApiNotFoundResponse({ description: 'Recurso no encontrado o eliminado.' })
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateResourceDto: UpdateResourceDto,
  ): Promise<ResourceResponseDto> {
    return this.resourcesService.update(uuid, updateResourceDto);
  }

  @Patch(':uuid/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cambiar estado operativo o activar/desactivar un recurso.' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiBadRequestResponse({
    description: 'Cambio invalido o recurso con asignaciones actuales o futuras.',
  })
  @ApiNotFoundResponse({ description: 'Recurso no encontrado o eliminado.' })
  updateStatus(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateResourceStatusDto: UpdateResourceStatusDto,
  ): Promise<ResourceResponseDto> {
    return this.resourcesService.updateStatus(uuid, updateResourceStatusDto);
  }

  @Delete(':uuid')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar logicamente un recurso sin eliminar historial.' })
  @ApiNoContentResponse({ description: 'Recurso eliminado logicamente.' })
  @ApiBadRequestResponse({ description: 'El recurso tiene asignaciones actuales o futuras.' })
  @ApiNotFoundResponse({ description: 'Recurso no encontrado o eliminado.' })
  async remove(@Param('uuid', ParseUUIDPipe) uuid: string): Promise<void> {
    await this.resourcesService.remove(uuid);
  }

  @Get(':uuid/availability')
  @ApiOperation({ summary: 'Consultar disponibilidad calculada de un recurso por intervalo.' })
  @ApiOkResponse({ type: ResourceAvailabilityResponseDto })
  @ApiBadRequestResponse({ description: 'Intervalo de fechas invalido.' })
  @ApiNotFoundResponse({ description: 'Recurso no encontrado.' })
  checkAvailability(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Query() query: ResourceAvailabilityQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResourceAvailabilityResponseDto> {
    return this.resourcesService.checkAvailability(uuid, query, currentUser);
  }
}
