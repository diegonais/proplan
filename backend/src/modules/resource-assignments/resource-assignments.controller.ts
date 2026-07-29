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
import { ResourceResponseDto } from '../resources/dto/resource-response.dto';
import { AvailableResourcesQueryDto } from './dto/available-resources-query.dto';
import { CreateResourceAssignmentDto } from './dto/create-resource-assignment.dto';
import { ListResourceAssignmentsQueryDto } from './dto/list-resource-assignments-query.dto';
import { ResourceAssignmentResponseDto } from './dto/resource-assignment-response.dto';
import { UpdateResourceAssignmentDto } from './dto/update-resource-assignment.dto';
import { ResourceAssignmentsService } from './resource-assignments.service';

@ApiTags('resource-assignments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, invalido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene permiso suficiente.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
@Controller({ version: '1' })
export class ResourceAssignmentsController {
  constructor(private readonly resourceAssignmentsService: ResourceAssignmentsService) {}

  @Post('projects/:projectUuid/resource-assignments')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Asignar un recurso a un proyecto o actividad.' })
  @ApiCreatedResponse({ type: ResourceAssignmentResponseDto })
  @ApiBadRequestResponse({ description: 'Datos invalidos, recurso no asignable o fechas fuera de rango.' })
  @ApiConflictResponse({ description: 'El recurso ya tiene una asignacion superpuesta.' })
  @ApiNotFoundResponse({ description: 'Proyecto, recurso o actividad no encontrados.' })
  create(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @Body() createResourceAssignmentDto: CreateResourceAssignmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResourceAssignmentResponseDto> {
    return this.resourceAssignmentsService.create(
      projectUuid,
      createResourceAssignmentDto,
      currentUser,
    );
  }

  @Get('projects/:projectUuid/resource-assignments')
  @ApiOperation({ summary: 'Listar asignaciones de recursos de un proyecto autorizado.' })
  @ApiOkResponse({ type: [ResourceAssignmentResponseDto] })
  @ApiBadRequestResponse({ description: 'Filtros invalidos.' })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado.' })
  findAll(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @Query() query: ListResourceAssignmentsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResourceAssignmentResponseDto[]> {
    return this.resourceAssignmentsService.findAll(projectUuid, query, currentUser);
  }

  @Get('resource-assignments/:uuid')
  @ApiOperation({ summary: 'Consultar una asignacion de recurso autorizada por UUID.' })
  @ApiOkResponse({ type: ResourceAssignmentResponseDto })
  @ApiNotFoundResponse({ description: 'Asignacion no encontrada.' })
  findOne(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResourceAssignmentResponseDto> {
    return this.resourceAssignmentsService.findOne(uuid, currentUser);
  }

  @Patch('resource-assignments/:uuid')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Actualizar una asignacion de recurso autorizada.' })
  @ApiOkResponse({ type: ResourceAssignmentResponseDto })
  @ApiBadRequestResponse({ description: 'Datos invalidos, recurso no asignable o fechas fuera de rango.' })
  @ApiConflictResponse({ description: 'El recurso ya tiene una asignacion superpuesta.' })
  @ApiNotFoundResponse({ description: 'Asignacion, recurso o actividad no encontrados.' })
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateResourceAssignmentDto: UpdateResourceAssignmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResourceAssignmentResponseDto> {
    return this.resourceAssignmentsService.update(uuid, updateResourceAssignmentDto, currentUser);
  }

  @Delete('resource-assignments/:uuid')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar logicamente una asignacion de recurso.' })
  @ApiNoContentResponse({ description: 'Asignacion eliminada logicamente.' })
  @ApiNotFoundResponse({ description: 'Asignacion no encontrada.' })
  async remove(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.resourceAssignmentsService.remove(uuid, currentUser);
  }

  @Get('projects/:projectUuid/available-resources')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Listar recursos disponibles para un proyecto o actividad.' })
  @ApiOkResponse({ type: [ResourceResponseDto] })
  @ApiBadRequestResponse({ description: 'Intervalo invalido o fechas fuera de rango.' })
  @ApiNotFoundResponse({ description: 'Proyecto o actividad no encontrados.' })
  findAvailableResources(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @Query() query: AvailableResourcesQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResourceResponseDto[]> {
    return this.resourceAssignmentsService.findAvailableResources(projectUuid, query, currentUser);
  }
}
