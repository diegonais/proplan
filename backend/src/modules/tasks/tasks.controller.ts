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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { UpdateOwnTaskProgressDto } from './dto/update-own-task-progress.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, invalido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene permiso sobre la actividad.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.USER)
@Controller({ version: '1' })
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('projects/:projectUuid/tasks')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Crear una actividad o subactividad dentro de un proyecto.' })
  @ApiCreatedResponse({ type: TaskResponseDto })
  @ApiBadRequestResponse({ description: 'Datos invalidos o reglas de actividad incumplidas.' })
  create(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.tasksService.create(projectUuid, createTaskDto, currentUser);
  }

  @Get('projects/:projectUuid/tasks')
  @ApiOperation({ summary: 'Listar actividades activas de un proyecto autorizado.' })
  @ApiOkResponse({ type: [TaskResponseDto] })
  findAll(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto[]> {
    return this.tasksService.findAll(projectUuid, currentUser);
  }

  @Get('tasks/:uuid')
  @ApiOperation({ summary: 'Consultar una actividad por UUID.' })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Actividad no encontrada o eliminada.' })
  findOne(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.tasksService.findOne(uuid, currentUser);
  }

  @Patch('tasks/:uuid')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Actualizar una actividad autorizada.' })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiBadRequestResponse({ description: 'Datos invalidos o reglas de actividad incumplidas.' })
  @ApiNotFoundResponse({ description: 'Actividad no encontrada o eliminada.' })
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.tasksService.update(uuid, updateTaskDto, currentUser);
  }

  @Patch('tasks/:uuid/my-progress')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Actualizar solo estado y progreso de una actividad asignada al Usuario.' })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiBadRequestResponse({ description: 'Estado y progreso invalidos.' })
  @ApiForbiddenResponse({ description: 'La actividad no esta asignada al usuario autenticado.' })
  @ApiNotFoundResponse({ description: 'Actividad no encontrada o eliminada.' })
  updateOwnProgress(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateOwnTaskProgressDto: UpdateOwnTaskProgressDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.tasksService.updateOwnProgress(uuid, updateOwnTaskProgressDto, currentUser);
  }

  @Delete('tasks/:uuid')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar logicamente una actividad sin cascada sobre subactividades.' })
  @ApiNoContentResponse({ description: 'Actividad eliminada logicamente.' })
  @ApiBadRequestResponse({ description: 'La actividad tiene subactividades activas.' })
  @ApiNotFoundResponse({ description: 'Actividad no encontrada o eliminada.' })
  async remove(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.tasksService.remove(uuid, currentUser);
  }
}
